import { buildAccountReconcileTransactions } from './accountReconcileTransactionProjection'
import type { EntityKind, QueuedOp } from './outboxTypes'
import type { ApplyOpsOptions, ProjectionRow, ProjectionRows } from './outboxProjectionRows'

/**
 * Ops whose optimistic effect lands on a list they do not belong to -- a wishlist purchase that
 * writes a ledger row, a settled occurrence that moves a bill's next due date, a category cleanup
 * that recategorises transactions. Returning `true` means the op is fully projected and the
 * same-entity pass must not see it.
 */
export function applyCrossEntityOp<T extends ProjectionRow>(
  rows: ProjectionRows<T>,
  op: QueuedOp,
  entity: EntityKind,
  options?: ApplyOpsOptions,
): boolean {
  const targetStr = String(op.targetId)

  if (entity === 'transaction' && op.entity === 'ledgerAccountReconcile' && op.type === 'add') {
    const reconciliation = op.payload?.reconciliation as {
      bucket?: string
      expectedBucketTotal?: number
      targets?: Array<{ id?: string | null; expectedCurrent?: number; target?: number; isArchived?: boolean }>
    } | undefined
    const projectedRows = buildAccountReconcileTransactions({
      operationId: op.targetId,
      createdAt: op.createdAt,
      ...reconciliation,
    })
    for (const row of projectedRows) {
      const visibleRange = options?.transactionDateRange
      if (visibleRange && (row.date < visibleRange.start || row.date > visibleRange.end)) continue
      if (rows.findIndex(row.id) < 0) {
        rows.rows = [{ ...row, isPendingSync: !op.isCompleted, pendingSyncOperationId: op.isCompleted ? undefined : op.id } as unknown as T, ...rows.rows]
      }
    }
    return true
  }

  if (entity === 'wishlistItem' && op.entity === 'transaction' && (op.type === 'add' || op.type === 'delete')) {
    const nestedSnapshot = op.payload?.undoSnapshot && typeof op.payload.undoSnapshot === 'object'
      ? op.payload.undoSnapshot as Record<string, unknown>
      : undefined
    const rawWishlistItemId = op.payload?.wishlistItemId ?? nestedSnapshot?.wishlistItemId
    const wishlistItemId = rawWishlistItemId == null ? '' : String(rawWishlistItemId)
    const existingIndex = wishlistItemId
      ? rows.findIndex(wishlistItemId)
      : -1
    if (existingIndex >= 0) {
      rows.rows[existingIndex] = op.type === 'delete'
        ? {
            ...rows.rows[existingIndex],
            isPurchased: false,
            purchasedAt: null,
            purchaseTransactionId: null,
            isPendingSync: !op.isCompleted,
            pendingSyncOperationId: op.isCompleted ? undefined : op.id,
          } as unknown as T
        : {
            ...rows.rows[existingIndex],
            isPurchased: true,
            isActive: false,
            purchasedAt: typeof op.payload?.date === 'string' ? op.payload.date : undefined,
            purchaseTransactionId: op.targetId,
            isPendingSync: !op.isCompleted,
            pendingSyncOperationId: op.isCompleted ? undefined : op.id,
          } as unknown as T
    }
    return true
  }

  if (entity === 'recurringPayment' && op.entity === 'transaction' && op.type === 'delete') {
    const snapshot = op.payload?.undoSnapshot && typeof op.payload.undoSnapshot === 'object'
      ? op.payload.undoSnapshot as Record<string, unknown>
      : op.payload as Record<string, unknown> | undefined
    const paymentId = typeof snapshot?.recurringPaymentId === 'string' ? snapshot.recurringPaymentId : ''
    const occurrenceDate = typeof snapshot?.recurringOccurrenceDate === 'string' ? snapshot.recurringOccurrenceDate : ''
    const existingIndex = paymentId ? rows.findIndex(paymentId) : -1
    if (existingIndex >= 0 && occurrenceDate) {
      rows.rows[existingIndex] = {
        ...rows.rows[existingIndex],
        nextDueDate: occurrenceDate,
        isPendingSync: !op.isCompleted,
        pendingSyncOperationId: op.isCompleted ? undefined : op.id,
      } as unknown as T
    }
    return true
  }

  if (op.entity === 'recurringPayment' && op.type === 'reminder' && entity === 'recurringPayment') {
    const existingIndex = rows.findIndex(targetStr)
    if (existingIndex >= 0) {
      rows.rows[existingIndex] = {
        ...rows.rows[existingIndex],
        ...(typeof op.payload?.reminderEnabled === 'boolean' ? { reminderEnabled: op.payload.reminderEnabled } : {}),
        ...(typeof op.payload?.reminderMode === 'string' ? { reminderMode: op.payload.reminderMode } : {}),
        ...(typeof op.payload?.reminderLeadDays === 'number' ? { reminderLeadDays: op.payload.reminderLeadDays } : {}),
        isPendingSync: !op.isCompleted,
        pendingSyncOperationId: op.isCompleted ? undefined : op.id,
      } as unknown as T
    }
    return true
  }

  if (op.entity === 'recurringPayment' && op.type === 'payEarly') {
    if (entity === 'recurringPayment') {
      const existingIndex = rows.findIndex(targetStr)
      if (existingIndex >= 0) {
        const nextDate = op.isCompleted
          ? (typeof op.payload?.nextOccurrenceDate === 'string'
            ? op.payload.nextOccurrenceDate
            : typeof op.payload?.settledOccurrenceDate === 'string' ? op.payload.settledOccurrenceDate : undefined)
          : typeof op.payload?.optimisticNextOccurrenceDate === 'string'
            ? op.payload.optimisticNextOccurrenceDate
            : undefined
        rows.rows[existingIndex] = {
          ...rows.rows[existingIndex],
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
        const existingIndex = transactionId
          ? rows.findIndex(transactionId)
          : rows.rows.findIndex(item =>
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
        if (existingIndex >= 0) rows.rows[existingIndex] = { ...rows.rows[existingIndex], ...projected }
        else rows.rows = [projected, ...rows.rows]
      }
    }
    return true
  }

  if (op.entity === 'recurringOccurrence' && op.type === 'settle') {
    if (entity === 'recurringPayment') {
      const paymentId = typeof op.payload?.recurringPaymentId === 'string' ? op.payload.recurringPaymentId : ''
      const existingIndex = rows.findIndex(paymentId)
      if (existingIndex >= 0) {
        const nextDate = op.isCompleted
          ? op.payload?.nextOccurrenceDate
          : op.payload?.optimisticNextOccurrenceDate
        rows.rows[existingIndex] = {
          ...rows.rows[existingIndex],
          nextDueDate: typeof nextDate === 'string' ? nextDate : null,
          isPendingSync: !op.isCompleted,
          pendingSyncOperationId: op.isCompleted ? undefined : op.id,
        } as unknown as T
      }
    } else if (entity === 'transaction') {
      const rawTransaction = op.isCompleted ? op.payload?.resultTransaction : op.payload?.optimisticTransaction
      if (rawTransaction && typeof rawTransaction === 'object') {
        const transaction = rawTransaction as Record<string, unknown>
        const transactionId = typeof transaction.id === 'string' ? transaction.id : `tx-${op.id}`
        const existingIndex = rows.findIndex(transactionId)
        const projected = {
          ...transaction,
          id: transactionId,
          isPendingDelete: false,
          isPendingSync: !op.isCompleted,
          pendingSyncOperationId: op.isCompleted ? undefined : op.id,
        } as unknown as T
        if (existingIndex >= 0) rows.rows[existingIndex] = { ...rows.rows[existingIndex], ...projected }
        else rows.rows = [projected, ...rows.rows]
      }
    }
    return true
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
          const existingIndex = rows.rows.findIndex(item => {
            const itemName = (item as T & { name?: string }).name
            return String(item.id) === categoryId || (typeof itemName === 'string' && itemName.toLowerCase() === name.toLowerCase())
          })
          const projected = {
            ...(existingIndex >= 0 ? rows.rows[existingIndex] : {}),
            id: categoryId,
            name,
            cycleLimit: existingIndex >= 0 ? (rows.rows[existingIndex] as T & { cycleLimit?: number | null }).cycleLimit ?? null : null,
            isPendingSync: !op.isCompleted,
            isPendingDelete: false,
          } as unknown as T
          if (existingIndex >= 0) rows.rows[existingIndex] = projected
          else rows.rows = [projected, ...rows.rows]
        } else if (sourceNames.size > 0 && (actionType === 'delete' || actionType === 'deleteByName' || actionType === 'merge')) {
          rows.rows = op.isCompleted
            ? rows.rows.filter(item => {
                const itemName = (item as T & { name?: string }).name
                return !(typeof itemName === 'string' && sourceNames.has(itemName.trim().toLowerCase()))
              })
            : rows.rows.map(item => {
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
          rows.rows = rows.rows.map(item => {
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
    return true
  }

  if (op.entity === 'category' && op.type === 'delete' && (entity === 'transaction' || entity === 'recurringPayment')) {
    // The API moves both ledger transactions and recurring payments to the selected replacement
    // category in the same request. Keep those dependent records visibly pending too.
    const sourceName = typeof op.payload?.name === 'string' ? op.payload.name.trim().toLowerCase() : ''
    const replacementName = typeof op.payload?.replacementCategoryName === 'string'
      ? op.payload.replacementCategoryName
      : ''
    if (sourceName && replacementName) {
      rows.rows = rows.rows.map(item => {
        const category = (item as T & { category?: string }).category
        return typeof category === 'string' && category.trim().toLowerCase() === sourceName
          ? { ...item, category: replacementName, isPendingSync: !op.isCompleted, pendingSyncOperationId: op.isCompleted ? undefined : op.id }
          : item
      })
    }
    return true
  }

  return false
}
