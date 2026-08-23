import type { BulkTransactionMutationResult } from './api/transactionBulk'
import type { LedgerAccountReconcileResult } from './api/accounts'
import type { CategoryCleanupApplyResult } from './api/categories'
import type { DeletedTransactionsSnapshot } from './api/investments'
import type { InvestmentAccount, InvestmentActivity, InvestmentCashFlow, InvestmentInstrument, InvestmentPlan, LedgerAccount, Loan, PayEarlyResult, RecurringPayment, RecurringSettlementResult, SavingsGoal, TaxReliefCategoryDefinition, Transaction, TransactionCategory, WishlistItem } from '../types'


// Loan balances are replayed from the full-history bootstrap snapshot, not from the cycle-scoped
// transaction list projected below. Keep the projection helper adjacent to the outbox so all active
// and recently-completed operations use the same replay boundary without growing this file with a
// second feature-specific branch.

export type EntityKind = 'transaction' | 'recurringPayment' | 'recurringOccurrence' | 'wishlistItem' | 'savingsGoal' | 'category' | 'settings' | 'loan'
  | 'investmentAccount' | 'investmentInstrument' | 'investmentActivity' | 'investmentCashFlow'
  | 'investmentPlan' | 'investmentAllocation'
  | 'investmentAllocationOrder' | 'taxReliefCategory'
  | 'ledgerAccount' | 'ledgerAccountReconcile'
export type OpType = 'add' | 'update' | 'delete' | 'restore' | 'toggle' | 'purchase' | 'unpurchase'
  | 'reminder' | 'payEarly' | 'settle' | 'cleanup' | 'bulkDelete' | 'bulkRestore' | 'bulkMove'
  | 'advanceRepayment' | 'fullSettlement' | 'undoRepayment'
export interface OutboxPayload {
  [key: string]: unknown
  id?: string | number
  name?: string
  description?: string
  category?: string
  ledgerCategory?: string
  amount?: number
  stabilityRecoveryTopUpAmount?: number | null
  stabilityReloadIntent?: 'Unanswered' | 'Required' | 'NotRequired'
  price?: number
  active?: boolean
  darkMode?: boolean
  hideSensitive?: boolean
  purchasedAt?: string
  purchaseTransactionId?: string | null
  replacementCategoryId?: string
  cycleLimit?: number | null
  selectedMonth?: string
  selectedYear?: number
  date?: string
  postedAt?: string
  createdAt?: string
  reminderEnabled?: boolean
  reminderMode?: string
  reminderLeadDays?: number
  paymentMode?: string
  occurrenceDate?: string
  optimisticNextOccurrenceDate?: string
  settledOccurrenceDate?: string
  nextOccurrenceDate?: string | null
  optimisticTransaction?: unknown
  resultTransaction?: unknown
  actions?: unknown
  taxYear?: number
  transactions?: unknown
  transactionIds?: unknown
  moves?: unknown
  beforeSnapshots?: unknown
  /** Attached vault documents this delete also removes, for the success toast's honesty clause. */
  deletedDocumentCount?: number
  openingPrincipal?: number
  trackingStartDate?: string
  annualRatePercent?: number
  termPeriods?: number
  interestMethod?: string
  rateBasis?: string
  recurringPaymentId?: string | null
  scheduleFrequency?: string | null
  scheduleDueDay?: number | null
  scheduleStartDate?: string | null
  scheduleStatus?: string
  accountId?: string | null
  counterAccountId?: string | null
  splitAccountIds?: Record<string, string> | null
  bucket?: string
  kind?: string
  isArchived?: boolean
  openingAmount?: number
  remaining?: number
  reconciliation?: unknown
  undoReconciliation?: unknown
}
export type DispatchResult =
  | Transaction
  | RecurringPayment
  | WishlistItem
  | Loan
  | LedgerAccount
  | SavingsGoal
  | TransactionCategory
  | InvestmentAccount
  | InvestmentInstrument
  | InvestmentActivity
  | InvestmentCashFlow
  | InvestmentPlan
  | TaxReliefCategoryDefinition
  | DeletedTransactionsSnapshot
  | BulkTransactionMutationResult
  | CategoryCleanupApplyResult
  | PayEarlyResult
  | RecurringSettlementResult
  | LedgerAccountReconcileResult
  | import('../types').LoanRepaymentActionResult
  | { id: string }
  | { item: WishlistItem; transaction: Transaction; id?: undefined }
  | void

export function getOptimisticTransactionPostedAt(createdAt: number): string {
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
  /** The cutover could not safely infer a live account placement for this operation. */
  needsAccountReview?: boolean
  needsAccountReviewBuckets?: string[]
}
