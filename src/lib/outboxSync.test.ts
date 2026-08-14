import { describe, expect, it, vi } from 'vitest'
import {
  computeBackoffMs,
  drainQueue,
  MAX_RETRIES,
  AUTH_RACE_BACKOFF_MS,
  MAX_SYNC_BACKOFF_MS,
  SERVER_WAKE_BACKOFF_MS,
  type DrainQueueDeps,
  type SuccessfulSyncOp,
} from './outboxSync'
import type { QueuedOp, DispatchResult, ToastCopy } from './outbox'

function op(partial: Partial<QueuedOp>): QueuedOp {
  return {
    id: 'op1',
    entity: 'transaction',
    type: 'add',
    targetId: 't1',
    createdAt: 0,
    retryCount: 0,
    ...partial,
  }
}

interface Harness {
  deps: DrainQueueDeps
  queue: QueuedOp[]
  recentlyCompleted: QueuedOp[]
  failedOps: QueuedOp[]
  emittedToasts: Array<{ copy: ToastCopy; hasUndo: boolean }>
  calls: Record<string, number>
  activeSyncIds: (string | null)[]
  backoffSetTo: number[]
  errors: (string | null)[]
  refreshArgs: SuccessfulSyncOp[][]
  syncing: { value: boolean }
  backoffAttempt: { value: number }
}

function makeHarness(overrides: Partial<DrainQueueDeps> = {}, initialQueue: QueuedOp[] = []): Harness {
  const queue = [...initialQueue]
  const recentlyCompleted: QueuedOp[] = []
  const failedOps: QueuedOp[] = []
  const emittedToasts: Array<{ copy: ToastCopy; hasUndo: boolean }> = []
  const activeSyncIds: (string | null)[] = []
  const backoffSetTo: number[] = []
  const errors: (string | null)[] = []
  const refreshArgs: SuccessfulSyncOp[][] = []
  const syncing = { value: false }
  const backoffAttempt = { value: 0 }
  let backoffUntil = 0
  const calls: Record<string, number> = {
    refresh: 0, onSettled: 0, reTrigger: 0, onAuthError: 0, onLockError: 0, emitFailureToast: 0,
  }

  const defaultDispatch = vi.fn(async (): Promise<DispatchResult> => undefined)

  const deps: DrainQueueDeps = {
    token: 'tok',
    now: () => 1_000_000,
    getQueue: () => queue,
    isOnline: () => true,
    getRecentlyCompleted: () => recentlyCompleted,
    getEditingPendingId: () => null,
    getBackoffUntil: () => backoffUntil,
    getBackoffAttempt: () => backoffAttempt.value,
    setBackoffAttempt: attempt => { backoffAttempt.value = attempt },
    random: () => 0.5, // centre of the jitter band, so waits are exact in tests
    getLastUnlockedTime: () => 0,
    isSyncing: () => syncing.value,
    mutateQueue: (updater) => {
      const next = updater(queue)
      queue.length = 0
      queue.push(...next)
    },
    resolveDispatch: () => defaultDispatch,
    setSyncing: (v) => { syncing.value = v },
    setActiveSyncId: (id) => { activeSyncIds.push(id) },
    setError: (message) => { errors.push(message) },
    setBackoff: (until) => {
      backoffUntil = until
      backoffSetTo.push(until)
    },
    addRecentlyCompleted: (o) => { recentlyCompleted.push(o) },
    removeRecentlyCompleted: (ids) => {
      for (let i = recentlyCompleted.length - 1; i >= 0; i--) {
        if (ids.has(recentlyCompleted[i].id)) recentlyCompleted.splice(i, 1)
      }
    },
    clearRecentlyCompleted: () => { recentlyCompleted.length = 0 },
    addFailedOp: (o) => { failedOps.push(o) },
    getSyncSuccessToast: () => ({ title: 'ok', message: 'done', tone: 'success' }),
    buildUndoAction: () => ({ label: 'Undo', onAction: () => {} }),
    emitToast: (copy, action) => { emittedToasts.push({ copy, hasUndo: !!action }) },
    emitFailureToast: () => { calls.emitFailureToast++ },
    onAuthError: () => { calls.onAuthError++ },
    onLockError: () => { calls.onLockError++ },
    refresh: async (successfulOps) => {
      calls.refresh++
      refreshArgs.push([...successfulOps])
    },
    onSettled: () => { calls.onSettled++ },
    reTrigger: () => { calls.reTrigger++ },
    ...overrides,
  }

  return {
    deps,
    queue,
    recentlyCompleted,
    failedOps,
    emittedToasts,
    calls,
    activeSyncIds,
    backoffSetTo,
    errors,
    refreshArgs,
    syncing,
    backoffAttempt,
  }
}

describe('computeBackoffMs', () => {
  it('keeps the first wait at the base so an ordinary cold start is covered promptly', () => {
    expect(computeBackoffMs(0, undefined, () => 0.5)).toBe(SERVER_WAKE_BACKOFF_MS)
  })

  it('doubles each consecutive failure and stops at the ceiling', () => {
    expect(computeBackoffMs(1, undefined, () => 0.5)).toBe(SERVER_WAKE_BACKOFF_MS * 2)
    expect(computeBackoffMs(2, undefined, () => 0.5)).toBe(SERVER_WAKE_BACKOFF_MS * 4)
    expect(computeBackoffMs(20, undefined, () => 0.5)).toBe(MAX_SYNC_BACKOFF_MS)
  })

  it('spreads the wait either side of the curve so clients do not retry in lockstep', () => {
    expect(computeBackoffMs(3, undefined, () => 0)).toBe(MAX_SYNC_BACKOFF_MS * 0.75)
    expect(computeBackoffMs(1, undefined, () => 0)).toBe(SERVER_WAKE_BACKOFF_MS * 2 * 0.75)
    expect(computeBackoffMs(2, undefined, () => 1)).toBe(SERVER_WAKE_BACKOFF_MS * 4 * 1.25)
  })

  it('prefers the server Retry-After, clamped at both ends', () => {
    expect(computeBackoffMs(0, 40_000, () => 0.5)).toBe(40_000)
    expect(computeBackoffMs(5, 0, () => 0.5)).toBe(1000)
    expect(computeBackoffMs(0, 9_999_999, () => 0.5)).toBe(MAX_SYNC_BACKOFF_MS)
  })
})

describe('drainQueue — guards', () => {
  it('does nothing without a token', async () => {
    const h = makeHarness({ token: null }, [op({})])
    await drainQueue(h.deps)
    expect(h.queue).toHaveLength(1)
    expect(h.calls.onSettled).toBe(0)
  })

  it('bails out if a drain is already in progress', async () => {
    const h = makeHarness({ isSyncing: () => true }, [op({})])
    await drainQueue(h.deps)
    expect(h.queue).toHaveLength(1)
  })

  it('flips the syncing flag on and off around the drain', async () => {
    const seen: boolean[] = []
    const h = makeHarness({ setSyncing: (v) => seen.push(v) })
    await drainQueue(h.deps)
    expect(seen).toEqual([true, false])
  })

  it('settles cleanly with an empty queue', async () => {
    const h = makeHarness()
    await drainQueue(h.deps)
    expect(h.calls.onSettled).toBe(1)
    expect(h.calls.refresh).toBe(0)
    expect(h.calls.reTrigger).toBe(0)
  })

  it('does not dispatch or consume retries while the browser is known to be offline', async () => {
    const dispatch = vi.fn(async (): Promise<DispatchResult> => undefined)
    const h = makeHarness(
      { isOnline: () => false, resolveDispatch: () => dispatch },
      [op({ id: 'offline', retryCount: MAX_RETRIES - 1 })],
    )

    await drainQueue(h.deps)

    expect(dispatch).not.toHaveBeenCalled()
    expect(h.queue[0].retryCount).toBe(MAX_RETRIES - 1)
    expect(h.failedOps).toEqual([])
    expect(h.errors.at(-1)).toContain('offline')
  })
})

describe('drainQueue — success path', () => {
  it('dispatches, removes the op, buffers it, toasts with undo, then refreshes', async () => {
    const dispatch = vi.fn(async (): Promise<DispatchResult> => undefined)
    const h = makeHarness({ resolveDispatch: () => dispatch }, [op({ id: 'a', targetId: 't1' })])
    await drainQueue(h.deps)

    expect(dispatch).toHaveBeenCalledOnce()
    expect(h.queue).toHaveLength(0)
    expect(h.recentlyCompleted).toHaveLength(0) // added then cleared post-refresh
    expect(h.emittedToasts).toEqual([{ copy: { title: 'ok', message: 'done', tone: 'success' }, hasUndo: true }])
    expect(h.calls.refresh).toBe(1)
    expect(h.refreshArgs[0]).toEqual([{ op: expect.objectContaining({ id: 'a' }), result: undefined }])
    expect(h.activeSyncIds).toEqual(['t1', null]) // set to op, cleared after success
  })

  it('does not attach an undo action for isUndo ops', async () => {
    const h = makeHarness({}, [op({ isUndo: true })])
    await drainQueue(h.deps)
    expect(h.emittedToasts[0].hasUndo).toBe(false)
  })

  it('emits no toast when there is no success-toast copy', async () => {
    const h = makeHarness({ getSyncSuccessToast: () => null }, [op({})])
    await drainQueue(h.deps)
    expect(h.emittedToasts).toHaveLength(0)
  })

  it('remaps queued wishlist ops to the server id after an add', async () => {
    const dispatchedTargets: Array<{ id: string; targetId: string }> = []
    const dispatch = vi.fn(async (o: QueuedOp): Promise<DispatchResult> => {
      dispatchedTargets.push({ id: o.id, targetId: o.targetId })
      return o.type === 'add' ? ({ id: 99 } as unknown as DispatchResult) : undefined
    })
    const h = makeHarness({ resolveDispatch: () => dispatch }, [
      op({ id: 'add', entity: 'wishlistItem', type: 'add', targetId: 'local-1' }),
      op({ id: 'upd', entity: 'wishlistItem', type: 'update', targetId: 'local-1' }),
    ])
    await drainQueue(h.deps)
    // The follow-up update was dispatched with its targetId rewritten local-1 -> 99.
    expect(dispatchedTargets).toEqual([
      { id: 'add', targetId: 'local-1' },
      { id: 'upd', targetId: '99' },
    ])
    expect(h.queue).toHaveLength(0)
  })

  // Same remap, for savingsGoal. It was omitted from the entity check, so an update
  // queued while the add was in flight (too late for enqueue to fold it into the add
  // payload) dispatched against the local placeholder and 404'd every time.
  it('remaps queued savings-goal ops to the server id after an add', async () => {
    const dispatchedTargets: Array<{ id: string; targetId: string }> = []
    const dispatch = vi.fn(async (o: QueuedOp): Promise<DispatchResult> => {
      dispatchedTargets.push({ id: o.id, targetId: o.targetId })
      return o.type === 'add' ? ({ id: 77 } as unknown as DispatchResult) : undefined
    })
    const h = makeHarness({ resolveDispatch: () => dispatch }, [
      op({ id: 'add', entity: 'savingsGoal', type: 'add', targetId: '1756000000000123' }),
      op({ id: 'upd', entity: 'savingsGoal', type: 'update', targetId: '1756000000000123' }),
    ])
    await drainQueue(h.deps)
    expect(dispatchedTargets).toEqual([
      { id: 'add', targetId: '1756000000000123' },
      { id: 'upd', targetId: '77' },
    ])
    expect(h.queue).toHaveLength(0)
  })

  it('projects a completed wishlist add with its server id while refresh is pending', async () => {
    let resolveRefresh!: () => void
    const refreshPending = new Promise<void>(resolve => { resolveRefresh = resolve })
    const h = makeHarness({
      resolveDispatch: () => vi.fn(async (): Promise<DispatchResult> => ({ id: 99 } as unknown as DispatchResult)),
      refresh: () => refreshPending,
    }, [op({ id: 'add', entity: 'wishlistItem', type: 'add', targetId: '-42', payload: { name: 'Camera' } })])

    const draining = drainQueue(h.deps)
    await vi.waitFor(() => expect(h.recentlyCompleted).toHaveLength(1))
    expect(h.recentlyCompleted[0]).toMatchObject({ targetId: '99', isCompleted: true })

    resolveRefresh()
    await draining
  })

  it('drains multiple ops in queue order', async () => {
    const order: string[] = []
    const dispatch = vi.fn(async (o: QueuedOp): Promise<DispatchResult> => { order.push(o.id); return undefined })
    const h = makeHarness({ resolveDispatch: () => dispatch }, [op({ id: 'a' }), op({ id: 'b' }), op({ id: 'c' })])
    await drainQueue(h.deps)
    expect(order).toEqual(['a', 'b', 'c'])
    expect(h.queue).toHaveLength(0)
  })

  it('preserves an op enqueued while a dispatch is awaiting (undo-during-sync)', async () => {
    let injected = false
    const h = makeHarness({}, [op({ id: 'a' })])
    const dispatch = vi.fn(async (o: QueuedOp): Promise<DispatchResult> => {
      if (o.id === 'a' && !injected) {
        injected = true
        h.deps.mutateQueue(prev => [...prev, op({ id: 'b' })])
      }
      return undefined
    })
    h.deps.resolveDispatch = () => dispatch
    await drainQueue(h.deps)
    expect(dispatch).toHaveBeenCalledTimes(2) // a, then the injected b
    expect(h.queue).toHaveLength(0)
  })
})

describe('drainQueue — break conditions', () => {
  it('stops before dispatching the op currently being edited', async () => {
    const dispatch = vi.fn(async (): Promise<DispatchResult> => undefined)
    const h = makeHarness({ resolveDispatch: () => dispatch, getEditingPendingId: () => 't1' }, [op({ targetId: 't1' })])
    await drainQueue(h.deps)
    expect(dispatch).not.toHaveBeenCalled()
    expect(h.queue).toHaveLength(1)
    expect(h.calls.reTrigger).toBe(0) // queue blocked by editing op, no re-trigger
  })

  it('stops while a sync backoff is active', async () => {
    const dispatch = vi.fn(async (): Promise<DispatchResult> => undefined)
    const h = makeHarness({ resolveDispatch: () => dispatch, now: () => 100, getBackoffUntil: () => 5000 }, [op({})])
    await drainQueue(h.deps)
    expect(dispatch).not.toHaveBeenCalled()
    expect(h.queue).toHaveLength(1)
    expect(h.calls.reTrigger).toBe(0) // queue backed off, no re-trigger
  })

  it('surfaces an op with no registered dispatch handler to failedOps instead of dropping it', async () => {
    const h = makeHarness({ resolveDispatch: () => undefined }, [op({ id: 'a' }), op({ id: 'b' })])
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await drainQueue(h.deps)
    expect(h.queue).toHaveLength(0) // removed from the live queue
    expect(h.calls.emitFailureToast).toBe(2) // but the user is told, not silently dropped
    expect(h.failedOps.map(o => o.id)).toEqual(['a', 'b'])
    expect(h.failedOps[0].lastError).toContain('No sync handler')
    spy.mockRestore()
  })
})

describe('drainQueue — error taxonomy', () => {
  function rejectingDispatch(message: string) {
    return () => vi.fn(async (): Promise<DispatchResult> => { throw new Error(message) })
  }

  it('logs out on a real 401 (not just-logged-in)', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const h = makeHarness({ resolveDispatch: rejectingDispatch('HTTP 401'), getLastUnlockedTime: () => 0, now: () => 1_000_000 }, [op({})])
    await drainQueue(h.deps)
    expect(h.calls.onAuthError).toBe(1)
    expect(h.queue).toHaveLength(1) // op untouched
    spy.mockRestore()
  })

  it('locks the session on a 423', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const h = makeHarness({ resolveDispatch: rejectingDispatch('HTTP 423 Locked') }, [op({})])
    await drainQueue(h.deps)
    expect(h.calls.onLockError).toBe(1)
    spy.mockRestore()
  })

  it('backs off (not logout) on a 401 that races a fresh login', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const h = makeHarness({ resolveDispatch: rejectingDispatch('401'), getLastUnlockedTime: () => 999_999, now: () => 1_000_000 }, [op({})])
    await drainQueue(h.deps)
    expect(h.calls.onAuthError).toBe(0)
    expect(h.backoffSetTo).toEqual([1_000_000 + AUTH_RACE_BACKOFF_MS])
    expect(h.queue).toHaveLength(1)
    spy.mockRestore()
  })

  it('bumps retry count and backs off on a transient failure', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const h = makeHarness({ resolveDispatch: rejectingDispatch('500 boom'), now: () => 1_000_000 }, [op({ id: 'a', retryCount: 1 })])
    await drainQueue(h.deps)
    expect(h.queue[0].retryCount).toBe(2)
    expect(h.backoffSetTo).toEqual([1_000_000 + SERVER_WAKE_BACKOFF_MS])
    expect(h.failedOps).toHaveLength(0)
    expect(h.calls.reTrigger).toBe(0) // backed off, no re-trigger
    spy.mockRestore()
  })

  it('describes an HTTP 500 as a server error while retrying', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const failure = Object.assign(new Error('Internal Server Error'), { status: 500 })
    const h = makeHarness(
      { resolveDispatch: () => async () => { throw failure }, now: () => 1_000_000 },
      [op({ id: 'server-error', retryCount: 0 })],
    )

    await drainQueue(h.deps)

    expect(h.queue).toHaveLength(1)
    expect(h.errors.at(-1)).toBe('Sync pending: Server error; retrying...')
    spy.mockRestore()
  })

  it.each([
    new TypeError('Failed to fetch'),
    Object.assign(new Error('Native request failed'), { status: 0 }),
    Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }),
  ])('keeps a known connection failure pending without consuming retry budget', async failure => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const dispatch = vi.fn(async (): Promise<DispatchResult> => { throw failure })
    const h = makeHarness(
      { resolveDispatch: () => dispatch, now: () => 1_000_000 },
      [op({ id: 'offline', retryCount: MAX_RETRIES - 1 })],
    )

    await drainQueue(h.deps)

    expect(h.queue).toHaveLength(1)
    expect(h.queue[0].retryCount).toBe(MAX_RETRIES - 1)
    expect(h.failedOps).toEqual([])
    expect(h.backoffSetTo).toEqual([1_000_000 + SERVER_WAKE_BACKOFF_MS])
    spy.mockRestore()
  })

  it.each([502, 503, 504])('keeps a service-wake %s pending without consuming retry budget', async status => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const failure = Object.assign(new Error(`HTTP ${status}`), { status })
    const h = makeHarness(
      { resolveDispatch: () => async () => { throw failure }, now: () => 1_000_000 },
      [op({ id: 'wake', retryCount: MAX_RETRIES - 1 })],
    )

    await drainQueue(h.deps)

    expect(h.queue[0].retryCount).toBe(MAX_RETRIES - 1)
    expect(h.failedOps).toEqual([])
    expect(h.backoffSetTo).toEqual([1_000_000 + SERVER_WAKE_BACKOFF_MS])
    spy.mockRestore()
  })

  it('uses an available HTTP status instead of a misleading network-like message', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const failure = Object.assign(new Error('Failed to fetch downstream data'), { status: 500 })
    const h = makeHarness(
      { resolveDispatch: () => async () => { throw failure } },
      [op({ id: 'server-error', retryCount: MAX_RETRIES - 1 })],
    )

    await drainQueue(h.deps)

    expect(h.queue).toEqual([])
    expect(h.failedOps).toHaveLength(1)
    expect(h.failedOps[0].retryCount).toBe(MAX_RETRIES)
    expect(h.errors.at(-1)).toBeNull()
    spy.mockRestore()
  })

  it('moves an op to failedOps after the retry ceiling and continues', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const h = makeHarness(
      { resolveDispatch: rejectingDispatch('500 boom') },
      [op({ id: 'a', retryCount: MAX_RETRIES - 1 }), op({ id: 'b', retryCount: MAX_RETRIES - 1 })]
    )
    await drainQueue(h.deps)
    expect(h.calls.emitFailureToast).toBe(2)
    expect(h.failedOps.map(o => o.id)).toEqual(['a', 'b'])
    expect(h.failedOps[0].retryCount).toBe(MAX_RETRIES)
    expect(h.queue).toHaveLength(0)
    spy.mockRestore()
  })

  it('escalates the wait across consecutive retryable failures and resets it on success', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const failure = Object.assign(new Error('Internal Server Error'), { status: 500 })
    const dispatch = vi.fn(async (): Promise<DispatchResult> => { throw failure })
    const h = makeHarness(
      // The real backoff timer clears the deadline between attempts; pin it open here so
      // each drain reaches dispatch and the escalation itself is what is under test.
      { resolveDispatch: () => dispatch, now: () => 1_000_000, getBackoffUntil: () => 0 },
      [op({ id: 'server-error' })],
    )

    await drainQueue(h.deps)
    await drainQueue(h.deps)
    await drainQueue(h.deps)

    expect(h.backoffSetTo).toEqual([
      1_000_000 + SERVER_WAKE_BACKOFF_MS,
      1_000_000 + SERVER_WAKE_BACKOFF_MS * 2,
      1_000_000 + SERVER_WAKE_BACKOFF_MS * 4,
    ])

    dispatch.mockResolvedValueOnce(undefined)
    await drainQueue(h.deps)
    expect(h.backoffAttempt.value).toBe(0)
    spy.mockRestore()
  })

  it('retries a 429 without consuming the op retry budget and honours Retry-After', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const failure = Object.assign(new Error('Too Many Requests'), { status: 429, retryAfterMs: 40_000 })
    const h = makeHarness(
      { resolveDispatch: () => async () => { throw failure }, now: () => 1_000_000 },
      [op({ id: 'busy', retryCount: MAX_RETRIES - 1 })],
    )

    await drainQueue(h.deps)

    expect(h.queue).toHaveLength(1)
    expect(h.queue[0].retryCount).toBe(MAX_RETRIES - 1)
    expect(h.failedOps).toEqual([])
    expect(h.backoffSetTo).toEqual([1_040_000])
    expect(h.errors.at(-1)).toBe('Sync pending: Server is busy; retrying...')
    spy.mockRestore()
  })

  it.each([408, 425])('retries a %s instead of discarding it as permanent', async status => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const failure = Object.assign(new Error(`HTTP ${status}`), { status })
    const h = makeHarness(
      { resolveDispatch: () => async () => { throw failure }, now: () => 1_000_000 },
      [op({ id: 'timeout', retryCount: 0 })],
    )

    await drainQueue(h.deps)

    expect(h.queue).toHaveLength(1)
    expect(h.queue[0].retryCount).toBe(1)
    expect(h.failedOps).toEqual([])
    spy.mockRestore()
  })

  it('escalates the post-sync refresh retry rather than re-reading a failing server flat', async () => {
    const h = makeHarness(
      {
        now: () => 1_000_000,
        getBackoffUntil: () => 0,
        refresh: async () => { throw Object.assign(new Error('Internal Server Error'), { status: 500 }) },
      },
      [op({ id: 'a' }), op({ id: 'b' })],
    )
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await drainQueue(h.deps)
    // Both ops synced (attempts cleared), then the refresh failed once.
    expect(h.backoffSetTo).toEqual([1_000_000 + SERVER_WAKE_BACKOFF_MS])

    await drainQueue(h.deps)
    expect(h.backoffSetTo.at(-1)).toBe(1_000_000 + SERVER_WAKE_BACKOFF_MS * 2)
    expect(h.recentlyCompleted).toHaveLength(2) // projection preserved for a later reconcile
    spy.mockRestore()
  })

  it('moves an op immediately to failedOps on a permanent 400 error and continues without retry', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const err = new Error('Bad Request') as Error & { status?: number }
    err.status = 400
    const dispatch = vi.fn(async (): Promise<DispatchResult> => { throw err })
    const h = makeHarness(
      { resolveDispatch: () => dispatch },
      [op({ id: 'a', retryCount: 0 }), op({ id: 'b', retryCount: 0 })]
    )
    await drainQueue(h.deps)
    expect(dispatch).toHaveBeenCalledTimes(2) // both are processed because 'a' doesn't block the queue
    expect(h.calls.emitFailureToast).toBe(2)
    expect(h.failedOps.map(o => o.id)).toEqual(['a', 'b'])
    expect(h.failedOps[0].retryCount).toBe(1)
    expect(h.queue).toHaveLength(0)
    spy.mockRestore()
  })

  // A missing or archived account is the one terminal 4xx the user can actually fix, so it must
  // reach the account review sheet rather than the generic "this change could not be saved".
  it('tags a ledger-account refusal for account review with the buckets it named', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const err = new Error('Choose an open account in the Rewards bucket.') as Error & {
      status?: number
      code?: string
      missingBuckets?: string[]
    }
    err.status = 400
    err.code = 'ledger_account_invalid'
    err.missingBuckets = ['Rewards']
    const h = makeHarness(
      { resolveDispatch: () => async (): Promise<DispatchResult> => { throw err } },
      [op({ id: 'a', retryCount: 0 })],
    )

    await drainQueue(h.deps)

    expect(h.failedOps).toHaveLength(1)
    expect(h.failedOps[0].needsAccountReview).toBe(true)
    expect(h.failedOps[0].needsAccountReviewBuckets).toEqual(['Rewards'])
    spy.mockRestore()
  })

  it('leaves an ordinary 400 untagged so it keeps the plain terminal-failure copy', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const err = new Error('Bad Request') as Error & { status?: number }
    err.status = 400
    const h = makeHarness(
      { resolveDispatch: () => async (): Promise<DispatchResult> => { throw err } },
      [op({ id: 'a', retryCount: 0 })],
    )

    await drainQueue(h.deps)

    expect(h.failedOps[0].needsAccountReview).toBeUndefined()
    spy.mockRestore()
  })

  it.each(['delete', 'unpurchase'] as const)('treats a replayed %s 404 as success', async type => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const err = new Error('Not Found') as Error & { status?: number }
    err.status = 404
    const h = makeHarness(
      { resolveDispatch: () => async () => { throw err } },
      [op({ id: 'gone', type })],
    )

    await drainQueue(h.deps)

    expect(h.queue).toEqual([])
    expect(h.failedOps).toEqual([])
    expect(h.calls.emitFailureToast).toBe(0)
    // A replayed/superseded delete still confirms success to the user, but offers no
    // Undo action -- the target row is already gone.
    expect(h.emittedToasts).toEqual([
      { copy: { title: 'ok', message: 'done', tone: 'success' }, hasUndo: false },
    ])
    spy.mockRestore()
  })
})

describe('drainQueue — settle', () => {
  it('retains completed optimistic ops after refresh failure and clears them after a later success', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    let now = 1_000_000
    let refreshAttempt = 0
    const h = makeHarness({
      now: () => now,
      refresh: async () => {
        refreshAttempt++
        if (refreshAttempt === 1) throw new TypeError('Failed to fetch')
      },
    }, [op({ id: 'committed', targetId: 'tx-1' })])

    await drainQueue(h.deps)

    expect(h.queue).toEqual([])
    expect(h.recentlyCompleted).toEqual([
      expect.objectContaining({ id: 'committed', isCompleted: true }),
    ])
    expect(h.backoffSetTo).toEqual([1_000_000 + SERVER_WAKE_BACKOFF_MS])

    now += SERVER_WAKE_BACKOFF_MS
    await drainQueue(h.deps)

    expect(refreshAttempt).toBe(2)
    expect(h.recentlyCompleted).toEqual([])
    spy.mockRestore()
  })

  it('skips refresh and settles completed ops when the batch does not require one', async () => {
    const h = makeHarness({
      shouldRefresh: () => false,
    }, [op({ id: 'preference', entity: 'settings', type: 'update', targetId: 'darkMode' })])

    await drainQueue(h.deps)

    expect(h.calls.refresh).toBe(0)
    expect(h.recentlyCompleted).toEqual([])
  })

  it.each([
    { status: 401, callback: 'onAuthError' as const },
    { status: 423, callback: 'onLockError' as const },
  ])('clears completed ops when post-sync refresh fails with $status', async ({ status, callback }) => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const failure = Object.assign(new Error(`HTTP ${status}`), { status })
    const h = makeHarness({
      getLastUnlockedTime: () => 0,
      refresh: async () => { throw failure },
    }, [op({ id: 'committed' })])

    await drainQueue(h.deps)

    expect(h.recentlyCompleted).toEqual([])
    expect(h.calls[callback]).toBe(1)
    expect(h.backoffSetTo).toEqual([])
    spy.mockRestore()
  })

  it('retains completed ops when a post-sync 401 races a fresh login', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const now = 1_000_000
    const failure = Object.assign(new Error('HTTP 401'), { status: 401 })
    const h = makeHarness({
      now: () => now,
      getLastUnlockedTime: () => now - 1_000,
      refresh: async () => { throw failure },
    }, [op({ id: 'committed' })])

    await drainQueue(h.deps)

    expect(h.recentlyCompleted).toEqual([
      expect.objectContaining({ id: 'committed', isCompleted: true }),
    ])
    expect(h.calls.onAuthError).toBe(0)
    expect(h.backoffSetTo).toEqual([now + AUTH_RACE_BACKOFF_MS])
    spy.mockRestore()
  })

  it('treats an aborted post-sync refresh as superseded, not failed', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const aborted = Object.assign(new Error('signal is aborted without reason'), { name: 'AbortError' })
    const h = makeHarness({ refresh: async () => { throw aborted } }, [op({ id: 'committed' })])

    await drainQueue(h.deps)

    // The superseding load commits fresher data; the projection is kept meanwhile.
    expect(h.recentlyCompleted).toEqual([
      expect.objectContaining({ id: 'committed', isCompleted: true }),
    ])
    expect(h.backoffSetTo).toEqual([])
    expect(h.calls.onAuthError).toBe(0)
    expect(h.calls.onLockError).toBe(0)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('does not re-trigger when queue is blocked by editing lock', async () => {
    const h = makeHarness({ getEditingPendingId: () => 't1' }, [op({ targetId: 't1' })])
    await drainQueue(h.deps)
    expect(h.calls.reTrigger).toBe(0)
  })

  it('re-triggers when a new op is enqueued during refresh', async () => {
    const h = makeHarness({}, [op({ id: 'a' })])
    h.deps.refresh = async () => {
      h.deps.mutateQueue(prev => [...prev, op({ id: 'b' })])
    }
    await drainQueue(h.deps)
    expect(h.calls.reTrigger).toBe(1)
  })

  it('does not re-trigger when the queue is fully drained', async () => {
    const h = makeHarness({}, [op({})])
    await drainQueue(h.deps)
    expect(h.calls.reTrigger).toBe(0)
    expect(h.calls.onSettled).toBe(1)
  })
})
