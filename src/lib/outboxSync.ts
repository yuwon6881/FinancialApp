// Outbox drain-loop algorithm, extracted from App.tsx's processQueue().
//
// This is the heart of the offline-sync engine: it drains the pending-op queue
// head-first, dispatching each op, handling success (removal + wishlist id
// remap + success toast/undo), and the full error taxonomy (auth/lock/backoff/
// retry/permanent-failure). All React state, refs and I/O are injected as the
// `DrainQueueDeps` callbacks so the loop logic can be driven with fakes in
// tests -- the behaviour was previously entirely untested and impossible to
// exercise without rendering the whole app.
//
// The loop reads the *live* queue via `getQueue()` on every iteration (App
// backs this with a synchronous ref, not React state) so an op enqueued during
// an `await dispatch` -- e.g. an Undo tap -- is preserved rather than clobbered.

import type { EntityKind, QueuedOp, DispatchResult, ToastCopy } from './outbox'
import type { PayEarlyResult } from '../types'
import type { ToastAction } from '../components/ui/ToastViewport'
import {
  getErrorMessage,
  getErrorName,
  getStatus,
  isAuthError,
  isLockError,
  JUST_LOGGED_IN_WINDOW_MS,
} from './errors'

/**
 * Entities whose primary key the server assigns, so an optimistic row carries only a
 * local placeholder id until its `add` comes back. Every one of these must have that
 * placeholder remapped on success or later ops in the queue dispatch against an id the
 * server has never seen. Client-authored ids (transactions, investments, categories)
 * are already final and need no remap — do not add them here.
 */
export const SERVER_ASSIGNED_ID_ENTITIES: ReadonlySet<EntityKind> = new Set<EntityKind>([
  'wishlistItem',
  'savingsGoal',
  'taxReliefCategory',
])

export const MAX_RETRIES = 5
export const AUTH_RACE_BACKOFF_MS = 3000
export const SERVER_WAKE_BACKOFF_MS = 15000

export interface SuccessfulSyncOp {
  op: QueuedOp
  result: DispatchResult
}

export interface DrainQueueDeps {
  token: string | null
  now: () => number

  // --- synchronous queue/ref reads ---
  getQueue: () => QueuedOp[]
  /** Browser/network reachability. Omitted by non-browser callers that are always online. */
  isOnline?: () => boolean
  /** Completed mutations still projected while their server refresh is pending. */
  getRecentlyCompleted?: () => QueuedOp[]
  getEditingPendingId: () => string | null
  getBackoffUntil: () => number
  getLastUnlockedTime: () => number
  isSyncing: () => boolean

  // --- queue mutation ---

  // --- queue mutation ---
  mutateQueue: (updater: (prev: QueuedOp[]) => QueuedOp[]) => void

  // --- dispatch ---
  /** Resolve the dispatcher for an op, or undefined if none is registered. */
  resolveDispatch: (op: QueuedOp) => ((op: QueuedOp) => Promise<DispatchResult>) | undefined

  // --- lifecycle / UI side effects ---
  setSyncing: (v: boolean) => void
  setActiveSyncId: (id: string | null) => void
  setActiveSyncOpId?: (id: string | null) => void
  setError: (msg: string | null) => void
  setBackoff: (until: number) => void
  addRecentlyCompleted: (op: QueuedOp) => void
  removeRecentlyCompleted: (ids: Set<string>) => void
  /** A successful server refresh reconciles every retained completed operation. */
  clearRecentlyCompleted?: () => void
  addFailedOp: (op: QueuedOp) => void

  // --- toasts / undo ---
  getSyncSuccessToast: (op: QueuedOp) => ToastCopy | null
  buildUndoAction: (op: QueuedOp, result: DispatchResult) => ToastAction | undefined
  emitToast: (copy: ToastCopy, action: ToastAction | undefined) => void
  emitFailureToast: (op: QueuedOp, err: unknown) => void

  // --- terminal transitions ---
  onAuthError: () => void
  onLockError: () => void

  // --- post-drain ---
  /** Defaults to refreshing. Preference-only batches can opt out. */
  shouldRefresh?: (successfulOps: ReadonlyArray<SuccessfulSyncOp>) => boolean
  refresh: (successfulOps: ReadonlyArray<SuccessfulSyncOp>) => Promise<void>
  onSettled: () => void
  reTrigger: () => void
}

function isNetworkFailure(err: unknown, online: boolean): boolean {
  const status = getStatus(err)
  // A real HTTP response always wins over a message such as "Failed to fetch".
  // Status 0 is conventionally used by native/web wrappers for no response.
  if (status !== undefined) return status === 0
  if (!online) return true

  if (err && typeof err === 'object') {
    const name = 'name' in err && typeof err.name === 'string' ? err.name : ''
    if (name === 'NetworkError') return true

    const code = 'code' in err && typeof err.code === 'string' ? err.code.toUpperCase() : ''
    if (['ERR_NETWORK', 'ECONNABORTED', 'ECONNREFUSED', 'ECONNRESET', 'ENETUNREACH', 'ENOTFOUND', 'ETIMEDOUT'].includes(code)) {
      return true
    }
  }

  const message = getErrorMessage(err, '').toLowerCase()
  return message.includes('failed to fetch')
    || message.includes('fetch failed')
    || message.includes('network request failed')
    || message.includes('networkerror')
    || message.includes('load failed')
}

function isServiceWakeFailure(status: number | undefined): boolean {
  return status === 502 || status === 503 || status === 504
}

function mergeCompletedOps(
  retainedOps: ReadonlyArray<QueuedOp>,
  successfulOps: ReadonlyArray<SuccessfulSyncOp>,
): SuccessfulSyncOp[] {
  const currentById = new Map(successfulOps.map(item => [item.op.id, item]))
  const merged: SuccessfulSyncOp[] = retainedOps.map(op => currentById.get(op.id) ?? { op, result: undefined })
  const seen = new Set(retainedOps.map(op => op.id))
  for (const item of successfulOps) {
    if (!seen.has(item.op.id)) merged.push(item)
  }
  return merged
}

function isPayEarlyResult(result: DispatchResult): result is PayEarlyResult {
  return Boolean(
    result &&
    typeof result === 'object' &&
    'transaction' in result &&
    'settledOccurrenceDate' in result &&
    typeof result.settledOccurrenceDate === 'string',
  )
}

/**
 * Drain the pending-op queue. Mirrors the original processQueue() exactly;
 * safe to call re-entrantly (guards on `isSyncing()`).
 */
export async function drainQueue(deps: DrainQueueDeps): Promise<void> {
  if (!deps.token || deps.isSyncing()) return
  const isOnline = () => deps.isOnline?.() ?? true
  if (!isOnline()) {
    deps.setError('Sync pending: You are offline. Changes will sync when your connection returns.')
    return
  }
  deps.setSyncing(true)

  let processedAny = false
  const successfulOps: SuccessfulSyncOp[] = []

  try {
    while (true) {
      const queue = deps.getQueue()
      const nextOp = queue[0]
      if (!nextOp) break

      if (!isOnline()) {
        deps.setError('Sync pending: You are offline. Changes will sync when your connection returns.')
        break
      }

      const editingId = deps.getEditingPendingId()
      if (nextOp.targetId === editingId || nextOp.id === editingId) {
        break
      }

      if (deps.now() < deps.getBackoffUntil()) {
        break
      }

      deps.setActiveSyncId(nextOp.targetId)
      deps.setActiveSyncOpId?.(nextOp.id)

      try {
        const dispatchFn = deps.resolveDispatch(nextOp)
        if (!dispatchFn) {
          console.error(`No dispatch handler for ${nextOp.entity}:${nextOp.type}`)
          // No handler exists for this entity/type (e.g. a corrupted or migrated cache entry).
          // Surface it as a failed op with a toast rather than silently dropping it -- a silent
          // drop is invisible data loss, and it hides a real enqueue/migration bug from us.
          // Remove by id (never index): a concurrent enqueue may have shifted positions.
          const err = new Error(`No sync handler for ${nextOp.entity}:${nextOp.type}`)
          deps.emitFailureToast(nextOp, err)
          deps.mutateQueue(prev => prev.filter(item => item.id !== nextOp.id))
          deps.addFailedOp({ ...nextOp, lastError: getErrorMessage(err, String(err)) })
          deps.setActiveSyncOpId?.(null)
          continue
        }

        const result = await dispatchFn(nextOp)
        deps.setActiveSyncOpId?.(null)

        // Functional removal keyed off the live queue, so any op enqueued during
        // the await above (e.g. an Undo tap) is preserved rather than clobbered.
        let completedOp = nextOp
        if (nextOp.entity === 'recurringPayment' && nextOp.type === 'payEarly' && isPayEarlyResult(result)) {
          completedOp = {
            ...nextOp,
            payload: {
              ...nextOp.payload,
              resultTransaction: result.transaction,
              settledOccurrenceDate: result.settledOccurrenceDate,
              nextOccurrenceDate: result.nextOccurrenceDate,
            },
          }
        }
        deps.mutateQueue(prev => {
          let next = prev.filter(item => item.id !== nextOp.id)
          // Every entity whose PK the *server* mints needs this remap, not just some of
          // them: savingsGoal was missing, so an update or delete queued while its add
          // was still in flight (too late for enqueue to merge into the add payload)
          // kept the local placeholder id and dispatched a guaranteed 404.
          if (SERVER_ASSIGNED_ID_ENTITIES.has(nextOp.entity) && nextOp.type === 'add' && result && 'id' in result && result.id) {
            const realIdStr = String(result.id)
            // The completed add remains in the optimistic projection until refresh
            // finishes. Give that temporary row its server id too, otherwise a user
            // action during this window can enqueue a DELETE for the negative local id.
            completedOp = { ...nextOp, targetId: realIdStr }
            next = next.map(op => (op.entity === nextOp.entity && op.targetId === nextOp.targetId)
              ? { ...op, targetId: realIdStr }
              : op)
          }
          return next
        })

        deps.addRecentlyCompleted({ ...completedOp, isCompleted: true })

        deps.setError(null)
        processedAny = true
        successfulOps.push({ op: completedOp, result })

        deps.setActiveSyncId(null)

        // Fire this op's toast as soon as its own dispatch resolves. Undo actions
        // are built eagerly, here, so the snapshot read/delete in buildUndoAction
        // happens before a later action in this same batch can overwrite the same key.
        const toastMsg = deps.getSyncSuccessToast(nextOp)
        if (toastMsg) {
          const undoAction = nextOp.isUndo ? undefined : deps.buildUndoAction(nextOp, result)
          deps.emitToast(toastMsg, undoAction)
        }
      } catch (err: unknown) {
        deps.setActiveSyncOpId?.(null)
        const status = getStatus(err)
        const authError = isAuthError(err)
        const lockError = isLockError(err)
        const isJustLoggedIn = deps.now() - deps.getLastUnlockedTime() < JUST_LOGGED_IN_WINDOW_MS
        const isIdempotentMissingDelete = status === 404 &&
          (nextOp.type === 'delete' || nextOp.type === 'unpurchase' || nextOp.type === 'bulkDelete')
        // A 404 on a delete/unpurchase is an expected, benign outcome (the row was
        // already gone — e.g. deleting a stale/optimistic item, or an undo chain).
        // It resolves to a success below, so don't log it as an error and pollute
        // the console; genuine sync failures still log.
        if (!isIdempotentMissingDelete) {
          console.error(`Failed to sync ${nextOp.entity}:${nextOp.type}:`, err)
        }
        const isPermanentError = status !== undefined && status >= 400 && status < 500 && status !== 401 && status !== 423
        const online = isOnline()
        const isConnectionFailure = isNetworkFailure(err, online)
        const isServerWaking = isServiceWakeFailure(status)

        if (isIdempotentMissingDelete) {
          deps.mutateQueue(prev => prev.filter(item => item.id !== nextOp.id))
          deps.addRecentlyCompleted({ ...nextOp, isCompleted: true })
          deps.setError(null)
          deps.setActiveSyncId(null)
          processedAny = true
          successfulOps.push({ op: nextOp, result: undefined })
          // The row was already gone server-side, so the op still succeeded from the
          // user's perspective (e.g. an undo-purchase whose item a prior undo already
          // deleted). Confirm it with the same success toast the happy path fires --
          // but never an Undo action, since the target no longer exists to act on.
          const toastMsg = deps.getSyncSuccessToast(nextOp)
          if (toastMsg) deps.emitToast(toastMsg, undefined)
          continue
        } else if (authError && !isJustLoggedIn) {
          deps.onAuthError()
          break
        } else if (lockError) {
          deps.onLockError()
          break
        } else if (authError) {
          // A spurious 401 can race a fresh login -- wait it out without
          // burning a retry or moving the op to failedOps.
          deps.setError('Sync pending: reconnecting...')
          deps.setBackoff(deps.now() + AUTH_RACE_BACKOFF_MS)
          break
        } else if (isConnectionFailure || isServerWaking) {
          // No server response (or a gateway/service-wake response) says nothing
          // about the validity of the user's change. Keep it pending indefinitely
          // and retry after connectivity returns/a short wake-up delay.
          deps.setError(online
            ? 'Sync pending: Server is offline or waking up...'
            : 'Sync pending: You are offline. Changes will sync when your connection returns.')
          deps.setBackoff(online ? deps.now() + SERVER_WAKE_BACKOFF_MS : 0)
          break
        } else if (isPermanentError) {
          // Permanent validation/logic error (e.g. 400 Bad Request) -- do not retry.
          // Move the op to failedOps immediately and continue the queue.
          deps.emitFailureToast(nextOp, err)
          deps.mutateQueue(prev => prev.filter(item => item.id !== nextOp.id))
          deps.addFailedOp({ ...nextOp, retryCount: (nextOp.retryCount || 0) + 1, lastError: getErrorMessage(err, String(err)) })
          continue
        } else {
          const updatedRetryCount = (nextOp.retryCount || 0) + 1
          if (updatedRetryCount >= MAX_RETRIES) {
            deps.emitFailureToast(nextOp, err)
            deps.mutateQueue(prev => prev.filter(item => item.id !== nextOp.id))
            deps.addFailedOp({ ...nextOp, retryCount: updatedRetryCount, lastError: getErrorMessage(err, String(err)) })
            continue
          } else {
            // Bump retry on this op by id (not index 0) so a concurrently
            // enqueued op that jumped ahead doesn't get the retry count instead.
            deps.mutateQueue(prev => prev.map(item =>
              item.id === nextOp.id ? { ...item, retryCount: updatedRetryCount } : item
            ))
            deps.setError('Sync pending: Server is offline or waking up...')
            deps.setBackoff(deps.now() + SERVER_WAKE_BACKOFF_MS)
            break
          }
        }
      }
    }

    const retainedOps = deps.getRecentlyCompleted?.() ?? []
    const completedOps = mergeCompletedOps(retainedOps, successfulOps)
    if ((processedAny || completedOps.length > 0) && deps.now() >= deps.getBackoffUntil()) {
      const shouldRefresh = deps.shouldRefresh?.(completedOps) ?? true
      if (!shouldRefresh) {
        deps.removeRecentlyCompleted(new Set(completedOps.map(({ op }) => op.id)))
      } else {
        let refreshSucceeded = false
        try {
          await deps.refresh(completedOps)
          refreshSucceeded = true
        } catch (refreshErr) {
          const isSuperseded = getErrorName(refreshErr) === 'AbortError'
          const isRefreshAuthError = !isSuperseded && isAuthError(refreshErr)
          const isRefreshLockError = !isSuperseded && isLockError(refreshErr)
          const isJustLoggedIn = deps.now() - deps.getLastUnlockedTime() < JUST_LOGGED_IN_WINDOW_MS
          if (!isSuperseded) console.error('Post-sync dashboard refresh failed:', refreshErr)

          if (isSuperseded) {
            // Not a failure: `loadAll` aborts the in-flight request before starting its own,
            // so any newer load (a cycle change, a later drain, session teardown) supersedes
            // this reconciliation and commits fresher data than it would have. Backing off
            // here charged the healthy case a 15s stall plus an "offline" banner, and logged
            // a console error for a routine race. The completed ops stay projected until the
            // superseding load lands or they expire.
          } else if (isRefreshAuthError && !isJustLoggedIn) {
            if (deps.clearRecentlyCompleted) deps.clearRecentlyCompleted()
            else deps.removeRecentlyCompleted(new Set(completedOps.map(({ op }) => op.id)))
            deps.onAuthError()
          } else if (isRefreshLockError) {
            if (deps.clearRecentlyCompleted) deps.clearRecentlyCompleted()
            else deps.removeRecentlyCompleted(new Set(completedOps.map(({ op }) => op.id)))
            deps.onLockError()
          } else {
            // Preserve the completed optimistic projection and retry its
            // reconciliation later without hammering an unavailable server.
            deps.setBackoff(deps.now() + (isRefreshAuthError ? AUTH_RACE_BACKOFF_MS : SERVER_WAKE_BACKOFF_MS))
          }
        }

        if (refreshSucceeded) {
          if (deps.clearRecentlyCompleted) {
            deps.clearRecentlyCompleted()
          } else {
            deps.removeRecentlyCompleted(new Set(completedOps.map(({ op }) => op.id)))
          }
        }
      }
    }
  } finally {
    deps.onSettled()
    deps.setSyncing(false)
    // Lost-wakeup guard: ops that arrived while the lock was held returned early;
    // now that it's free, re-trigger once if anything is still waiting, and we
    // are not backed off or editing the next item.
    const queue = deps.getQueue()
    const nextOp = queue[0]
    const editingId = deps.getEditingPendingId()
    const isEditing = nextOp && (nextOp.targetId === editingId || nextOp.id === editingId)
    const isBackedOff = deps.now() < deps.getBackoffUntil()
    const hasPendingRefresh = (deps.getRecentlyCompleted?.().length ?? 0) > 0

    if ((queue.length > 0 || hasPendingRefresh) && !isEditing && !isBackedOff && isOnline()) {
      deps.reTrigger()
    }
  }
}
