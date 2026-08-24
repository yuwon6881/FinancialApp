import { splitParentId } from './incomeSplitProjection'
import { expandBulkTransactionProjection } from './outbox'
import type { QueuedOp } from './outboxTypes'

/**
 * The transaction ids still owned by an in-flight or just-completed operation.
 *
 * A bulk operation's `targetId` is synthetic (`move-<timestamp>`), so it never matches a row.
 * Expanding the operation the same way the projection does is what turns it back into real row
 * ids -- keying retention on `targetId` instead is why moved rows used to blink out between
 * dispatch and the refresh that replaces them.
 *
 * `directIds` carries the sync paths that bypass the outbox, where the id already is a row id.
 */
export function collectOptimisticTransactionIds(
  ops: readonly QueuedOp[],
  directIds?: ReadonlySet<string>,
): Set<string> {
  const owned = new Set<string>(directIds ?? [])
  const transactionOps = ops.filter(op => op.entity === 'transaction')
  for (const op of expandBulkTransactionProjection(transactionOps as QueuedOp[])) {
    owned.add(String(op.targetId))
  }
  return owned
}

/**
 * Whether a row belongs to an owned operation, directly or as one of an Income parent's generated
 * split rows -- those are re-derived from the parent, so they are only ever owned through it.
 */
export function isOptimisticRow(transactionId: string, owned: ReadonlySet<string>): boolean {
  if (owned.has(transactionId)) return true
  const parentId = splitParentId(transactionId)
  return parentId !== null && owned.has(parentId)
}
