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

import type { QueuedOp, DispatchResult, ToastCopy } from './outbox'
import type { ToastAction } from '../components/ui/ToastViewport'
import {
  getErrorMessage,
  getErrorName,
  getRetryAfterMs,
  getStatus,
  isAuthError,
  isLockError,
  JUST_LOGGED_IN_WINDOW_MS,
} from './errors'
import {
  AUTH_RACE_BACKOFF_MS,
  MAX_RETRIES,
  RETRYABLE_CLIENT_STATUSES,
  SERVER_ASSIGNED_ID_ENTITIES,
  computeBackoffMs,
} from './outboxRetryConstants'
import {
  type SuccessfulSyncOp,
  accountReviewFlags,
  isNetworkFailure,
  isPayEarlyResult,
  isRecurringSettlementResult,
  isServiceWakeFailure,
  mergeCompletedOps,
  retryMessage,
} from './outboxDrainHelpers'
import { beginRefreshHintCollection, type RefreshHintSummary } from './refreshSlices'

export * from './outboxRetryConstants'
export * from './outboxDrainHelpers'

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
  /**
   * Consecutive backoff-inducing failures since the last thing that worked. Kept outside the
   * queue because the paths that need it (connection loss, service wake, a failing post-sync
   * refresh) deliberately have no per-op retry budget to count. Absent deps behave as a
   * single attempt, i.e. the previous flat wait.
   */
  getBackoffAttempt?: () => number
  setBackoffAttempt?: (attempt: number) => void
  /** Injectable for deterministic jitter in tests. */
  random?: () => number

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
  // Optional, matching setActiveSyncOpId: the drain is exercised by harnesses that do not model
  // undo state at all, and a missing remap only costs an Undo button, never correctness.
  remapUndoSnapshot?: (entity: QueuedOp['entity'], fromTargetId: string, toTargetId: string) => void
  emitToast: (copy: ToastCopy, action: ToastAction | undefined) => void
  emitFailureToast: (op: QueuedOp, err: unknown) => void

  // --- terminal transitions ---
  onAuthError: () => void
  onLockError: () => void

  // --- post-drain ---
  /** Defaults to refreshing. Preference-only batches can opt out. */
  shouldRefresh?: (successfulOps: ReadonlyArray<SuccessfulSyncOp>) => boolean
  refresh: (successfulOps: ReadonlyArray<SuccessfulSyncOp>, hints?: RefreshHintSummary) => Promise<void>
  onSettled: () => void
  reTrigger: () => void
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
  const hintCollection = beginRefreshHintCollection()

  // One escalating wait shared by every retryable failure in this session, consumed on use
  // and cleared by anything that works, so a run of failures backs away while a recovered
  // server returns to the prompt base wait immediately.
  const scheduleBackoff = (err?: unknown): number => {
    const attempt = deps.getBackoffAttempt?.() ?? 0
    const wait = computeBackoffMs(attempt, getRetryAfterMs(err), deps.random)
    deps.setBackoffAttempt?.(attempt + 1)
    return deps.now() + wait
  }
  const clearBackoffAttempts = () => deps.setBackoffAttempt?.(0)

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
          const err = new Error(`No sync handler for ${nextOp.entity}:${nextOp.type}`)
          deps.emitFailureToast(nextOp, err)
          deps.mutateQueue(prev => prev.filter(item => item.id !== nextOp.id))
          deps.addFailedOp({
            ...nextOp,
            retryCount: (nextOp.retryCount || 0) + 1,
            lastError: getErrorMessage(err, String(err)),
          })
          deps.setError(null)
          deps.setActiveSyncOpId?.(null)
          continue
        }

        const result = await dispatchFn(nextOp)
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
        } else if (nextOp.entity === 'recurringOccurrence' && nextOp.type === 'settle' && isRecurringSettlementResult(result)) {
          completedOp = {
            ...nextOp,
            payload: {
              ...nextOp.payload,
              resultOccurrence: result.occurrence,
              resultTransaction: result.transaction,
              nextOccurrenceDate: result.nextOccurrenceDate,
            },
          }
        }
        deps.mutateQueue(prev => {
          let next = prev.filter(item => item.id !== nextOp.id)
          if (SERVER_ASSIGNED_ID_ENTITIES.has(nextOp.entity) && nextOp.type === 'add' && result && 'id' in result && result.id) {
            const realIdStr = String(result.id)
            completedOp = { ...nextOp, targetId: realIdStr }
            deps.remapUndoSnapshot?.(nextOp.entity, nextOp.targetId, realIdStr)
            next = next.map(op => (op.entity === nextOp.entity && op.targetId === nextOp.targetId)
              ? { ...op, targetId: realIdStr }
              : op)
          }
          return next
        })

        deps.addRecentlyCompleted({ ...completedOp, isCompleted: true })

        clearBackoffAttempts()
        deps.setError(null)
        processedAny = true
        successfulOps.push({ op: completedOp, result })

        deps.setActiveSyncId(null)

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

        if (!isIdempotentMissingDelete) {
          console.error(`Failed to sync ${nextOp.entity}:${nextOp.type}:`, err)
        }
        const isPermanentError = status !== undefined && status >= 400 && status < 500
          && status !== 401 && status !== 423 && !RETRYABLE_CLIENT_STATUSES.has(status)
        const online = isOnline()
        const isConnectionFailure = isNetworkFailure(err, online)
        const isServerWaking = isServiceWakeFailure(status) || status === 429

        if (isIdempotentMissingDelete) {
          deps.mutateQueue(prev => prev.filter(item => item.id !== nextOp.id))
          deps.addRecentlyCompleted({ ...nextOp, isCompleted: true })
          deps.setError(null)
          deps.setActiveSyncId(null)
          processedAny = true
          successfulOps.push({ op: nextOp, result: undefined })
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
          deps.setError('Sync pending: reconnecting...')
          deps.setBackoff(deps.now() + AUTH_RACE_BACKOFF_MS)
          break
        } else if (isConnectionFailure || isServerWaking) {
          deps.setError(online
            ? (status === 429 ? retryMessage(status) : 'Sync pending: Server is offline or waking up...')
            : 'Sync pending: You are offline. Changes will sync when your connection returns.')
          deps.setBackoff(online ? scheduleBackoff(err) : 0)
          break
        } else if (isPermanentError) {
          deps.emitFailureToast(nextOp, err)
          deps.mutateQueue(prev => prev.filter(item => item.id !== nextOp.id))
          deps.addFailedOp({
            ...nextOp,
            retryCount: (nextOp.retryCount || 0) + 1,
            lastError: getErrorMessage(err, String(err)),
            ...accountReviewFlags(err),
          })
          deps.setError(null)
          continue
        } else {
          const updatedRetryCount = (nextOp.retryCount || 0) + 1
          if (updatedRetryCount >= MAX_RETRIES) {
            deps.emitFailureToast(nextOp, err)
            deps.mutateQueue(prev => prev.filter(item => item.id !== nextOp.id))
            deps.addFailedOp({
              ...nextOp,
              retryCount: updatedRetryCount,
              lastError: getErrorMessage(err, String(err)),
              ...accountReviewFlags(err),
            })
            deps.setError(null)
            continue
          } else {
            deps.mutateQueue(prev => prev.map(item =>
              item.id === nextOp.id ? { ...item, retryCount: updatedRetryCount } : item
            ))
            deps.setError(retryMessage(status))
            deps.setBackoff(scheduleBackoff(err))
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
          await deps.refresh(completedOps, hintCollection.finish())
          refreshSucceeded = true
        } catch (refreshErr) {
          const isSuperseded = getErrorName(refreshErr) === 'AbortError'
          const isRefreshAuthError = !isSuperseded && isAuthError(refreshErr)
          const isRefreshLockError = !isSuperseded && isLockError(refreshErr)
          const isJustLoggedIn = deps.now() - deps.getLastUnlockedTime() < JUST_LOGGED_IN_WINDOW_MS
          if (!isSuperseded) console.error('Post-sync dashboard refresh failed:', refreshErr)

          if (isSuperseded) {
            // Superseded by newer load
          } else if (isRefreshAuthError && !isJustLoggedIn) {
            if (deps.clearRecentlyCompleted) deps.clearRecentlyCompleted()
            else deps.removeRecentlyCompleted(new Set(completedOps.map(({ op }) => op.id)))
            deps.onAuthError()
          } else if (isRefreshLockError) {
            if (deps.clearRecentlyCompleted) deps.clearRecentlyCompleted()
            else deps.removeRecentlyCompleted(new Set(completedOps.map(({ op }) => op.id)))
            deps.onLockError()
          } else {
            deps.setBackoff(isRefreshAuthError
              ? deps.now() + AUTH_RACE_BACKOFF_MS
              : scheduleBackoff(refreshErr))
          }
        }

        if (refreshSucceeded) {
          clearBackoffAttempts()
          if (deps.clearRecentlyCompleted) {
            deps.clearRecentlyCompleted()
          } else {
            deps.removeRecentlyCompleted(new Set(completedOps.map(({ op }) => op.id)))
          }
        }
      }
    }
  } finally {
    hintCollection.dispose()
    deps.onSettled()
    deps.setSyncing(false)
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
