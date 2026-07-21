import * as api from './api'
import type { FinancialSetting, RecurringPayment, Transaction, TransactionCategory, WishlistItem } from '../types'

export type EntityKind = 'transaction' | 'recurringPayment' | 'wishlistItem' | 'category' | 'settings'
export type OpType = 'add' | 'update' | 'delete' | 'toggle' | 'purchase' | 'unpurchase'
export interface OutboxPayload {
  [key: string]: unknown
  id?: string | number
  name?: string
  description?: string
  category?: string
  ledgerCategory?: string
  amount?: number
  price?: number
  active?: boolean
  darkMode?: boolean
  hideSensitive?: boolean
  purchasedAt?: string
  purchaseTransactionId?: string | null
  replacementCategoryId?: string
  date?: string
  postedAt?: string
}
export type DispatchResult =
  | Transaction
  | RecurringPayment
  | WishlistItem
  | TransactionCategory
  | { item: WishlistItem; transaction: Transaction; id?: undefined }
  | void

function getOptimisticTransactionPostedAt(createdAt: number): string {
  return new Date(createdAt).toISOString()
}

export interface QueuedOp {
  id: string
  entity: EntityKind
  type: OpType
  targetId: string
  payload?: OutboxPayload
  createdAt: number
  retryCount: number
  isCompleted?: boolean
  isUndo?: boolean
  /** Message from the last failed dispatch attempt, set only once an op is moved to failedOps. */
  lastError?: string
}

type ToastTone = 'info' | 'success' | 'warning' | 'error'

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
    // Acknowledging an end-of-cycle summary is a silent bookkeeping write — no toast.
    if (op.targetId === 'summarySeen') return null
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
  payload?: OutboxPayload,
  isUndo?: boolean,
  activeSyncOpId?: string | null
): QueuedOp[] {
  const targetIdStr = String(targetId)
  const createdAt = Date.now()
  const timestampedPayload = entity === 'transaction' && type === 'add' && !payload?.postedAt
    ? { ...payload, postedAt: getOptimisticTransactionPostedAt(createdAt) }
    : payload
  const newOp: QueuedOp = {
    id: createOpId(),
    entity,
    type,
    targetId: targetIdStr,
    payload: timestampedPayload,
    createdAt,
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
      // Also if entity === 'recurringPayment', drop any unsent transaction ops generated from this recurring payment
      return queue.filter(op => {
        if (sameTarget(op)) return false
        if (entity === 'recurringPayment' && op.entity === 'transaction' && op.payload?.recurringPaymentId === targetIdStr) {
          return false
        }
        return true
      })
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
          const nextActive = payload && typeof payload.active === 'boolean' ? payload.active : op.payload?.active !== true
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
  const effectiveOps = entity === 'transaction'
    ? [
        ...entityOps,
        ...ops.filter(op =>
          (op.entity === 'wishlistItem' && (op.type === 'purchase' || op.type === 'unpurchase' || op.type === 'delete')) ||
          (op.entity === 'recurringPayment' && op.type === 'delete')
        )
      ]
    : entityOps

  for (const op of effectiveOps) {
    const targetStr = String(op.targetId)

    if (op.type === 'add') {
      const parsedId = entity === 'wishlistItem' ? Number(op.targetId) : op.targetId
      const newItem = {
        ...op.payload,
        ...(entity === 'transaction' && !op.payload?.postedAt
          ? { postedAt: getOptimisticTransactionPostedAt(op.createdAt) }
          : {}),
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
        if (entity === 'wishlistItem' && op.payload && op.payload.isActive === true) {
          result = result.map((item, idx) => {
            if (idx === existingIndex) {
              return {
                ...item,
                ...op.payload,
                isPendingSync: !op.isCompleted
              } as unknown as T
            }
            return {
              ...item,
              isActive: false
            } as unknown as T
          })
        } else {
          result[existingIndex] = {
            ...result[existingIndex],
            ...op.payload,
            isPendingSync: !op.isCompleted
          }
        }
      }
    } else if (op.type === 'delete') {
      if (entity === 'transaction' && op.entity === 'wishlistItem') {
        // Deleting a purchased wishlist item cascades to its linked ledger transaction
        // server-side (see WishlistService.DeleteWishlistItemAsync). Mirror that here so
        // the ledger row disappears immediately instead of lingering until the next
        // refresh -- the linked transaction keys off wishlistItemId, not the op targetId.
        result = result.map(item => {
          const wishlistItemId = (item as T & { wishlistItemId?: number | null }).wishlistItemId
          return wishlistItemId != null && String(wishlistItemId) === targetStr
            ? { ...item, isPendingDelete: true, isPendingSync: !op.isCompleted }
            : item
        })
      } else if (entity === 'transaction' && op.entity === 'recurringPayment') {
        // Deleting or undoing a recurring payment subscription marks any ledger transaction
        // created from it as pending delete in optimistic FE state.
        result = result.map(item => {
          const recurringPaymentId = (item as T & { recurringPaymentId?: string | null }).recurringPaymentId
          return recurringPaymentId != null && String(recurringPaymentId) === targetStr
            ? { ...item, isPendingDelete: true, isPendingSync: !op.isCompleted }
            : item
        })
      } else {
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
      }
    } else if (op.type === 'toggle') {
      const existingIndex = result.findIndex(item => String(item.id) === targetStr)
      if (existingIndex >= 0) {
        const item = result[existingIndex] as T & { active?: boolean }
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
    } else if (entity === 'transaction' && op.entity === 'wishlistItem' && op.type === 'purchase') {
      const syntheticId = op.payload?.purchaseTransactionId || `wishlist-purchase-${op.targetId}`
      const newItem = {
        id: syntheticId,
        date: op.payload?.date || new Date(op.createdAt).toLocaleDateString('en-CA'),
        postedAt: op.payload?.postedAt || new Date(op.createdAt).toISOString(),
        description: `Purchased: ${op.payload?.name || 'Wishlist item'} (Wish List)`,
        category: 'Other',
        ledgerCategory: 'Rewards',
        amount: -Math.abs(Number(op.payload?.price || 0)),
        wishlistItemId: Number(op.targetId),
        isPendingSync: !op.isCompleted
      } as unknown as T

      const existingIndex = result.findIndex(item => String(item.id) === String(syntheticId))
      if (existingIndex >= 0) {
        result[existingIndex] = {
          ...result[existingIndex],
          ...newItem
        }
      } else {
        result = [newItem, ...result]
      }
    } else if (entity === 'transaction' && op.entity === 'wishlistItem' && op.type === 'unpurchase') {
      const purchaseTransactionId = op.payload?.purchaseTransactionId
      if (purchaseTransactionId) {
        result = result.map(item => String(item.id) === String(purchaseTransactionId)
          ? {
              ...item,
              isPendingDelete: true,
              isPendingSync: !op.isCompleted
            }
          : item)
      }
    } else if (op.type === 'purchase') {
      const existingIndex = result.findIndex(item => String(item.id) === targetStr)
      if (existingIndex >= 0) {
        const item = result[existingIndex] as T & { isPurchased?: boolean; purchasedAt?: string; purchaseTransactionId?: string | null }
        result[existingIndex] = {
          ...item,
          isPurchased: true,
          purchasedAt: op.payload?.postedAt || op.payload?.date || op.payload?.purchasedAt || new Date().toISOString(),
          purchaseTransactionId: op.payload?.purchaseTransactionId ?? item.purchaseTransactionId ?? null,
          isPendingSync: !op.isCompleted
        }
      }
    } else if (op.type === 'unpurchase') {
      const existingIndex = result.findIndex(item => String(item.id) === targetStr)
      if (existingIndex >= 0) {
        const item = result[existingIndex] as T & { isPurchased?: boolean; purchasedAt?: string; purchaseTransactionId?: string | null }
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

export const DISPATCH: Record<string, (op: QueuedOp) => Promise<DispatchResult>> = {
  'transaction:add': (op) => api.addTransaction({ ...(op.payload as Partial<Transaction>), id: op.targetId } as Omit<Transaction, 'id'> & { id?: string }),
  'transaction:update': (op) => api.updateTransaction(op.targetId, op.payload as unknown as Omit<Transaction, 'id'>),
  'transaction:delete': (op) => api.deleteTransaction(op.targetId),

  'recurringPayment:add': (op) => api.addRecurringPayment({ ...(op.payload as Partial<RecurringPayment>), id: op.targetId } as Omit<RecurringPayment, 'id'> & { id?: string }),
  'recurringPayment:update': (op) => api.updateRecurringPayment(op.targetId, op.payload as unknown as RecurringPayment),
  'recurringPayment:delete': (op) => api.deleteRecurringPayment(op.targetId),
  'recurringPayment:toggle': (op) => api.toggleRecurringPayment(op.targetId, typeof op.payload?.active === 'boolean' ? op.payload.active : undefined),

  'wishlistItem:add': (op) => api.addWishlistItem(op.payload as Partial<WishlistItem>, op.id),
  'wishlistItem:update': (op) => api.updateWishlistItem(Number(op.targetId), op.payload as unknown as WishlistItem),
  'wishlistItem:delete': (op) => api.deleteWishlistItem(Number(op.targetId)),
  'wishlistItem:purchase': (op) => api.purchaseWishlistItem(Number(op.targetId), typeof op.payload?.date === 'string' ? op.payload.date : undefined),
  'wishlistItem:unpurchase': (op) => api.unpurchaseWishlistItem(Number(op.targetId)),

  'category:add': (op) => api.addCategory({ ...(op.payload as Partial<TransactionCategory>), id: op.targetId } as Omit<TransactionCategory, 'id'> & { id?: string }),
  'category:delete': (op) => api.deleteCategory(op.targetId, typeof op.payload?.replacementCategoryId === 'string' ? op.payload.replacementCategoryId : undefined),

  'settings:update': (op) => {
    if (op.targetId === 'darkMode') return api.updateDarkMode(op.payload?.darkMode === true)
    if (op.targetId === 'hideSensitive') return api.updateHideSensitive(op.payload?.hideSensitive === true)
    if (op.targetId === 'summarySeen') return api.updateSummarySeen(typeof op.payload?.cycleKey === 'string' ? op.payload.cycleKey : null)
    return api.updateSettings(op.payload as unknown as Pick<FinancialSetting, 'targetStabilityFund' | 'essentialsAlloc' | 'growthAlloc' | 'stabilityAlloc' | 'rewardsAlloc' | 'cycleDay'> & Partial<FinancialSetting>)
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
  return value.filter(isWellFormedOp).map(o => ({
    ...o,
    targetId: String(o.targetId),
    payload: o.entity === 'transaction' && o.type === 'add' && !o.payload?.postedAt
      ? { ...o.payload, postedAt: getOptimisticTransactionPostedAt(o.createdAt) }
      : o.payload,
  }))
}
