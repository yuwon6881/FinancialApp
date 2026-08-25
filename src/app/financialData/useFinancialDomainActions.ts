import type {
  Transaction,
  RecurringPayment,
  TransactionCategory,
  WishlistItem,
  SavingsGoal,
  DashboardData,
  LedgerAccount,
  Loan,
  TransactionDocumentChanges,
} from '../../types'
import type { OutboxPayload, QueuedOp } from '../../lib/outbox'
import type { ToastAction, ToastTone } from '../../components/ui/ToastViewport'
import type { ConfirmModalData } from '../useAppDialogs'
import { createSettingsActions } from './settingsActions'
import { createCategoryActions } from './categoryActions'
import { useTransactionActions } from './useTransactionActions'
import { createRecurringActions } from './recurringActions'
import { createWishlistSavingsActions } from './wishlistSavingsActions'
import { createLoanActions } from './loanActions'
import { createLedgerAccountActions } from './accountActions'

export interface UseFinancialDomainActionsOptions {
  darkMode: boolean
  hideSensitive: boolean
  dashboardData: DashboardData | null
  guardSensitive: () => boolean
  mutateQueue: (modifier: (ops: QueuedOp[]) => QueuedOp[]) => void
  unconfirmedSettingWritesRef: React.MutableRefObject<Map<string, unknown>>
  setDashboardData: React.Dispatch<React.SetStateAction<DashboardData | null>>
  allCategories: TransactionCategory[]
  allRecurringPayments: RecurringPayment[]
  snapshotForUndo: (entity: any, targetId: string, value: any) => void
  setConfirmModalData: React.Dispatch<React.SetStateAction<ConfirmModalData | null>>
  showToast: (message: string, title?: string, tone?: ToastTone, action?: ToastAction) => void
  username: string
  selectedMonth: string
  selectedYear: number
  editingPendingId: string | null
  draftTransactions: Transaction[]
  allTransactions: Transaction[]
  allSavingsGoals: SavingsGoal[]
  createLocalId: (prefix: string, separator?: string) => string
  stageTransactionDocumentChanges: (targetId: string, changes: TransactionDocumentChanges) => void
  loadAll: (
    month?: string,
    year?: number,
    isBackground?: boolean,
    rethrowOnError?: boolean,
    shouldCommit?: () => boolean,
  ) => Promise<void>
  beginDirectSync: (ids: Array<string | number>) => void
  endDirectSync: (ids: Array<string | number>) => void
  removePendingLedgerTransaction: (id: string) => void
  pendingTransactionDocumentsRef: React.MutableRefObject<Map<string, TransactionDocumentChanges>>
  pendingTransactionDocumentDeletesRef: React.MutableRefObject<Map<string, number[]>>
  setDraftTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>
  setDeletingTxId: (id: string | null) => void
  setEditingPendingId: (id: string | null) => void
  formatSensitive: (val: number) => string
  toOutboxPayload: (value: object) => OutboxPayload
  wishlist: WishlistItem[]
  savingsGoals: SavingsGoal[]
  allWishlist: WishlistItem[]
  currency: string
  enqueue: (
    queue: QueuedOp[],
    entity: any,
    type: any,
    targetId: string,
    payload?: OutboxPayload,
    isUndo?: boolean,
  ) => QueuedOp[]
  setSavingsGoals: React.Dispatch<React.SetStateAction<SavingsGoal[]>>
  addPendingLedgerTransaction: (transaction: Transaction) => void
  replacePendingLedgerTransaction: (pendingId: string, transaction: Transaction) => void
  allLoans: Loan[]
  allAccounts: LedgerAccount[]
  onNavigateToLedger?: (options: {
    category?: string | null
    range?: 'monthly' | '3month' | '6month' | 'yearly' | 'all'
    showAllCycles?: boolean
    search?: string | null
    date?: string | null
    highlightedTxId?: string | null
  }) => void
}

export function useFinancialDomainActions(options: UseFinancialDomainActionsOptions) {
  const {
    darkMode,
    hideSensitive,
    dashboardData,
    guardSensitive,
    mutateQueue,
    unconfirmedSettingWritesRef,
    setDashboardData,
    allCategories,
    allRecurringPayments,
    snapshotForUndo,
    setConfirmModalData,
    showToast,
    username,
    selectedMonth,
    selectedYear,
    editingPendingId,
    draftTransactions,
    allTransactions,
    allSavingsGoals,
    createLocalId,
    stageTransactionDocumentChanges,
    loadAll,
    beginDirectSync,
    endDirectSync,
    removePendingLedgerTransaction,
    pendingTransactionDocumentsRef,
    pendingTransactionDocumentDeletesRef,
    setDraftTransactions,
    setDeletingTxId,
    setEditingPendingId,
    formatSensitive,
    toOutboxPayload,
    wishlist,
    savingsGoals,
    allWishlist,
    currency,
    enqueue,
    setSavingsGoals,
    addPendingLedgerTransaction,
    replacePendingLedgerTransaction,
    allLoans,
    allAccounts,
  } = options

  const settingsActions = createSettingsActions({
    darkMode,
    hideSensitive,
    dashboardData,
    guardSensitive,
    mutateQueue,
    unconfirmedSettingWritesRef,
    setDashboardData,
  })

  const categoryActions = createCategoryActions({
    allCategories,
    allRecurringPayments,
    guardSensitive,
    mutateQueue,
    snapshotForUndo,
    setConfirmModalData,
    showToast,
    onNavigateToLedger: options.onNavigateToLedger,
  })

  const transactionActions = useTransactionActions({
    username,
    selectedMonth,
    selectedYear,
    editingPendingId,
    draftTransactions,
    allTransactions,
    allCategories,
    allSavingsGoals,
    guardSensitive,
    createLocalId,
    stageTransactionDocumentChanges,
    loadAll,
    beginDirectSync,
    endDirectSync,
    removePendingLedgerTransaction,
    mutateQueue,
    snapshotForUndo,
    pendingTransactionDocumentsRef,
    pendingTransactionDocumentDeletesRef,
    setDraftTransactions,
    setDeletingTxId,
    setEditingPendingId,
    setConfirmModalData,
    showToast,
  })

  const recurringActions = createRecurringActions({
    allRecurringPayments,
    guardSensitive,
    formatSensitive,
    toOutboxPayload,
    mutateQueue,
    snapshotForUndo,
    setConfirmModalData,
    showToast,
  })

  const wishlistSavingsActions = createWishlistSavingsActions({
    wishlist,
    savingsGoals,
    allWishlist,
    allSavingsGoals,
    currency,
    editingPendingId,
    guardSensitive,
    showToast,
    setConfirmModalData,
    setEditingPendingId,
    enqueue,
    mutateQueue,
    snapshotForUndo,
    setSavingsGoals,
    beginDirectSync,
    endDirectSync,
    getGoal: (id: number) => allSavingsGoals.find(goal => goal.id === id),
    getActiveGoalIds: () => allSavingsGoals.filter(goal => goal.status === 'active').map(goal => goal.id),
    addPendingLedgerTransaction,
    replacePendingLedgerTransaction,
    removePendingLedgerTransaction,
    setDeletingTransactionId: setDeletingTxId,
    refreshAll: () => loadAll(selectedMonth || undefined, selectedYear || undefined, true, false, () => true),
  })

  const loanActions = createLoanActions({
    loans: allLoans,
    recurringPayments: allRecurringPayments,
    guardSensitive,
    enqueue,
    mutateQueue,
    snapshotForUndo,
    setConfirmModalData,
  })

  const accountActions = createLedgerAccountActions({
    accounts: allAccounts,
    guardSensitive,
    enqueue,
    mutateQueue,
    snapshotForUndo,
    setConfirmModalData,
  })

  return {
    ...settingsActions,
    ...categoryActions,
    ...transactionActions,
    ...recurringActions,
    ...wishlistSavingsActions,
    ...loanActions,
    ...accountActions,
  }
}
