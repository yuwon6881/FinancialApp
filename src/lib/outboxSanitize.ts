import { WELL_FORMED_ENTITY_KINDS } from './outboxToasts'
import type { EntityKind, QueuedOp } from './outboxTypes'
import { getOptimisticTransactionPostedAt } from './outboxTypes'

function isWellFormedOp(op: unknown): op is QueuedOp {
  if (!op || typeof op !== 'object') return false
  const o = op as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    typeof o.entity === 'string' &&
    WELL_FORMED_ENTITY_KINDS.includes(o.entity as EntityKind) &&
    typeof o.type === 'string' &&
    ['add', 'update', 'delete', 'restore', 'toggle', 'purchase', 'unpurchase', 'reminder', 'payEarly', 'settle', 'cleanup', 'bulkDelete', 'bulkRestore', 'advanceRepayment', 'fullSettlement', 'undoRepayment'].includes(o.type as string) &&
    (typeof o.targetId === 'string' || typeof o.targetId === 'number') &&
    typeof o.createdAt === 'number' &&
    typeof o.retryCount === 'number'
  )
}

export function sanitizeQueuedOps(value: unknown): QueuedOp[] {
  if (!Array.isArray(value)) return []
  return value.filter(isWellFormedOp).map(o => ({
    ...o,
    targetId: String(o.targetId),
    payload: o.entity === 'transaction' && o.type === 'add' && !o.payload?.postedAt
      ? { ...o.payload, postedAt: getOptimisticTransactionPostedAt(o.createdAt) }
      : o.payload,
  }))
}
