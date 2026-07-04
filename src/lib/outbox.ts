import * as api from './api'

export type EntityKind = 'transaction' | 'recurringPayment' | 'wishlistItem' | 'category' | 'settings'
export type OpType = 'add' | 'update' | 'delete' | 'toggle' | 'purchase'

export interface QueuedOp {
  id: string
  entity: EntityKind
  type: OpType
  targetId: string
  payload?: any
  createdAt: number
  retryCount: number
}

export function createFinalId(entity: EntityKind): string {
  const prefix = entity === 'transaction' ? 'tx' : entity === 'recurringPayment' ? 'rec' : entity === 'category' ? 'cat' : 'op'
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

export function createLocalWishlistId(): number {
  return -Math.floor(Date.now() * 1000 + Math.random() * 1000)
}

function createOpId(): string {
  return `op-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

export function enqueue(
  queue: QueuedOp[],
  entity: EntityKind,
  type: OpType,
  targetId: string,
  payload?: any
): QueuedOp[] {
  const targetIdStr = String(targetId)
  const newOp: QueuedOp = {
    id: createOpId(),
    entity,
    type,
    targetId: targetIdStr,
    payload,
    createdAt: Date.now(),
    retryCount: 0
  }

  const hasQueuedAdd = queue.some(op => op.entity === entity && op.targetId === targetIdStr && op.type === 'add')

  if (type === 'delete') {
    if (hasQueuedAdd) {
      // Delete against a target with an unsent add: drop the add & cascade-remove all ops for that target
      return queue.filter(op => !(op.entity === entity && op.targetId === targetIdStr))
    } else {
      // Delete against existing entity: drop queued update/toggle for that target & append delete
      const filtered = queue.filter(op => !(op.entity === entity && op.targetId === targetIdStr && (op.type === 'update' || op.type === 'toggle')))
      return [...filtered, newOp]
    }
  }

  if (type === 'update') {
    if (hasQueuedAdd) {
      // Update against an unsent add: merge into the add op's payload
      return queue.map(op => {
        if (op.entity === entity && op.targetId === targetIdStr && op.type === 'add') {
          return {
            ...op,
            payload: { ...op.payload, ...payload }
          }
        }
        return op
      })
    } else {
      // Update against existing entity: replace existing queued update payload or append
      const existingUpdateIndex = queue.findIndex(op => op.entity === entity && op.targetId === targetIdStr && op.type === 'update')
      if (existingUpdateIndex >= 0) {
        const next = [...queue]
        next[existingUpdateIndex] = {
          ...next[existingUpdateIndex],
          payload: { ...next[existingUpdateIndex].payload, ...payload }
        }
        return next
      }
      return [...queue, newOp]
    }
  }

  if (type === 'toggle') {
    if (hasQueuedAdd) {
      // Toggle against an unsent add: flip active in place on add payload
      return queue.map(op => {
        if (op.entity === entity && op.targetId === targetIdStr && op.type === 'add') {
          return {
            ...op,
            payload: { ...op.payload, active: !op.payload.active }
          }
        }
        return op
      })
    } else {
      // Toggle against an already-queued toggle cancels out (remove existing toggle)
      const existingToggleIndex = queue.findIndex(op => op.entity === entity && op.targetId === targetIdStr && op.type === 'toggle')
      if (existingToggleIndex >= 0) {
        return queue.filter((_, idx) => idx !== existingToggleIndex)
      }
      return [...queue, newOp]
    }
  }

  // add or purchase -> append to queue
  return [...queue, newOp]
}

export function applyOpsToList<T extends { id: string | number; isPendingSync?: boolean }>(
  baseList: T[],
  ops: QueuedOp[],
  entity: EntityKind
): T[] {
  let result = baseList.map(item => ({ ...item }))
  const entityOps = ops.filter(op => op.entity === entity)

  for (const op of entityOps) {
    const targetStr = String(op.targetId)

    if (op.type === 'add') {
      const parsedId = entity === 'wishlistItem' ? Number(op.targetId) : op.targetId
      const newItem = {
        ...op.payload,
        id: parsedId,
        isPendingSync: true
      } as T

      const existingIndex = result.findIndex(item => String(item.id) === targetStr)
      if (existingIndex >= 0) {
        result[existingIndex] = newItem
      } else {
        result = [newItem, ...result]
      }
    } else if (op.type === 'update') {
      const existingIndex = result.findIndex(item => String(item.id) === targetStr)
      if (existingIndex >= 0) {
        result[existingIndex] = {
          ...result[existingIndex],
          ...op.payload,
          isPendingSync: true
        }
      }
    } else if (op.type === 'delete') {
      result = result.filter(item => String(item.id) !== targetStr)
    } else if (op.type === 'toggle') {
      const existingIndex = result.findIndex(item => String(item.id) === targetStr)
      if (existingIndex >= 0) {
        const item = result[existingIndex] as any
        result[existingIndex] = {
          ...item,
          active: !item.active,
          isPendingSync: true
        }
      }
    } else if (op.type === 'purchase') {
      const existingIndex = result.findIndex(item => String(item.id) === targetStr)
      if (existingIndex >= 0) {
        const item = result[existingIndex] as any
        result[existingIndex] = {
          ...item,
          isPurchased: true,
          purchasedAt: op.payload?.purchasedAt || new Date().toISOString(),
          isPendingSync: true
        }
      }
    }
  }

  return result
}

export const DISPATCH: Record<string, (op: QueuedOp) => Promise<any>> = {
  'transaction:add': (op) => api.addTransaction({ ...op.payload, id: op.targetId }),
  'transaction:update': (op) => api.updateTransaction(op.targetId, op.payload),
  'transaction:delete': (op) => api.deleteTransaction(op.targetId),

  'recurringPayment:add': (op) => api.addRecurringPayment({ ...op.payload, id: op.targetId }),
  'recurringPayment:update': (op) => api.updateRecurringPayment(op.targetId, op.payload),
  'recurringPayment:delete': (op) => api.deleteRecurringPayment(op.targetId),
  'recurringPayment:toggle': (op) => api.toggleRecurringPayment(op.targetId),

  'wishlistItem:add': (op) => api.addWishlistItem(op.payload),
  'wishlistItem:update': (op) => api.updateWishlistItem(Number(op.targetId), op.payload),
  'wishlistItem:delete': (op) => api.deleteWishlistItem(Number(op.targetId)),
  'wishlistItem:purchase': (op) => api.purchaseWishlistItem(Number(op.targetId)),

  'category:add': (op) => api.addCategory({ ...op.payload, id: op.targetId }),
  'category:delete': (op) => api.deleteCategory(op.targetId),

  'settings:update': (op) => api.updateSettings(op.payload)
}

function isWellFormedOp(op: unknown): op is QueuedOp {
  if (!op || typeof op !== 'object') return false
  const o = op as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    typeof o.entity === 'string' &&
    ['transaction', 'recurringPayment', 'wishlistItem', 'category', 'settings'].includes(o.entity as string) &&
    typeof o.type === 'string' &&
    ['add', 'update', 'delete', 'toggle', 'purchase'].includes(o.type as string) &&
    (typeof o.targetId === 'string' || typeof o.targetId === 'number') &&
    typeof o.createdAt === 'number' &&
    typeof o.retryCount === 'number'
  )
}

export function sanitizeQueuedOps(value: unknown): QueuedOp[] {
  if (!Array.isArray(value)) return []
  return value.filter(isWellFormedOp).map(o => ({ ...o, targetId: String(o.targetId) }))
}
