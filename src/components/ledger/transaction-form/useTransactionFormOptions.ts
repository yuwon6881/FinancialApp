import type { AutocompleteSuggestion, StabilityRecovery, Transaction, TransactionCategory, TransactionDocumentChanges } from '../../../types'
import type { ReceiptScanResult } from '../../../lib/api'
import type { SensitivePreferenceStatus } from '../../../app/useAppPreferences'

export interface UseTransactionFormOptions {
  categories: TransactionCategory[]
  currency: string
  hideSensitive: boolean
  sensitivePreferenceStatus?: SensitivePreferenceStatus
  autocompleteSuggestions: AutocompleteSuggestion[]
  transactions: Transaction[]
  essentialsAlloc: number
  growthAlloc: number
  stabilityAlloc: number
  rewardsAlloc: number
  stabilityBalance: number
  stabilityTarget: number
  stabilityOverflowRedirect: string
  stabilityRecovery?: StabilityRecovery
  essentialsBalance?: number
  growthBalance?: number
  rewardsBalance?: number
  onAddTransaction: (transaction: Omit<Transaction, 'id'>, documentChanges?: TransactionDocumentChanges) => Promise<string | void> | string | void
  onUpdateTransaction?: (id: string, transaction: Omit<Transaction, 'id'>, documentChanges?: TransactionDocumentChanges) => Promise<void> | void
  onUpdateDraftTransaction?: (id: string, transaction: Omit<Transaction, 'id'>, documentChanges: TransactionDocumentChanges) => Promise<void> | void
  onLoadDraftDocumentChanges?: (id: string) => Promise<TransactionDocumentChanges>
  onStartEditPending?: (id: string | null) => void
  onAddFormOpenChange?: (open: boolean) => void
  autoOpenAddForm?: boolean
  autoOpenTxType?: 'inflow' | 'outflow' | 'transfer' | null
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
