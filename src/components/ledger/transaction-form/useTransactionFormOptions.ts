import type {
  ActiveRecurringPayment,
  AutocompleteSuggestion,
  CategorySummary,
  LedgerAccount,
  SavingsGoal,
  StabilityRecovery,
  Transaction,
  TransactionCategory,
  TransactionDocumentChanges,
} from '../../../types'
import type { StabilityReloadPlanPoint } from '../../../lib/stabilityRecovery'
import type { ReceiptScanResult } from '../../../lib/api'
import type { SensitivePreferenceStatus } from '../../../app/useAppPreferences'
import type { LedgerAddPrefill } from '../../../app/useCycleNavigation'

export interface StabilityTopUpContext {
  recovery: StabilityRecovery
  cycleYear: number
  cycleMonthIndex: number
  cycleDay: number
  essentialsAlloc: number
  growthAlloc: number
  stabilityAlloc: number
  rewardsAlloc: number
  essentialsBalance: number
  growthBalance: number
  rewardsBalance: number
  stabilityOverflowRedirect: string
  planPoints?: StabilityReloadPlanPoint[]
  currentCycleKey?: string
}

export interface UseTransactionFormOptions {
  categories: TransactionCategory[]
  accounts?: LedgerAccount[]
  accountsLoading?: boolean
  currency: string
  hideSensitive: boolean
  sensitivePreferenceStatus?: SensitivePreferenceStatus
  autocompleteSuggestions: AutocompleteSuggestion[]
  transactions: Transaction[]
  essentialsAlloc: number
  growthAlloc: number
  stabilityAlloc: number
  rewardsAlloc: number
  cycleDay: number
  stabilityBalance: number
  stabilityTarget: number
  stabilityOverflowRedirect: string
  stabilityTopUpContext?: StabilityTopUpContext
  savingsGoals?: SavingsGoal[]
  activeRecurringPayments?: ActiveRecurringPayment[]
  ledgerSummaries?: CategorySummary[]
  onAddTransaction: (transaction: Omit<Transaction, 'id'>, documentChanges?: TransactionDocumentChanges) => Promise<string | void> | string | void
  onUpdateTransaction?: (id: string, transaction: Omit<Transaction, 'id'>, documentChanges?: TransactionDocumentChanges) => Promise<void> | void
  onUpdateDraftTransaction?: (id: string, transaction: Omit<Transaction, 'id'>, documentChanges: TransactionDocumentChanges) => Promise<void> | void
  onLoadDraftDocumentChanges?: (id: string) => Promise<TransactionDocumentChanges>
  onStartEditPending?: (id: string | null) => void
  onAddFormOpenChange?: (open: boolean) => void
  autoOpenAddForm?: boolean
  autoOpenTxType?: 'inflow' | 'outflow' | 'transfer' | null
  autoOpenPrefill?: LedgerAddPrefill | null
  onResetAutoOpen?: () => void
  receiptScanDraft?: { jobId: string; result: ReceiptScanResult } | null
  onReceiptScanStarted?: (scanId: string) => void
  onReceiptScanCleared?: (scanId: string) => void | Promise<void>
  activeScanJobIds?: string[]
  failedScanJob?: { jobId: string; errorMessage: string } | null
  aiEditDraft?: { nonce: number; id: string; changes: Record<string, unknown> } | null
  onAiEditDraftConsumed?: () => void
  onFetchTransactionById?: (id: string) => Promise<Transaction>
  onShowAlert?: (message: string, title?: string) => void
}
