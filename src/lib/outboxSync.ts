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
import type { PayEarlyResult, RecurringSettlementResult } from '../types'
import type { ToastAction } from '../components/ui/ToastViewport'
import {
  getErrorMessage,
  getErrorName,
  getMissingBuckets,
  getRetryAfterMs,
  getStatus,
  isAuthError,
  isLedgerAccountRefusal,
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
/** First wait after any retryable failure; also the base of the escalation curve. */
export const SERVER_WAKE_BACKOFF_MS = 15000
/** Ceiling for the escalating wait. A dead backend is then polled twice a minute, not four times. */
export const MAX_SYNC_BACKOFF_MS = 120000
/** Fraction of the computed wait spread randomly, so many clients do not retry in lockstep. */
export const BACKOFF_JITTER_RATIO = 0.25

/**
 * Statuses in the 4xx range that are **not** a verdict on the request. 429 is the server
 * asking for a slower client, and 408/425 are the request never being read — replaying any
 * of them can succeed unchanged, so they must not be discarded as permanent validation
 * failures the way a 400 or a 422 is.
 */
const RETRYABLE_CLIENT_STATUSES: ReadonlySet<number> = new Set([408, 425, 429])

/**
 * Escalating wait for a failure that says nothing about the validity of the change.
 *
 * `attempt` counts *consecutive* backoff-inducing failures in this sync session, not the
 * op's retry budget: connection loss and service-wake responses deliberately never consume
 * that budget, so a flat wait meant an unreachable or permanently-failing backend was polled
 * every 15s forever. The first wait stays at the base so an ordinary Cloud Run cold start is
 * still covered promptly; only a failure that repeats starts backing away.
 *
 * A server-sent `Retry-After` wins outright — it is the only figure that knows when the next
 * attempt can succeed — but is still clamped to the same ceiling so a hostile or mistaken
 * header cannot strand queued changes.
 */
export function computeBackoffMs(
  attempt: number,
  retryAfterMs?: number,
  random: () => number = Math.random,
): number {
  if (retryAfterMs !== undefined) {
    return Math.min(Math.max(retryAfterMs, 1000), MAX_SYNC_BACKOFF_MS)
  }
  if (attempt <= 0) return SERVER_WAKE_BACKOFF_MS
  const escalated = Math.min(SERVER_WAKE_BACKOFF_MS * 2 ** attempt, MAX_SYNC_BACKOFF_MS)
  const jitter = escalated * BACKOFF_JITTER_RATIO * (random() * 2 - 1)
  return Math.max(SERVER_WAKE_BACKOFF_MS, Math.round(escalated + jitter))
}

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

/**
 * A missing or stale account is the one terminal failure the user can actually fix, so it must not
 * land in `failedOps` wearing the generic "this change could not be saved" copy. Tagging it here
 * routes it to the same account review sheet the one-shot placement migration uses, which is how
 * an op queued offline against an account that has since been archived becomes actionable instead
 * of a dead row the user can only discard.
 */
function accountReviewFlags(err: unknown): Partial<QueuedOp> {
  if (!isLedgerAccountRefusal(err)) return {}
  return { needsAccountReview: true, needsAccountReviewBuckets: getMissingBuckets(err) }
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

function retryMessage(status: number | undefined): string {
  if (status === 429) return 'Sync pending: Server is busy; retrying...'
  return status !== undefined && status >= 500 && status < 600
    ? 'Sync pending: Server error; retrying...'
    : 'Sync pending: Server is offline or waking up...'
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

function isRecurringSettlementResult(result: DispatchResult): result is RecurringSettlementResult {
  return Boolean(result && typeof result === 'object' && 'occurrence' in result)
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
          // No handler exists for this entity/type (e.g. a corrupted or migrated cache entry).
          // Surface it as a failed op with a toast rather than silently dropping it -- a silent
          // drop is invisible data loss, and it hides a real enqueue/migration bug from us.
          // Remove by id (never index): a concurrent enqueue may have shifted positions.
          const err = new Error(`No sync handler for ${nextOp.entity}:${nextOp.type}`)
          deps.emitFailureToast(nextOp, err)
          deps.mutateQueue(prev => prev.filter(item => item.id !== nextOp.id))
          deps.addFailedOp({ ...nextOp, lastError: getErrorMessage(err, String(err)) })
          deps.setError(null)
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

        clearBackoffAttempts()
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
        const isPermanentError = status !== undefined && status >= 400 && status < 500
          && status !== 401 && status !== 423 && !RETRYABLE_CLIENT_STATUSES.has(status)
        const online = isOnline()
        const isConnectionFailure = isNetworkFailure(err, online)
        // 429 joins the wake statuses rather than the counted-retry budget: the server is
        // healthy and explicitly asked for a later attempt, so spending the op's five
        // attempts against it would discard a valid change for being early.
        const isServerWaking = isServiceWakeFailure(status) || status === 429

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
            ? (status === 429 ? retryMessage(status) : 'Sync pending: Server is offline or waking up...')
            : 'Sync pending: You are offline. Changes will sync when your connection returns.')
          // Offline needs no timer at all -- the `online` event re-triggers the drain.
          deps.setBackoff(online ? scheduleBackoff(err) : 0)
          break
        } else if (isPermanentError) {
          // Permanent validation/logic error (e.g. 400 Bad Request) -- do not retry.
          // Move the op to failedOps immediately and continue the queue.
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
            // Bump retry on this op by id (not index 0) so a concurrently
            // enqueued op that jumped ahead doesn't get the retry count instead.
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
            // Preserve the completed optimistic projection and retry its reconciliation later
            // without hammering an unavailable server. This path has no attempt ceiling by
            // design -- giving up would strand the projection with nothing to reconcile it --
            // so the wait has to escalate, or a backend answering 500 to every read was
            // re-queried every 15 seconds indefinitely.
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
