import type { Transaction } from '../../types'
import type { OutboxPayload } from '../../lib/outbox'

const splitParentId = (id: string) => {
  const marker = id.indexOf('-split-')
  return marker < 0 ? id : id.slice(0, marker)
}

const cleanSnapshot = (transaction: Transaction): Transaction => {
  const snapshot = { ...transaction, id: splitParentId(String(transaction.id)) }
  delete snapshot.isPendingSync
  delete snapshot.isPendingDelete
  delete snapshot.pendingSyncOperationId
  return snapshot
}

export interface BulkTransactionDeleteRequest {
  targetId: string
  payload: OutboxPayload
}

/** Builds one serializable operation for a canonical set of Ledger parent rows. */
export function buildBulkTransactionDeleteRequest(
  transactions: readonly Transaction[],
): BulkTransactionDeleteRequest | null {
  const byParent = new Map<string, Transaction>()
  for (const transaction of transactions) {
    const parentId = splitParentId(String(transaction.id))
    if (transaction.savingsGoalId != null) continue
    const previous = byParent.get(parentId)
    // Prefer the parent row when both it and one of its generated split rows were selected.
    if (!previous || String(previous.id).includes('-split-')) {
      byParent.set(parentId, cleanSnapshot(transaction))
    }
  }
  if (byParent.size === 0 || byParent.size > 100) return null

  const targetId = `bulk-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  const snapshots = Array.from(byParent.values())
  const payload: OutboxPayload = {
    transactionIds: snapshots.map(transaction => splitParentId(String(transaction.id))),
    transactions: snapshots,
  }
  return { targetId, payload }
}
