import type { QueuedOp, DispatchResult } from './outbox'
import type { PayEarlyResult, RecurringSettlementResult } from '../types'
import {
  getErrorMessage,
  getMissingBuckets,
  getStatus,
  isLedgerAccountRefusal,
} from './errors'

export interface SuccessfulSyncOp {
  op: QueuedOp
  result: DispatchResult
}

/**
 * A missing or stale account is the one terminal failure the user can actually fix, so it must not
 * land in `failedOps` wearing the generic "this change could not be saved" copy. Tagging it here
 * routes it to the same account review sheet the one-shot placement migration uses, which is how
 * an op queued offline against an account that has since been archived becomes actionable instead
 * of a dead row the user can only discard.
 */
export function accountReviewFlags(err: unknown): Partial<QueuedOp> {
  if (!isLedgerAccountRefusal(err)) return {}
  return { needsAccountReview: true, needsAccountReviewBuckets: getMissingBuckets(err) }
}

export function isNetworkFailure(err: unknown, online: boolean): boolean {
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

export function isServiceWakeFailure(status: number | undefined): boolean {
  return status === 502 || status === 503 || status === 504
}

export function retryMessage(status: number | undefined): string {
  if (status === 429) return 'Sync pending: Server is busy; retrying...'
  return status !== undefined && status >= 500 && status < 600
    ? 'Sync pending: Server error; retrying...'
    : 'Sync pending: Server is offline or waking up...'
}

export function mergeCompletedOps(
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

export function isPayEarlyResult(result: DispatchResult): result is PayEarlyResult {
  return Boolean(
    result &&
    typeof result === 'object' &&
    'transaction' in result &&
    'settledOccurrenceDate' in result &&
    typeof result.settledOccurrenceDate === 'string',
  )
}

export function isRecurringSettlementResult(result: DispatchResult): result is RecurringSettlementResult {
  return Boolean(result && typeof result === 'object' && 'occurrence' in result)
}

/**
 * The most `transaction:add` ops the drain loop folds into one `bulk-create` call.
 *
 * This mirrors the server's own ceiling: `POST /transactions/bulk-create` rejects a larger list
 * outright. Without the cap, a queue built up offline past that ceiling made every drain send one
 * doomed oversized request, fall back to the single-op path, and then send the same oversized
 * request again on the next iteration -- so the batching that was meant to save round trips
 * doubled them, permanently, for exactly the backlog it exists to serve.
 */
export const MAX_BULK_ADD_BATCH = 100
