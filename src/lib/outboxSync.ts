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
import { errorMessageIncludes, errorMessageIncludesLower, getErrorMessage } from './errors'

export const MAX_RETRIES = 5
export const AUTH_RACE_BACKOFF_MS = 3000
export const SERVER_WAKE_BACKOFF_MS = 15000
/** A 401 within this window of a fresh unlock/login is treated as a race, not a real auth failure. */
export const JUST_LOGGED_IN_WINDOW_MS = 10000

export interface DrainQueueDeps {
  token: string | null
  now: () => number

  // --- synchronous queue/ref reads ---
  getQueue: () => QueuedOp[]
  getEditingPendingId: () => string | null
  getBackoffUntil: () => number
  getLastUnlockedTime: () => number
  isSyncing: () => boolean

  // --- queue mutation ---
  mutateQueue: (updater: (prev: QueuedOp[]) => QueuedOp[]) => void

  // --- dispatch ---
  /** Resolve the dispatcher for an op, or undefined if none is registered. */
  resolveDispatch: (op: QueuedOp) => ((op: QueuedOp) => Promise<DispatchResult>) | undefined

  // --- lifecycle / UI side effects ---
  setSyncing: (v: boolean) => void
  setActiveSyncId: (id: string | null) => void
  setError: (msg: string | null) => void
  setBackoff: (until: number) => void
  addRecentlyCompleted: (op: QueuedOp) => void
  removeRecentlyCompleted: (ids: Set<string>) => void
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
  refresh: () => Promise<void>
  onSettled: () => void
  reTrigger: () => void
}

/**
 * Drain the pending-op queue. Mirrors the original processQueue() exactly;
 * safe to call re-entrantly (guards on `isSyncing()`).
 */
export async function drainQueue(deps: DrainQueueDeps): Promise<void> {
  if (!deps.token || deps.isSyncing()) return
  deps.setSyncing(true)

  let processedAny = false
  const successfulOps: Array<{ op: QueuedOp; result: DispatchResult }> = []

  try {
    while (true) {
      const queue = deps.getQueue()
      const nextOp = queue[0]
      if (!nextOp) break

      const editingId = deps.getEditingPendingId()
      if (nextOp.targetId === editingId || nextOp.id === editingId) {
        break
      }

      if (deps.now() < deps.getBackoffUntil()) {
        break
      }

      deps.setActiveSyncId(nextOp.targetId)

      try {
        const dispatchFn = deps.resolveDispatch(nextOp)
        if (!dispatchFn) {
          console.error(`No dispatch handler for ${nextOp.entity}:${nextOp.type}`)
          // Drop just this op by id (never by index): a concurrent enqueue may
          // have shifted positions while we were in this iteration.
          deps.mutateQueue(prev => prev.filter(item => item.id !== nextOp.id))
          continue
        }

        const result = await dispatchFn(nextOp)

        // Functional removal keyed off the live queue, so any op enqueued during
        // the await above (e.g. an Undo tap) is preserved rather than clobbered.
        deps.mutateQueue(prev => {
          let next = prev.filter(item => item.id !== nextOp.id)
          if (nextOp.entity === 'wishlistItem' && nextOp.type === 'add' && result && 'id' in result && result.id) {
            const realIdStr = String(result.id)
            next = next.map(op => (op.entity === 'wishlistItem' && op.targetId === nextOp.targetId)
              ? { ...op, targetId: realIdStr }
              : op)
          }
          return next
        })

        deps.addRecentlyCompleted({ ...nextOp, isCompleted: true })

        deps.setError(null)
        processedAny = true
        successfulOps.push({ op: nextOp, result })

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
        console.error(`Failed to sync ${nextOp.entity}:${nextOp.type}:`, err)
        const isAuthError = errorMessageIncludes(err, '401') || errorMessageIncludesLower(err, 'unauthorized')
        const isLockError = errorMessageIncludes(err, '423')
        const isJustLoggedIn = deps.now() - deps.getLastUnlockedTime() < JUST_LOGGED_IN_WINDOW_MS
        const status = err && typeof err === 'object' && 'status' in err && typeof err.status === 'number' ? err.status : undefined
        const isPermanentError = status !== undefined && status >= 400 && status < 500 && status !== 401 && status !== 423

        if (isAuthError && !isJustLoggedIn) {
          deps.onAuthError()
          break
        } else if (isLockError) {
          deps.onLockError()
          break
        } else if (isAuthError) {
          // A spurious 401 can race a fresh login -- wait it out without
          // burning a retry or moving the op to failedOps.
          deps.setError('Sync pending: reconnecting...')
          deps.setBackoff(deps.now() + AUTH_RACE_BACKOFF_MS)
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

    if (processedAny) {
      try {
        await deps.refresh()
      } catch (refreshErr) {
        console.error('Post-sync dashboard refresh failed:', refreshErr)
      }

      const completedIds = new Set(successfulOps.map(({ op }) => op.id))
      deps.removeRecentlyCompleted(completedIds)
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

    if (queue.length > 0 && !isEditing && !isBackedOff) {
      deps.reTrigger()
    }
  }
}
