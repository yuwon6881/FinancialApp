import * as api from './api'
import type { CategoryFlowType, FinancialSetting, InvestmentCashFlow, InvestmentAllocationSleeve, LedgerAccount, RecurringPayment, SavingsGoal, Transaction, TransactionCategory, WishlistItem } from '../types'
import type { DispatchResult, OutboxPayload, QueuedOp } from './outbox'
import type { BulkTransactionMutationResult } from './api/transactionBulk'

const withoutUndoSnapshot = (payload: OutboxPayload | undefined): OutboxPayload => {
  const requestPayload = { ...(payload ?? {}) }
  delete requestPayload.undoSnapshot
  return requestPayload
}

async function dispatchBulkTransaction(op: QueuedOp): Promise<BulkTransactionMutationResult> {
  const { dispatchBulkTransaction: dispatch } = await import('./api/transactionBulk')
  return dispatch(op)
}

export const DISPATCH: Record<string, (op: QueuedOp) => Promise<DispatchResult>> = {
  'transaction:bulkDelete': dispatchBulkTransaction,
  'transaction:bulkRestore': dispatchBulkTransaction,
  'transaction:add': (op) => api.addTransaction({ ...(withoutUndoSnapshot(op.payload) as Partial<Transaction>), id: op.targetId } as Omit<Transaction, 'id'> & { id?: string }),
  'transaction:update': (op) => api.updateTransaction(op.targetId, withoutUndoSnapshot(op.payload) as unknown as Omit<Transaction, 'id'>),
  'transaction:delete': (op) => api.deleteTransaction(op.targetId),

  'recurringPayment:add': (op) => api.addRecurringPayment({ ...(op.payload as Partial<RecurringPayment>), id: op.targetId } as Omit<RecurringPayment, 'id'> & { id?: string }),
  'recurringPayment:update': (op) => api.updateRecurringPayment(op.targetId, withoutUndoSnapshot(op.payload) as unknown as RecurringPayment),
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
    typeof op.payload?.accountId === 'string' ? op.payload.accountId : undefined,
    op.id,
  ),
  'recurringOccurrence:settle': (op) => api.settleRecurringOccurrence(
    typeof op.payload?.recurringPaymentId === 'string' ? op.payload.recurringPaymentId : '',
    typeof op.payload?.occurrenceDate === 'string' ? op.payload.occurrenceDate : '',
    op.payload?.status === 'Discarded' ? 'Discarded' : 'Paid',
    typeof op.payload?.paidDate === 'string' ? op.payload.paidDate : undefined,
    typeof op.payload?.accountId === 'string' ? op.payload.accountId : undefined,
    op.id,
    op.payload?.optimisticTransaction && typeof op.payload.optimisticTransaction === 'object' && 'id' in op.payload.optimisticTransaction
      ? String(op.payload.optimisticTransaction.id)
      : undefined,
    op.payload?.optimisticTransaction && typeof op.payload.optimisticTransaction === 'object' && 'postedAt' in op.payload.optimisticTransaction
      ? String(op.payload.optimisticTransaction.postedAt)
      : undefined,
  ),

  'wishlistItem:add': (op) => api.addWishlistItem(op.payload as Partial<WishlistItem>, op.id),
  'wishlistItem:update': (op) => api.updateWishlistItem(Number(op.targetId), withoutUndoSnapshot(op.payload) as unknown as WishlistItem),
  'wishlistItem:delete': (op) => api.deleteWishlistItem(Number(op.targetId)),
  'wishlistItem:purchase': (op) => api.purchaseWishlistItem(
    Number(op.targetId),
    typeof op.payload?.date === 'string' ? op.payload.date : undefined,
    typeof op.payload?.purchaseTransactionId === 'string' ? op.payload.purchaseTransactionId : undefined,
    typeof op.payload?.postedAt === 'string' ? op.payload.postedAt : undefined,
    typeof op.payload?.accountId === 'string' ? op.payload.accountId : undefined,
  ),
  'wishlistItem:unpurchase': (op) => api.unpurchaseWishlistItem(Number(op.targetId)),

  // Authoring ops only. Money movement is deliberately online-only because it depends on the
  // authoritative Rewards balance and cannot be safely replayed against stale offline state.
  'savingsGoal:add': async (op) => {
    const { addSavingsGoal } = await import('./api/savingsGoals')
    return addSavingsGoal(op.payload as Partial<SavingsGoal>, op.id)
  },
  'savingsGoal:update': async (op) => {
    const { updateSavingsGoal } = await import('./api/savingsGoals')
    return updateSavingsGoal(Number(op.targetId), withoutUndoSnapshot(op.payload) as unknown as SavingsGoal)
  },
  'savingsGoal:delete': async (op) => {
    const { deleteSavingsGoal } = await import('./api/savingsGoals')
    return deleteSavingsGoal(Number(op.targetId))
  },

  'loan:add': async (op) => {
    const { addLoan } = await import('./api/loans')
    return addLoan({ ...(op.payload as Partial<import('../types').Loan>), id: op.targetId })
  },
  'loan:update': async (op) => {
    const { updateLoan } = await import('./api/loans')
    return updateLoan(op.targetId, withoutUndoSnapshot(op.payload) as unknown as import('../types').Loan)
  },
  'loan:delete': async (op) => {
    const { deleteLoan } = await import('./api/loans')
    return deleteLoan(op.targetId)
  },

  'ledgerAccount:add': async (op) => {
    const { addLedgerAccount } = await import('./api/accounts')
    return addLedgerAccount({ ...(op.payload as Partial<LedgerAccount>), id: op.targetId } as import('./api/accounts').LedgerAccountMutation)
  },
  'ledgerAccount:update': async (op) => {
    const { updateLedgerAccount } = await import('./api/accounts')
    return updateLedgerAccount(op.targetId, withoutUndoSnapshot(op.payload) as unknown as import('./api/accounts').LedgerAccountMutation)
  },
  'ledgerAccount:delete': async (op) => {
    const { deleteLedgerAccount } = await import('./api/accounts')
    return deleteLedgerAccount(op.targetId)
  },
  'ledgerAccountReconcile:add': async (op) => {
    const { reconcileLedgerAccounts } = await import('./api/accounts')
    return reconcileLedgerAccounts(op.payload?.reconciliation as import('./api/accounts').LedgerAccountReconcileInput)
  },

  'category:add': (op) => api.addCategory({ ...(op.payload as Partial<TransactionCategory>), id: op.targetId } as Omit<TransactionCategory, 'id'> & { id?: string }),
  'category:update': (op) => api.updateCategory(op.targetId, {
    cycleLimit: typeof op.payload?.cycleLimit === 'number' ? op.payload.cycleLimit : (op.payload?.cycleLimit === null ? null : undefined),
    type: typeof op.payload?.type === 'string' ? op.payload.type as CategoryFlowType : undefined,
  }),
  'category:delete': (op) => api.deleteCategory(op.targetId, typeof op.payload?.replacementCategoryId === 'string' ? op.payload.replacementCategoryId : undefined),
  'category:cleanup': (op) => api.applyCategoryCleanup(
    Array.isArray(op.payload?.actions) ? op.payload.actions as api.CategoryCleanupAction[] : [],
  ),

  'settings:update': (op) => {
    if (op.targetId === 'darkMode') return api.updateDarkMode(op.payload?.darkMode === true)
    if (op.targetId === 'hideSensitive') return api.updateHideSensitive(op.payload?.hideSensitive === true)
    if (op.targetId === 'summarySeen') return api.updateSummarySeen(typeof op.payload?.cycleKey === 'string' ? op.payload.cycleKey : null)
    if (op.targetId === 'selectedPeriod') return api.selectPeriod(
      typeof op.payload?.selectedMonth === 'string' ? op.payload.selectedMonth : '',
      typeof op.payload?.selectedYear === 'number' ? op.payload.selectedYear : 0,
    )
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
    amount: Math.abs(Number(op.payload?.amount ?? 0)),
    id: op.targetId,
  }),
  'investmentCashFlow:update': (op) => api.updateInvestmentCashFlow(op.targetId, {
    ...(op.payload as unknown as api.InvestmentCashFlowInput),
    amount: Math.abs(Number(op.payload?.amount ?? 0)),
  }),
  'investmentCashFlow:delete': (op) => api.deleteInvestmentCashFlow(op.targetId),
  'investmentCashFlow:restore': (op) => api.restoreInvestmentCashFlow(op.payload as unknown as InvestmentCashFlow),
  'investmentPlan:update': (op) => api.updateInvestmentPlan(withoutUndoSnapshot(op.payload) as unknown as Parameters<typeof api.updateInvestmentPlan>[0]),
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
    return documents.addTaxReliefCategory(Number(op.payload?.taxYear), { name: String(op.payload?.name ?? ''), limit: Number(op.payload?.limit) })
  },
  'taxReliefCategory:update': async (op) => {
    const documents = await import('./api/documents')
    return documents.updateTaxReliefCategory(Number(op.payload?.taxYear), op.targetId, { name: String(op.payload?.name ?? ''), limit: Number(op.payload?.limit) })
  },
  'taxReliefCategory:delete': async (op) => {
    const documents = await import('./api/documents')
    return documents.deleteTaxReliefCategory(Number(op.payload?.taxYear), op.targetId)
  },
}
