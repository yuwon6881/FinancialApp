import type { Transaction } from '../types'
import type { EntityKind, OutboxPayload, QueuedOp } from './outboxTypes'
import { OPTIMISTIC_LIST_ORDER_POLICIES } from './outboxItemOrder'
import { ProjectionRows, type ApplyOpsOptions, type ProjectionRow } from './outboxProjectionRows'
import { applyCrossEntityOp } from './outboxCrossEntityProjection'
import { applyEntityOp } from './outboxEntityProjection'

// The outbox is split by responsibility: `outboxTypes` (queue shape), `outboxIds`,
// `outboxItemOrder` (canonical list ordering), `outboxToasts` (user-facing copy),
// `outboxEnqueue` (queue algebra and collapsing), `outboxSettingProjection`,
// `outboxProjectionRows` (the row set a replay mutates), `outboxCrossEntityProjection` plus
// `outboxEntityProjection` (the replay itself) and `outboxSanitize` (cached-queue hygiene).
// Call sites import from here, so the re-exports below are the stable public surface.
export * from './outboxTypes'
export * from './outboxIds'
export * from './outboxItemOrder'
export * from './outboxToasts'
export * from './outboxEnqueue'
export * from './outboxSettingProjection'
export * from './outboxProjectionRows'
export * from './outboxSanitize'

export function expandBulkTransactionProjection(ops: QueuedOp[]): QueuedOp[] {
  return ops.flatMap(op => {
    if (op.entity !== 'transaction' || !['bulkDelete', 'bulkRestore', 'bulkMove'].includes(op.type)) return [op]
    const snapshots = Array.isArray(op.payload?.transactions)
      ? op.payload.transactions.filter((item): item is Partial<Transaction> & { id: string | number } => Boolean(item && typeof item === 'object' && 'id' in item))
      : []
    if (op.type === 'bulkRestore') {
      return snapshots.map(snapshot => ({
        ...op,
        type: 'add' as const,
        targetId: String(snapshot.id),
        payload: {
          ...snapshot,
          pendingSyncOperationId: op.isCompleted ? undefined : op.id,
        } as OutboxPayload,
      }))
    }
    if (op.type === 'bulkMove') {
      const moves = Array.isArray(op.payload?.moves) ? op.payload.moves : []
      const snapshotById = new Map(snapshots.map(snapshot => [String(snapshot.id), snapshot] as const))
      return moves.flatMap((move): QueuedOp[] => {
        if (!move || typeof move !== 'object' || !('id' in move) || !('targetDate' in move)) return []
        const moveId = String(move.id)
        const targetDate = String(move.targetDate)
        // A bulk targetId is synthetic, so the row has to carry the operation id itself for the
        // per-row syncing badge to resolve -- the generated split rows already get it from
        // splitRowState, and without this the parent is the only row with no status.
        const pendingSyncOperationId = op.isCompleted ? undefined : op.id
        const snapshot = snapshotById.get(moveId)
        if (snapshot) {
          // Undo lands here when the parent has already left the visible list: an `update` is a
          // no-op against a row that is absent, so re-insert it the way bulkRestore does.
          return [{
            ...op,
            type: 'add' as const,
            targetId: moveId,
            payload: { ...snapshot, date: targetDate, pendingSyncOperationId } as OutboxPayload,
          }]
        }
        return [{
          ...op,
          type: 'update' as const,
          targetId: moveId,
          payload: { date: targetDate, pendingSyncOperationId },
        }]
      })
    }
    const ids = Array.isArray(op.payload?.transactionIds) ? op.payload.transactionIds.map(String).filter(Boolean) : []
    const snapshotById = new Map(snapshots.map(snapshot => {
      const snapshotId = String(snapshot.id)
      const splitMarker = snapshotId.indexOf('-split-')
      return [splitMarker < 0 ? snapshotId : snapshotId.slice(0, splitMarker), snapshot] as const
    }))
    return Array.from(new Set(ids)).map(id => {
      const snapshot = snapshotById.get(id)
      return {
        ...op,
        type: 'delete' as const,
        targetId: id,
        isCompleted: op.isCompleted,
        payload: snapshot ? { ...snapshot } as OutboxPayload : op.payload,
      }
    })
  })
}

export function applyOpsToList<T extends ProjectionRow>(
  baseList: T[],
  ops: QueuedOp[],
  entity: EntityKind,
  options?: ApplyOpsOptions
): T[] {
  const rows = new ProjectionRows(baseList.map(item => ({ ...item })))
  const projectionOps = expandBulkTransactionProjection(ops).filter(op => !op.needsAccountReview)
  const entityOps = projectionOps.filter(op => op.entity === entity)
  const unorderedOps = entity === 'transaction'
    ? [
        ...entityOps,
        ...projectionOps.filter(op =>
          (op.entity === 'wishlistItem' && (op.type === 'purchase' || op.type === 'unpurchase' || op.type === 'delete')) ||
          (op.entity === 'recurringPayment' && op.type === 'payEarly') ||
          (op.entity === 'recurringOccurrence' && op.type === 'settle') ||
          (op.entity === 'category' && (op.type === 'delete' || op.type === 'cleanup')) ||
          (op.entity === 'ledgerAccountReconcile' && op.type === 'add')
        )
      ]
    : entity === 'recurringPayment'
      ? [
          ...entityOps,
          ...projectionOps.filter(op => op.entity === 'recurringOccurrence' && op.type === 'settle'),
          ...projectionOps.filter(op => op.entity === 'transaction' && op.type === 'delete'),
          ...projectionOps.filter(op => op.entity === 'category' && (op.type === 'delete' || op.type === 'cleanup'))
        ]
      : entity === 'wishlistItem'
        ? [
            ...entityOps,
            ...projectionOps.filter(op => op.entity === 'transaction' && (op.type === 'add' || op.type === 'delete')),
          ]
      : entityOps

  // Projection is a replay, so it must run in the order the user acted — an op that
  // *creates* a row has to be applied before one that edits it, or the edit finds no
  // row and is silently dropped. Neither the incoming array nor the grouping above is
  // chronological: `activeOps` is `[...pendingOps, ...recentlyCompletedOps]`, which puts
  // an older completed add *after* a newer pending update, and the cross-entity ops are
  // appended as a block after the entity's own. Both orderings lost edits — a completed
  // `transaction:add` re-applied after a pending `transaction:update` overwrote the edit
  // with the original payload, and a `transaction:update` against the row a queued
  // `wishlistItem:purchase` synthesizes was dropped entirely. Sorting is stable, so ops
  // sharing a millisecond keep their relative order.
  const effectiveOps = [...unorderedOps].sort((left, right) => left.createdAt - right.createdAt)

  for (const op of effectiveOps) {
    if (applyCrossEntityOp(rows, op, entity, options)) continue
    applyEntityOp(rows, op, entity, options)
  }

  const comparator = OPTIMISTIC_LIST_ORDER_POLICIES[entity]?.compare
  return comparator ? rows.rows.sort(comparator) : rows.rows
}
