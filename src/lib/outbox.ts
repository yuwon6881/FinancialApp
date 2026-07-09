import * as api from './api'

export type EntityKind = 'transaction' | 'recurringPayment' | 'wishlistItem' | 'category' | 'settings'
export type OpType = 'add' | 'update' | 'delete' | 'toggle' | 'purchase' | 'unpurchase'

export interface QueuedOp {
  id: string
  entity: EntityKind
  type: OpType
  targetId: string
  payload?: any
  createdAt: number
  retryCount: number
  isCompleted?: boolean
  isUndo?: boolean
  /** Message from the last failed dispatch attempt, set only once an op is moved to failedOps. */
  lastError?: string
}

export type ToastTone = 'info' | 'success' | 'warning' | 'error'

export interface ToastCopy {
  title: string
  message: string
  tone: ToastTone
}

const ENTITY_LABELS: Record<EntityKind, string> = {
  transaction: 'Transaction',
  recurringPayment: 'Recurring payment',
  wishlistItem: 'Wishlist item',
  category: 'Category',
  settings: 'Settings'
}

const TYPE_VERBS: Record<OpType, string> = {
  add: 'added',
  update: 'updated',
  delete: 'deleted',
  toggle: 'toggled',
  purchase: 'purchased',
  unpurchase: 'purchase undone'
}

function defaultSyncSuccessToast(op: QueuedOp): ToastCopy {
  const entityName = ENTITY_LABELS[op.entity] || 'Item'
  const typeName = TYPE_VERBS[op.type] || 'processed'
  return { title: 'Sync successful', message: `${entityName} ${typeName} successfully`, tone: 'success' }
}

// Override copy per "entity:type" key only where the default "<Entity> <verb> successfully"
// sentence isn't right (e.g. a setting keyed by targetId rather than a named record) or to
// silence a specific op by returning null. Anything not listed here — including any new
// entity/op type added later — automatically gets the default copy above with zero changes
// required here.
const SUCCESS_TOAST_OVERRIDES: Partial<Record<string, (op: QueuedOp) => ToastCopy | null>> = {
  'settings:update': (op) => {
    if (op.targetId === 'darkMode') {
      return { title: 'Theme synced', message: `Dark mode ${op.payload?.darkMode ? 'enabled' : 'disabled'} — synced to server`, tone: 'success' }
    }
    if (op.targetId === 'hideSensitive') {
      return { title: 'Settings synced', message: `Hide sensitive data ${op.payload?.hideSensitive ? 'enabled' : 'disabled'} — synced to server`, tone: 'success' }
    }
    return defaultSyncSuccessToast(op)
  }
}

// Single source of truth for "queued op finished syncing" toast copy, used by the outbox
// drain loop. Keeping this here (next to DISPATCH) means a new entity/op type gets a working
// toast automatically, and custom wording for a specific op is a one-line addition above.
export function getSyncSuccessToast(op: QueuedOp): ToastCopy | null {
  if (op.isUndo) {
    const entityName = ENTITY_LABELS[op.entity] || 'Item'
    return { title: 'Undo successful', message: `Previous action on ${entityName.toLowerCase()} has been undone`, tone: 'success' }
  }

  const key = `${op.entity}:${op.type}`
  const override = SUCCESS_TOAST_OVERRIDES[key]
  return override ? override(op) : defaultSyncSuccessToast(op)
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
  payload?: any,
  isUndo?: boolean,
  activeSyncOpId?: string | null
): QueuedOp[] {
  const targetIdStr = String(targetId)
  const newOp: QueuedOp = {
    id: createOpId(),
    entity,
    type,
    targetId: targetIdStr,
    payload,
    createdAt: Date.now(),
    retryCount: 0,
    isUndo
  }

  const sameTarget = (op: QueuedOp) => op.entity === entity && op.targetId === targetIdStr
  const queuedAdd = queue.find(op => sameTarget(op) && op.type === 'add')
  const queuedAddNotInFlight = queuedAdd !== undefined && queuedAdd.id !== activeSyncOpId

  const queuedDelete = queue.find(op => sameTarget(op) && op.type === 'delete')
  const hasQueuedDelete = queuedDelete !== undefined

  if (type === 'delete') {
    if (hasQueuedDelete) {
      // Already queued for deletion: collapse the duplicate so we never fire a
      // second DELETE at a row the first one already removed (would 404).
      return queue
    }
    if (queuedAddNotInFlight) {
      // Delete against a target with an unsent add: drop the add & cascade-remove all ops for that target
      return queue.filter(op => !sameTarget(op))
    } else {
      // Delete against existing entity: drop queued update/toggle/purchase/unpurchase (not in-flight) for that target & append delete
      const filtered = queue.filter(op => !(sameTarget(op) && (op.type === 'update' || op.type === 'toggle' || op.type === 'purchase' || op.type === 'unpurchase') && op.id !== activeSyncOpId))
      return [...filtered, newOp]
    }
  }

  // A record already queued for deletion can't be meaningfully mutated further:
  // any update/toggle/purchase would replay against a row the delete removes.
  // Drop it (delete wins) rather than queue an op destined to 404.
  if (hasQueuedDelete && (type === 'update' || type === 'toggle' || type === 'purchase' || type === 'unpurchase')) {
    return queue
  }

  if (type === 'update') {
    if (queuedAddNotInFlight) {
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
      const existingUpdateIndex = queue.findIndex(op => op.entity === entity && op.targetId === targetIdStr && op.type === 'update' && op.id !== activeSyncOpId)
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
    // payload carries the desired absolute { active } state (mirrors 'update'),
    // so replaying this op against a stale or freshly-refetched base list is idempotent.
    if (queuedAddNotInFlight) {
      // Toggle against an unsent add: set active in place on add payload
      return queue.map(op => {
        if (op.entity === entity && op.targetId === targetIdStr && op.type === 'add') {
          const nextActive = payload && typeof payload.active === 'boolean' ? payload.active : !op.payload.active
          return {
            ...op,
            payload: { ...op.payload, active: nextActive }
          }
        }
        return op
      })
    } else {
      // Toggle against an existing entity: replace existing queued toggle payload or append
      const existingToggleIndex = queue.findIndex(op => op.entity === entity && op.targetId === targetIdStr && op.type === 'toggle' && op.id !== activeSyncOpId)
      if (existingToggleIndex >= 0) {
        const next = [...queue]
        next[existingToggleIndex] = { ...next[existingToggleIndex], payload }
        return next
      }
      return [...queue, newOp]
    }
  }

  if (type === 'add') {
    if (hasQueuedDelete) {
      // A queued delete + a re-add of the same id cancel out (e.g. undoing a
      // not-yet-synced delete). The row still exists server-side, so just drop
      // the pending delete instead of round-tripping delete-then-add.
      const deleteNotInFlight = queuedDelete !== undefined && queuedDelete.id !== activeSyncOpId
      if (deleteNotInFlight) {
        return queue.filter(op => !(sameTarget(op) && op.type === 'delete'))
      }
    }
    if (queuedAddNotInFlight) {
      // Defensive: never queue two adds for the same id -- merge the payloads.
      return queue.map(op => (sameTarget(op) && op.type === 'add')
        ? { ...op, payload: { ...op.payload, ...payload } }
        : op)
    }
    return [...queue, newOp]
  }

  if (type === 'purchase') {
    // Collapse duplicate purchases so a double-tap can't fire two calls.
    if (queue.some(op => sameTarget(op) && op.type === 'purchase')) {
      return queue
    }
    return [...queue, newOp]
  }

  if (type === 'unpurchase') {
    const queuedPurchase = queue.find(op => sameTarget(op) && op.type === 'purchase')
    if (queuedPurchase && queuedPurchase.id !== activeSyncOpId) {
      return queue.filter(op => !(sameTarget(op) && op.type === 'purchase'))
    }
    if (queue.some(op => sameTarget(op) && op.type === 'unpurchase')) {
      return queue
    }
    return [...queue, newOp]
  }

  return [...queue, newOp]
}

export function applyOpsToList<T extends { id: string | number; isPendingSync?: boolean; isPendingDelete?: boolean }>(
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
        isPendingSync: !op.isCompleted
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
          isPendingSync: !op.isCompleted
        }
      }
    } else if (op.type === 'delete') {
      result = result.map(item => {
        const itemStr = String(item.id)
        if (itemStr === targetStr || itemStr.startsWith(`${targetStr}-split-`) || (itemStr.includes('-split-') && itemStr.split('-split-')[0] === targetStr)) {
          return {
            ...item,
            isPendingDelete: true,
            isPendingSync: !op.isCompleted
          }
        }
        return item
      })
    } else if (op.type === 'toggle') {
      const existingIndex = result.findIndex(item => String(item.id) === targetStr)
      if (existingIndex >= 0) {
        const item = result[existingIndex] as any
        // Prefer the absolute desired state captured at click time; only fall back to a
        // relative flip for legacy queued ops (e.g. persisted from before this fix) that
        // have no payload. A relative flip here would double-apply against a refreshed
        // base list and flicker the toggle back to the old state.
        const nextActive = op.payload && typeof op.payload.active === 'boolean' ? op.payload.active : !item.active
        result[existingIndex] = {
          ...item,
          active: nextActive,
          isPendingSync: !op.isCompleted
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
          purchaseTransactionId: op.payload?.purchaseTransactionId ?? item.purchaseTransactionId ?? null,
          isPendingSync: !op.isCompleted
        }
      }
    } else if (op.type === 'unpurchase') {
      const existingIndex = result.findIndex(item => String(item.id) === targetStr)
      if (existingIndex >= 0) {
        const item = result[existingIndex] as any
        result[existingIndex] = {
          ...item,
          isPurchased: false,
          purchasedAt: undefined,
          purchaseTransactionId: null,
          isPendingSync: !op.isCompleted
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
  'wishlistItem:unpurchase': (op) => api.unpurchaseWishlistItem(Number(op.targetId)),

  'category:add': (op) => api.addCategory({ ...op.payload, id: op.targetId }),
  'category:delete': (op) => api.deleteCategory(op.targetId),

  'settings:update': (op) => {
    if (op.targetId === 'darkMode') return api.updateDarkMode(op.payload.darkMode)
    if (op.targetId === 'hideSensitive') return api.updateHideSensitive(op.payload.hideSensitive)
    return api.updateSettings(op.payload)
  }
}

function isWellFormedOp(op: unknown): op is QueuedOp {
  if (!op || typeof op !== 'object') return false
  const o = op as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    typeof o.entity === 'string' &&
    ['transaction', 'recurringPayment', 'wishlistItem', 'category', 'settings'].includes(o.entity as string) &&
    typeof o.type === 'string' &&
    ['add', 'update', 'delete', 'toggle', 'purchase', 'unpurchase'].includes(o.type as string) &&
    (typeof o.targetId === 'string' || typeof o.targetId === 'number') &&
    typeof o.createdAt === 'number' &&
    typeof o.retryCount === 'number'
  )
}

export function sanitizeQueuedOps(value: unknown): QueuedOp[] {
  if (!Array.isArray(value)) return []
  return value.filter(isWellFormedOp).map(o => ({ ...o, targetId: String(o.targetId) }))
}
