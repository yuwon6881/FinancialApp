import type { QueuedOp } from '../../lib/outbox'

/**
 * Keeps the Ledger's active ids scoped to operations that can actually own a transaction row.
 * Savings goals, accounts, and other direct mutations use the same global sync list, but their
 * numeric or string ids must never make an unrelated Ledger row look busy.
 */
export function getActiveTransactionSyncIds(
  activeOps: ReadonlyArray<QueuedOp>,
  activeSyncId: string | null,
): string[] {
  if (!activeSyncId) return []

  const ids: string[] = []
  for (const operation of activeOps) {
    if (operation.isCompleted) continue
    if (operation.targetId !== activeSyncId && operation.id !== activeSyncId) continue

    if (operation.entity === 'transaction') {
      ids.push(operation.targetId, operation.id)
    } else if (operation.entity === 'wishlistItem' && operation.type === 'purchase') {
      ids.push(
        operation.targetId,
        operation.id,
        `wishlist-purchase-${operation.targetId}`,
      )
    }
  }

  return Array.from(new Set(ids))
}
