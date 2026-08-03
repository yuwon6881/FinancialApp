import * as api from './api'
import type { FinancialSetting, InvestmentAccount, InvestmentActivity, InvestmentAllocationSleeve, InvestmentCashFlow, InvestmentInstrument, InvestmentPlan, PayEarlyResult, RecurringPayment, SavingsGoal, TaxReliefCategoryDefinition, Transaction, TransactionCategory, WishlistItem } from '../types'
import { buildMutationSuccessToast, buildUndoSuccessToast } from './mutationToast'

export type EntityKind = 'transaction' | 'recurringPayment' | 'wishlistItem' | 'savingsGoal' | 'category' | 'settings'
  | 'investmentAccount' | 'investmentInstrument' | 'investmentActivity' | 'investmentCashFlow'
  | 'investmentPlan' | 'investmentAllocation'
  | 'investmentAllocationOrder' | 'taxReliefCategory'
export type OpType = 'add' | 'update' | 'delete' | 'restore' | 'toggle' | 'purchase' | 'unpurchase'
  | 'reminder' | 'payEarly' | 'cleanup'
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
  cycleLimit?: number | null
  date?: string
  postedAt?: string
  reminderEnabled?: boolean
  reminderMode?: string
  reminderLeadDays?: number
  occurrenceDate?: string
  optimisticNextOccurrenceDate?: string
  settledOccurrenceDate?: string
  nextOccurrenceDate?: string | null
  optimisticTransaction?: unknown
  resultTransaction?: unknown
  actions?: unknown
  taxYear?: number
}
export type DispatchResult =
  | Transaction
  | RecurringPayment
  | WishlistItem
  | SavingsGoal
  | TransactionCategory
  | InvestmentAccount
  | InvestmentInstrument
  | InvestmentActivity
  | InvestmentCashFlow
  | InvestmentPlan
  | TaxReliefCategoryDefinition
  | api.DeletedTransactionsSnapshot
  | api.CategoryCleanupApplyResult
  | PayEarlyResult
  | { id: string }
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

/**
 * A queued setting preference is the user's newest choice and must win over a
 * dashboard response that may have started before that write reached the
 * server. This is especially important during PWA startup, where the dashboard
 * refresh and outbox replay run concurrently.
 */
export function projectSettingPreference<T>(key: keyof OutboxPayload, serverValue: T, ops: ReadonlyArray<QueuedOp>): T {
  const latestPreferenceOp = ops.reduce<QueuedOp | undefined>((latest, op) => {
    if (op.entity !== 'settings' || op.type !== 'update') {
      return latest
    }
    const hasValue = op.targetId === key || (op.payload && op.payload[key] !== undefined)
    if (!hasValue) {
      return latest
    }
    return !latest || op.createdAt >= latest.createdAt ? op : latest
  }, undefined)

  return latestPreferenceOp && latestPreferenceOp.payload && latestPreferenceOp.payload[key] !== undefined
    ? latestPreferenceOp.payload[key] as T
    : serverValue
}

/**
 * Reconciles a server settings snapshot with setting writes that were queued
 * after that request began. This prevents a late startup response from
 * restoring stale preferences in React state or the local cache.
 */
export function projectFinancialSetting(
  serverSetting: FinancialSetting,
  ops: ReadonlyArray<QueuedOp>,
): FinancialSetting {
  return [...ops]
    .filter(op => op.entity === 'settings' && op.type === 'update' && op.payload)
    .sort((left, right) => left.createdAt - right.createdAt)
    .reduce<FinancialSetting>((setting, op) => {
      if (op.targetId === 'summarySeen') {
        return typeof op.payload?.cycleKey === 'string'
          ? { ...setting, lastSummaryCycleSeen: op.payload.cycleKey }
          : setting
      }

      return { ...setting, ...op.payload } as FinancialSetting
    }, { ...serverSetting })
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
  savingsGoal: 'Savings goal',
  category: 'Category',
  settings: 'Settings'
  , investmentAccount: 'Investment account'
  , investmentInstrument: 'Investment'
  , investmentActivity: 'Investment activity'
  , investmentCashFlow: 'Cash movement'
  , investmentPlan: 'Investment plan'
  , investmentAllocation: 'Investment classification'
  , investmentAllocationOrder: 'Investment classification order'
  , taxReliefCategory: 'Tax relief category'
}

const TYPE_COPY: Record<OpType, { title: string; messageVerb: string }> = {
  add: { title: 'Added', messageVerb: 'added' },
  update: { title: 'Updated', messageVerb: 'updated' },
  delete: { title: 'Deleted', messageVerb: 'deleted' },
  restore: { title: 'Restored', messageVerb: 'restored' },
  toggle: { title: 'Updated', messageVerb: 'updated' },
  purchase: { title: 'Purchased', messageVerb: 'purchased' },
  unpurchase: { title: 'Purchase Undone', messageVerb: 'unmarked as purchased' },
  reminder: { title: 'Updated', messageVerb: 'updated' },
  payEarly: { title: 'Paid Early', messageVerb: 'paid early' },
  cleanup: { title: 'Applied', messageVerb: 'applied' },
}

function defaultSyncSuccessToast(op: QueuedOp): ToastCopy {
  const entityName = ENTITY_LABELS[op.entity] || 'Item'
  const typeCopy = TYPE_COPY[op.type] || { title: 'Processed', messageVerb: 'processed' }
  const payloadSnapshot = op.payload?.undoSnapshot
  const snapshot = payloadSnapshot && typeof payloadSnapshot === 'object'
    ? payloadSnapshot as Record<string, unknown>
    : undefined
  const itemName = [op.payload?.description, op.payload?.name, op.payload?.symbol, snapshot?.description, snapshot?.name, snapshot?.symbol]
    .find(value => typeof value === 'string' && value.trim().length > 0) as string | undefined
  return buildMutationSuccessToast({
    entity: entityName,
    action: typeCopy.title,
    recordName: itemName,
    messageVerb: typeCopy.messageVerb,
  })
}

// Override copy per "entity:type" key only where the default "<Entity> <action>" sentence
// sentence isn't right (e.g. a setting keyed by targetId rather than a named record) or to
// silence a specific op by returning null. Anything not listed here — including any new
// entity/op type added later — automatically gets the default copy above with zero changes
// required here.
const SUCCESS_TOAST_OVERRIDES: Partial<Record<string, (op: QueuedOp) => ToastCopy | null>> = {
  'settings:update': (op) => {
    if (op.targetId === 'darkMode') {
      return buildMutationSuccessToast({
        entity: 'Settings',
        action: 'Updated',
        recordName: 'Dark mode',
        messageVerb: op.payload?.darkMode ? 'enabled' : 'disabled',
        messageSuffix: 'Synced to the server.',
      })
    }
    if (op.targetId === 'hideSensitive') {
      return buildMutationSuccessToast({
        entity: 'Settings',
        action: 'Updated',
        recordName: 'Hide sensitive data',
        messageVerb: op.payload?.hideSensitive ? 'enabled' : 'disabled',
        messageSuffix: 'Synced to the server.',
      })
    }
    // Acknowledging an end-of-cycle summary is a silent bookkeeping write — no toast.
    if (op.targetId === 'summarySeen') return null
    return defaultSyncSuccessToast(op)
  },
  'recurringPayment:reminder': (op) => buildMutationSuccessToast({
    entity: 'Recurring payment reminder',
    action: 'Updated',
    recordName: op.payload?.name as string | undefined,
    messageSuffix: 'Synced to the server.',
  }),
  'recurringPayment:payEarly': (op) => buildMutationSuccessToast({
    entity: 'Recurring payment',
    action: 'Paid Early',
    recordName: op.payload?.name as string | undefined,
    messageSuffix: 'Reminders for this cycle have stopped.',
  }),
  'category:cleanup': (op) => buildMutationSuccessToast({
    entity: 'Category cleanup',
    action: 'Applied',
    recordName: op.payload?.description as string | undefined,
    messageSuffix: 'Synced to the server.',
  }),
}

// Single source of truth for "queued op finished syncing" toast copy, used by the outbox
// drain loop. Keeping this here (next to DISPATCH) means a new entity/op type gets a working
// toast automatically, and custom wording for a specific op is a one-line addition above.
export function getSyncSuccessToast(op: QueuedOp): ToastCopy | null {
  if (op.isUndo) {
    const entityName = ENTITY_LABELS[op.entity] || 'Item'
    const itemName = [op.payload?.description, op.payload?.name, op.payload?.symbol]
      .find(value => typeof value === 'string' && value.trim().length > 0) as string | undefined
    return buildUndoSuccessToast(itemName, entityName)
  }

  const key = `${op.entity}:${op.type}`
  const override = SUCCESS_TOAST_OVERRIDES[key]
  return override ? override(op) : defaultSyncSuccessToast(op)
}

export function createFinalId(entity: EntityKind): string {
  const prefix = entity === 'transaction' ? 'tx'
    : entity === 'recurringPayment' ? 'rec'
    : entity === 'category' ? 'cat'
    : entity === 'taxReliefCategory' ? 'relief'
    : 'op'
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Numeric placeholder for a record whose real PK is a server-generated 32-bit int (wishlist items,
 * savings goals). Keeping it above that range prevents a collision while making the optimistic row
 * use the same final-id tie-break direction as a newly inserted server row.
 */
export function createLocalNumericId(): number {
  return Math.floor(Date.now() * 1000 + Math.random() * 1000)
}

export const createLocalWishlistId = createLocalNumericId

type OptimisticListItem = {
  id: string | number
  name?: string
  symbol?: string
  isArchived?: boolean
}

const compareIds = (left: OptimisticListItem, right: OptimisticListItem) =>
  String(left.id).localeCompare(String(right.id))

type OptimisticListOrderPolicy = {
  addPlacement?: 'prepend' | 'append'
  compare?: (left: OptimisticListItem, right: OptimisticListItem) => number
}

// Canonical API ordering is applied as part of projection so adds and ordering-field updates land
// where the next server refresh will put them. Some APIs expose a sortable field; others, such as
// tax relief limits, expose only database insertion order and therefore need append placement.
// Contextual view orders (ledger modes, reward priority, investment filters) stay in their helpers.
const OPTIMISTIC_LIST_ORDER_POLICIES: Partial<Record<EntityKind, OptimisticListOrderPolicy>> = {
  category: {
    compare: (left, right) => (left.name ?? '').localeCompare(right.name ?? ''),
  },
  recurringPayment: {
    compare: (left, right) =>
      (left.name ?? '').localeCompare(right.name ?? '') || compareIds(left, right),
  },
  investmentAccount: {
    compare: (left, right) =>
      Number(left.isArchived === true) - Number(right.isArchived === true) ||
      (left.name ?? '').localeCompare(right.name ?? '') ||
      compareIds(left, right),
  },
  investmentInstrument: {
    compare: (left, right) =>
      (left.symbol ?? '').localeCompare(right.symbol ?? '') || compareIds(left, right),
  },
  taxReliefCategory: {
    addPlacement: 'append',
  },
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
      // Delete against a target with an unsent add: drop every op for that target. Historical
      // ledger transactions are independent records, including rows linked to recurring payments.
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

  if (type === 'reminder') {
    if (hasQueuedDelete) return queue
    const existingReminder = queue.find(op => sameTarget(op) && op.type === 'reminder')
    if (existingReminder && existingReminder.id !== activeSyncOpId) {
      return queue.map(op => op.id === existingReminder.id
        ? {
            ...op,
            payload: {
              ...op.payload,
              ...payload,
              // Keep the first pre-change snapshot so Undo always returns to the state before
              // the user's first edit, even if the control is changed several times offline.
              undoSnapshot: op.payload?.undoSnapshot ?? payload?.undoSnapshot,
            },
          }
        : op)
    }
    return [...queue, newOp]
  }

  if (type === 'payEarly') {
    if (hasQueuedDelete || queue.some(op => sameTarget(op) && op.type === 'payEarly')) return queue
    return [...queue, newOp]
  }

  if (type === 'cleanup') {
    if (queue.some(op => sameTarget(op) && op.type === 'cleanup')) return queue
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
          (op.entity === 'recurringPayment' && op.type === 'payEarly') ||
          (op.entity === 'category' && (op.type === 'delete' || op.type === 'cleanup'))
        )
      ]
    : entity === 'recurringPayment'
      ? [
          ...entityOps,
          ...ops.filter(op => op.entity === 'category' && (op.type === 'delete' || op.type === 'cleanup'))
        ]
      : entity === 'wishlistItem'
        ? [
            ...entityOps,
            ...ops.filter(op => op.entity === 'transaction' && (op.type === 'add' || op.type === 'delete')),
          ]
      : entityOps

  for (const op of effectiveOps) {
    const targetStr = String(op.targetId)

    if (entity === 'wishlistItem' && op.entity === 'transaction' && (op.type === 'add' || op.type === 'delete')) {
      const nestedSnapshot = op.payload?.undoSnapshot && typeof op.payload.undoSnapshot === 'object'
        ? op.payload.undoSnapshot as Record<string, unknown>
        : undefined
      const rawWishlistItemId = op.payload?.wishlistItemId ?? nestedSnapshot?.wishlistItemId
      const wishlistItemId = rawWishlistItemId == null ? '' : String(rawWishlistItemId)
      const existingIndex = wishlistItemId
        ? result.findIndex(item => String(item.id) === wishlistItemId)
        : -1
      if (existingIndex >= 0) {
        result[existingIndex] = op.type === 'delete'
          ? {
              ...result[existingIndex],
              isPurchased: false,
              purchasedAt: null,
              purchaseTransactionId: null,
              isPendingSync: !op.isCompleted,
              pendingSyncOperationId: op.isCompleted ? undefined : op.id,
            } as unknown as T
          : {
              ...result[existingIndex],
              isPurchased: true,
              isActive: false,
              purchasedAt: typeof op.payload?.date === 'string' ? op.payload.date : undefined,
              purchaseTransactionId: op.targetId,
              isPendingSync: !op.isCompleted,
              pendingSyncOperationId: op.isCompleted ? undefined : op.id,
            } as unknown as T
      }
      continue
    }

    if (op.entity === 'recurringPayment' && op.type === 'reminder' && entity === 'recurringPayment') {
      const existingIndex = result.findIndex(item => String(item.id) === targetStr)
      if (existingIndex >= 0) {
        result[existingIndex] = {
          ...result[existingIndex],
          ...(typeof op.payload?.reminderEnabled === 'boolean' ? { reminderEnabled: op.payload.reminderEnabled } : {}),
          ...(typeof op.payload?.reminderMode === 'string' ? { reminderMode: op.payload.reminderMode } : {}),
          ...(typeof op.payload?.reminderLeadDays === 'number' ? { reminderLeadDays: op.payload.reminderLeadDays } : {}),
          isPendingSync: !op.isCompleted,
          pendingSyncOperationId: op.isCompleted ? undefined : op.id,
        } as unknown as T
      }
      continue
    }

    if (op.entity === 'recurringPayment' && op.type === 'payEarly') {
      if (entity === 'recurringPayment') {
        const existingIndex = result.findIndex(item => String(item.id) === targetStr)
        if (existingIndex >= 0) {
          const nextDate = op.isCompleted
            ? (typeof op.payload?.nextOccurrenceDate === 'string'
              ? op.payload.nextOccurrenceDate
              : typeof op.payload?.settledOccurrenceDate === 'string' ? op.payload.settledOccurrenceDate : undefined)
            : typeof op.payload?.optimisticNextOccurrenceDate === 'string'
              ? op.payload.optimisticNextOccurrenceDate
              : undefined
          result[existingIndex] = {
            ...result[existingIndex],
            ...(nextDate ? { nextDueDate: nextDate } : {}),
            isPendingSync: !op.isCompleted,
            pendingSyncOperationId: op.isCompleted ? undefined : op.id,
          } as unknown as T
        }
      } else if (entity === 'transaction') {
        const rawTransaction = op.isCompleted ? op.payload?.resultTransaction : op.payload?.optimisticTransaction
        if (rawTransaction && typeof rawTransaction === 'object') {
          const transaction = rawTransaction as Record<string, unknown>
          const transactionId = typeof transaction.id === 'string' ? transaction.id : undefined
          const recurringPaymentId = typeof transaction.recurringPaymentId === 'string'
            ? transaction.recurringPaymentId
            : targetStr
          const occurrenceDate = typeof transaction.recurringOccurrenceDate === 'string'
            ? transaction.recurringOccurrenceDate
            : typeof op.payload?.occurrenceDate === 'string' ? op.payload.occurrenceDate : undefined
          const existingIndex = result.findIndex(item =>
            (transactionId && String(item.id) === transactionId) ||
            (String((item as T & { recurringPaymentId?: string | null }).recurringPaymentId) === recurringPaymentId &&
              occurrenceDate != null && (item as T & { recurringOccurrenceDate?: string | null }).recurringOccurrenceDate === occurrenceDate)
          )
          const projected = {
            ...transaction,
            ...(transactionId ? { id: transactionId } : {}),
            isPendingDelete: false,
            isPendingSync: !op.isCompleted,
            pendingSyncOperationId: op.isCompleted ? undefined : op.id,
          } as unknown as T
          if (existingIndex >= 0) result[existingIndex] = { ...result[existingIndex], ...projected }
          else result = [projected, ...result]
        }
      }
      continue
    }

    if (op.entity === 'category' && op.type === 'cleanup') {
      const rawActions = Array.isArray(op.payload?.actions) ? op.payload.actions : []
      const actions = rawActions.filter((value): value is Record<string, unknown> => Boolean(value && typeof value === 'object'))
      if (entity === 'category') {
        for (const action of actions) {
          const actionType = typeof action.type === 'string' ? action.type : ''
          const categories = Array.isArray(action.categories)
            ? action.categories.filter((value): value is string => typeof value === 'string')
            : []
          const sourceNames = new Set(categories.map(name => name.trim().toLowerCase()).filter(Boolean))
          if (actionType === 'add' && typeof action.newCategoryName === 'string' && action.newCategoryName.trim()) {
            const name = action.newCategoryName.trim()
            const categoryId = typeof action.categoryId === 'string' && action.categoryId ? action.categoryId : `${op.targetId}:${name}`
            const existingIndex = result.findIndex(item => {
              const itemName = (item as T & { name?: string }).name
              return String(item.id) === categoryId || (typeof itemName === 'string' && itemName.toLowerCase() === name.toLowerCase())
            })
            const projected = {
              ...(existingIndex >= 0 ? result[existingIndex] : {}),
              id: categoryId,
              name,
              cycleLimit: existingIndex >= 0 ? (result[existingIndex] as T & { cycleLimit?: number | null }).cycleLimit ?? null : null,
              isPendingSync: !op.isCompleted,
              isPendingDelete: false,
            } as unknown as T
            if (existingIndex >= 0) result[existingIndex] = projected
            else result = [projected, ...result]
          } else if (sourceNames.size > 0 && (actionType === 'delete' || actionType === 'deleteByName' || actionType === 'merge')) {
            result = op.isCompleted
              ? result.filter(item => {
                  const itemName = (item as T & { name?: string }).name
                  return !(typeof itemName === 'string' && sourceNames.has(itemName.trim().toLowerCase()))
                })
              : result.map(item => {
                const itemName = (item as T & { name?: string }).name
                return typeof itemName === 'string' && sourceNames.has(itemName.trim().toLowerCase())
                ? { ...item, isPendingDelete: true, isPendingSync: true, pendingSyncOperationId: op.id } as unknown as T
                : item
              })
          }
        }
      } else if (entity === 'transaction' || entity === 'recurringPayment') {
        for (const action of actions) {
          const actionType = typeof action.type === 'string' ? action.type : ''
          const targetCategory = typeof action.targetCategory === 'string' ? action.targetCategory : ''
          if ((actionType === 'merge' || actionType === 'restoreTransactions' || actionType === 'restoreRecurringPayments') && targetCategory) {
            const rawIds = actionType === 'restoreTransactions'
              ? action.transactionIds
              : actionType === 'restoreRecurringPayments' ? action.recurringPaymentIds : undefined
            const ids = new Set(Array.isArray(rawIds)
              ? rawIds.filter((value): value is string => typeof value === 'string')
              : [])
            const sourceNames = new Set((Array.isArray(action.categories) ? action.categories : [])
              .filter((value): value is string => typeof value === 'string')
              .map(value => value.trim().toLowerCase()))
            result = result.map(item => {
              const itemId = String(item.id)
              const itemCategory = (item as T & { category?: string }).category
              const matches = actionType === 'merge'
                ? typeof itemCategory === 'string' && sourceNames.has(itemCategory.trim().toLowerCase())
                : ids.has(itemId)
              return matches
                ? { ...item, category: targetCategory, isPendingSync: !op.isCompleted, pendingSyncOperationId: op.isCompleted ? undefined : op.id } as unknown as T
                : item
            })
          }
        }
      }
      continue
    }

    if (op.entity === 'category' && op.type === 'delete' && (entity === 'transaction' || entity === 'recurringPayment')) {
      // The API moves both ledger transactions and recurring payments to the selected replacement
      // category in the same request. Keep those dependent records visibly pending too.
      const sourceName = typeof op.payload?.name === 'string' ? op.payload.name.trim().toLowerCase() : ''
      const replacementName = typeof op.payload?.replacementCategoryName === 'string'
        ? op.payload.replacementCategoryName
        : ''
      if (sourceName && replacementName) {
        result = result.map(item => {
          const category = (item as T & { category?: string }).category
          return typeof category === 'string' && category.trim().toLowerCase() === sourceName
            ? { ...item, category: replacementName, isPendingSync: !op.isCompleted, pendingSyncOperationId: op.isCompleted ? undefined : op.id }
            : item
        })
      }
      continue
    }

    if (op.type === 'add') {
      // Wishlist items and savings goals have server-generated int PKs, so an offline add carries
      // a numeric placeholder outside that range. Keep it numeric: leaving it a string breaks id
      // comparisons and the numeric ordering these lists rely on. Older negative ids remain valid.
      const parsedId = entity === 'wishlistItem' || entity === 'savingsGoal' ? Number(op.targetId) : op.targetId
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
        result = OPTIMISTIC_LIST_ORDER_POLICIES[entity]?.addPlacement === 'append'
          ? [...result, newItem]
          : [newItem, ...result]
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
        if (op.isCompleted) {
          result = result.filter(item => {
            const wishlistItemId = (item as T & { wishlistItemId?: number | null }).wishlistItemId
            return !(wishlistItemId != null && String(wishlistItemId) === targetStr)
          })
        } else {
          result = result.map(item => {
            const wishlistItemId = (item as T & { wishlistItemId?: number | null }).wishlistItemId
            return wishlistItemId != null && String(wishlistItemId) === targetStr
              ? { ...item, isPendingDelete: true, isPendingSync: true }
              : item
          })
        }
      } else {
        if (op.isCompleted) {
          result = result.filter(item => {
            const itemStr = String(item.id)
            return !(itemStr === targetStr || itemStr.startsWith(`${targetStr}-split-`) || (itemStr.includes('-split-') && itemStr.split('-split-')[0] === targetStr))
          })
        } else {
          result = result.map(item => {
            const itemStr = String(item.id)
            if (itemStr === targetStr || itemStr.startsWith(`${targetStr}-split-`) || (itemStr.includes('-split-') && itemStr.split('-split-')[0] === targetStr)) {
              return {
                ...item,
                isPendingDelete: true,
                isPendingSync: true
              }
            }
            return item
          })
        }
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
        if (op.isCompleted) {
          result = result.filter(item => String(item.id) !== String(purchaseTransactionId))
        } else {
          result = result.map(item => String(item.id) === String(purchaseTransactionId)
            ? {
                ...item,
                isPendingDelete: true,
                isPendingSync: true
              }
            : item)
        }
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
    } else if (op.type === 'restore') {
      // Investment activity/cash-flow undo uses a dedicated restore endpoint rather than
      // re-adding a record. Project the snapshot back into the visible list immediately so an
      // undo followed by navigation does not leave the user staring at a missing row.
      const snapshots = entity === 'investmentActivity' && Array.isArray(op.payload?.transactions)
        ? op.payload.transactions
        : entity === 'investmentCashFlow' && op.payload
          ? [op.payload]
          : []
      for (const snapshot of snapshots) {
        if (!snapshot || typeof snapshot !== 'object') continue
        const snapshotId = 'id' in snapshot ? String(snapshot.id) : targetStr
        if (!snapshotId) continue
        const restored = {
          ...snapshot,
          id: snapshotId,
          isPendingDelete: false,
          isPendingSync: !op.isCompleted,
        } as unknown as T
        const existingIndex = result.findIndex(item => String(item.id) === snapshotId)
        if (existingIndex >= 0) result[existingIndex] = restored
        else result = [restored, ...result]
      }
    }
  }

  const comparator = OPTIMISTIC_LIST_ORDER_POLICIES[entity]?.compare
  return comparator ? result.sort(comparator) : result
}

const withoutUndoSnapshot = (payload: OutboxPayload | undefined): OutboxPayload => {
  const requestPayload = { ...(payload ?? {}) }
  delete requestPayload.undoSnapshot
  return requestPayload
}

export const DISPATCH: Record<string, (op: QueuedOp) => Promise<DispatchResult>> = {
  'transaction:add': (op) => api.addTransaction({ ...(op.payload as Partial<Transaction>), id: op.targetId } as Omit<Transaction, 'id'> & { id?: string }),
  'transaction:update': (op) => api.updateTransaction(
    op.targetId,
    withoutUndoSnapshot(op.payload) as unknown as Omit<Transaction, 'id'>,
  ),
  'transaction:delete': (op) => api.deleteTransaction(op.targetId),

  'recurringPayment:add': (op) => api.addRecurringPayment({ ...(op.payload as Partial<RecurringPayment>), id: op.targetId } as Omit<RecurringPayment, 'id'> & { id?: string }),
  'recurringPayment:update': (op) => api.updateRecurringPayment(
    op.targetId,
    withoutUndoSnapshot(op.payload) as unknown as RecurringPayment,
  ),
  'recurringPayment:delete': (op) => api.deleteRecurringPayment(op.targetId),
  'recurringPayment:toggle': (op) => api.toggleRecurringPayment(op.targetId, typeof op.payload?.active === 'boolean' ? op.payload.active : undefined),
  'recurringPayment:reminder': (op) => api.updateRecurringPaymentReminder(op.targetId, {
    enabled: op.payload?.reminderEnabled === true,
    mode: (typeof op.payload?.reminderMode === 'string' ? op.payload.reminderMode : 'Once') as 'Once' | 'Daily',
    leadDays: typeof op.payload?.reminderLeadDays === 'number' ? op.payload.reminderLeadDays : 1,
  }),
  'recurringPayment:payEarly': (op) => api.payRecurringPaymentEarly(
    op.targetId,
    typeof op.payload?.occurrenceDate === 'string' ? op.payload.occurrenceDate : '',
    op.id,
  ),

  'wishlistItem:add': (op) => api.addWishlistItem(op.payload as Partial<WishlistItem>, op.id),
  'wishlistItem:update': (op) => api.updateWishlistItem(
    Number(op.targetId),
    withoutUndoSnapshot(op.payload) as unknown as WishlistItem,
  ),
  'wishlistItem:delete': (op) => api.deleteWishlistItem(Number(op.targetId)),
  'wishlistItem:purchase': (op) => api.purchaseWishlistItem(Number(op.targetId), typeof op.payload?.date === 'string' ? op.payload.date : undefined),
  'wishlistItem:unpurchase': (op) => api.unpurchaseWishlistItem(Number(op.targetId)),

  // Authoring ops only. Money movement (contribute / fund-this-cycle / complete) is deliberately
  // NOT queued: each depends on the authoritative Rewards balance to enforce the
  // SUM(earmarked) <= balance invariant, and a replayed op could apply against a stale pool.
  // Those are online-only calls in lib/api/savingsGoals.ts.
  // Imported on demand (like './api/documents') to keep the savings-goal API module off the eager
  // critical path — a queued op only ever dispatches after the app is already running.
  'savingsGoal:add': async (op) => {
    const { addSavingsGoal } = await import('./api/savingsGoals')
    return addSavingsGoal(op.payload as Partial<SavingsGoal>, op.id)
  },
  'savingsGoal:update': async (op) => {
    // The undo snapshot is local bookkeeping for the toast's Undo action; strip it so it is never
    // sent as part of the goal body.
    const { updateSavingsGoal } = await import('./api/savingsGoals')
    return updateSavingsGoal(Number(op.targetId), withoutUndoSnapshot(op.payload) as unknown as SavingsGoal)
  },
  'savingsGoal:delete': async (op) => {
    const { deleteSavingsGoal } = await import('./api/savingsGoals')
    return deleteSavingsGoal(Number(op.targetId))
  },

  'category:add': (op) => api.addCategory({ ...(op.payload as Partial<TransactionCategory>), id: op.targetId } as Omit<TransactionCategory, 'id'> & { id?: string }),
  'category:update': (op) => api.updateCategoryCycleLimit(
    op.targetId,
    typeof op.payload?.cycleLimit === 'number' ? op.payload.cycleLimit : null,
  ),
  'category:delete': (op) => api.deleteCategory(op.targetId, typeof op.payload?.replacementCategoryId === 'string' ? op.payload.replacementCategoryId : undefined),
  'category:cleanup': (op) => api.applyCategoryCleanup(
    Array.isArray(op.payload?.actions) ? op.payload.actions as api.CategoryCleanupAction[] : [],
  ),

  'settings:update': (op) => {
    if (op.targetId === 'darkMode') return api.updateDarkMode(op.payload?.darkMode === true)
    if (op.targetId === 'hideSensitive') return api.updateHideSensitive(op.payload?.hideSensitive === true)
    if (op.targetId === 'summarySeen') return api.updateSummarySeen(typeof op.payload?.cycleKey === 'string' ? op.payload.cycleKey : null)
    return api.updateSettings(withoutUndoSnapshot(op.payload) as unknown as Pick<FinancialSetting, 'targetStabilityFund' | 'essentialsAlloc' | 'growthAlloc' | 'stabilityAlloc' | 'rewardsAlloc' | 'cycleDay'> & Partial<FinancialSetting>)
  },

  'investmentAccount:add': (op) => api.createInvestmentAccount({ ...(op.payload as unknown as api.AccountMutation), id: op.targetId }),
  'investmentAccount:update': (op) => api.updateInvestmentAccount(op.targetId, op.payload as unknown as api.AccountMutation),
  'investmentAccount:delete': (op) => api.deleteInvestmentAccount(op.targetId),

  'investmentInstrument:add': (op) => api.createInvestmentInstrument({ ...(op.payload as unknown as api.InstrumentMutation), id: op.targetId }),
  'investmentInstrument:update': (op) => api.updateInvestmentInstrument(op.targetId, op.payload as unknown as api.InstrumentMutation),
  'investmentInstrument:delete': (op) => api.deleteInvestmentInstrument(op.targetId),

  'investmentActivity:add': (op) => api.createInvestmentActivity({ ...(op.payload as unknown as api.InvestmentActivityMutation), id: op.targetId }),
  'investmentActivity:update': (op) => api.updateInvestmentActivity(op.targetId, op.payload as unknown as api.InvestmentActivityMutation),
  'investmentActivity:delete': (op) => api.deleteInvestmentActivity(op.targetId),
  'investmentActivity:restore': (op) => api.restoreInvestmentActivity(op.payload as unknown as api.DeletedTransactionsSnapshot),

  'investmentCashFlow:add': (op) => api.createInvestmentCashFlow({
    ...(op.payload as unknown as Parameters<typeof api.createInvestmentCashFlow>[0]),
    id: op.targetId,
  }),
  'investmentCashFlow:update': (op) => api.updateInvestmentCashFlow(op.targetId, op.payload as unknown as api.InvestmentCashFlowInput),
  'investmentCashFlow:delete': (op) => api.deleteInvestmentCashFlow(op.targetId),
  'investmentCashFlow:restore': (op) => api.restoreInvestmentCashFlow(op.payload as unknown as InvestmentCashFlow),

  'investmentPlan:update': (op) => api.updateInvestmentPlan(
    withoutUndoSnapshot(op.payload) as unknown as Parameters<typeof api.updateInvestmentPlan>[0],
  ),
  'investmentAllocation:update': (op) => api.updateInvestmentAllocationSleeve(
    op.targetId,
    typeof op.payload?.sleeve === 'string' ? op.payload.sleeve as InvestmentAllocationSleeve : undefined,
  ),
  'investmentAllocationOrder:update': (op) => api.updateInvestmentAllocationOrder(
    Array.isArray(op.payload?.instrumentIds)
      ? op.payload.instrumentIds.filter((value): value is string => typeof value === 'string')
      : [],
  ),
  'taxReliefCategory:add': async (op) => {
    const documents = await import('./api/documents')
    return documents.addTaxReliefCategory(Number(op.payload?.taxYear), {
      name: String(op.payload?.name ?? ''),
      limit: Number(op.payload?.limit),
    })
  },
  'taxReliefCategory:update': async (op) => {
    const documents = await import('./api/documents')
    return documents.updateTaxReliefCategory(Number(op.payload?.taxYear), op.targetId, {
      name: String(op.payload?.name ?? ''),
      limit: Number(op.payload?.limit),
    })
  },
  'taxReliefCategory:delete': async (op) => {
    const documents = await import('./api/documents')
    return documents.deleteTaxReliefCategory(Number(op.payload?.taxYear), op.targetId)
  },
}

function isWellFormedOp(op: unknown): op is QueuedOp {
  if (!op || typeof op !== 'object') return false
  const o = op as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    typeof o.entity === 'string' &&
    ['transaction', 'recurringPayment', 'wishlistItem', 'savingsGoal', 'category', 'settings', 'investmentAccount', 'investmentInstrument', 'investmentActivity', 'investmentCashFlow', 'investmentPlan', 'investmentAllocation', 'investmentAllocationOrder', 'taxReliefCategory'].includes(o.entity as string) &&
    typeof o.type === 'string' &&
    ['add', 'update', 'delete', 'restore', 'toggle', 'purchase', 'unpurchase', 'reminder', 'payEarly', 'cleanup'].includes(o.type as string) &&
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
