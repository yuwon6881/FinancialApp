import { describe, expect, it, vi } from 'vitest'
import {
  drainQueue,
  MAX_RETRIES,
  AUTH_RACE_BACKOFF_MS,
  SERVER_WAKE_BACKOFF_MS,
  type DrainQueueDeps,
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
  syncing: { value: boolean }
}

function makeHarness(overrides: Partial<DrainQueueDeps> = {}, initialQueue: QueuedOp[] = []): Harness {
  const queue = [...initialQueue]
  const recentlyCompleted: QueuedOp[] = []
  const failedOps: QueuedOp[] = []
  const emittedToasts: Array<{ copy: ToastCopy; hasUndo: boolean }> = []
  const activeSyncIds: (string | null)[] = []
  const backoffSetTo: number[] = []
  const syncing = { value: false }
  const calls: Record<string, number> = {
    refresh: 0, onSettled: 0, reTrigger: 0, onAuthError: 0, onLockError: 0, emitFailureToast: 0,
  }

  const defaultDispatch = vi.fn(async (): Promise<DispatchResult> => undefined)

  const deps: DrainQueueDeps = {
    token: 'tok',
    now: () => 1_000_000,
    getQueue: () => queue,
    getEditingPendingId: () => null,
    getBackoffUntil: () => 0,
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
    setError: () => {},
    setBackoff: (until) => { backoffSetTo.push(until) },
    addRecentlyCompleted: (o) => { recentlyCompleted.push(o) },
    removeRecentlyCompleted: (ids) => {
      for (let i = recentlyCompleted.length - 1; i >= 0; i--) {
        if (ids.has(recentlyCompleted[i].id)) recentlyCompleted.splice(i, 1)
      }
    },
    addFailedOp: (o) => { failedOps.push(o) },
    getSyncSuccessToast: () => ({ title: 'ok', message: 'done', tone: 'success' }),
    buildUndoAction: () => ({ label: 'Undo', onAction: () => {} }),
    emitToast: (copy, action) => { emittedToasts.push({ copy, hasUndo: !!action }) },
    emitFailureToast: () => { calls.emitFailureToast++ },
    onAuthError: () => { calls.onAuthError++ },
    onLockError: () => { calls.onLockError++ },
    refresh: async () => { calls.refresh++ },
    onSettled: () => { calls.onSettled++ },
    reTrigger: () => { calls.reTrigger++ },
    ...overrides,
  }

  return { deps, queue, recentlyCompleted, failedOps, emittedToasts, calls, activeSyncIds, backoffSetTo, syncing }
}

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
    expect(h.calls.reTrigger).toBe(1) // queue non-empty at settle
  })

  it('stops while a sync backoff is active', async () => {
    const dispatch = vi.fn(async (): Promise<DispatchResult> => undefined)
    const h = makeHarness({ resolveDispatch: () => dispatch, now: () => 100, getBackoffUntil: () => 5000 }, [op({})])
    await drainQueue(h.deps)
    expect(dispatch).not.toHaveBeenCalled()
    expect(h.queue).toHaveLength(1)
  })

  it('drops an op with no registered dispatch handler and continues', async () => {
    const h = makeHarness({ resolveDispatch: () => undefined }, [op({ id: 'a' }), op({ id: 'b' })])
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await drainQueue(h.deps)
    expect(h.queue).toHaveLength(0) // both dropped
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
})

describe('drainQueue — settle', () => {
  it('re-triggers when ops remain after the drain settles', async () => {
    // Editing-lock leaves the op in the queue -> reTrigger fires.
    const h = makeHarness({ getEditingPendingId: () => 't1' }, [op({ targetId: 't1' })])
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
