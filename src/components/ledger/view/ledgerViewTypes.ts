import type { LedgerAccount, Transaction } from '../../../types'
import type { PagedTransactionResult } from '../../../lib/api'
import {
  LEDGER_BUCKETS as LEDGER_BUCKET_VALUES,
  splitFilterSelections,
  canonicalBucket,
  type TransactionLinkFilter,
  type TransactionSearchMode,
  type TxTypeFilter,
  type StabilityReloadFilter,
} from '../../../lib/transactionFilters'
import type { TransactionSort } from '../../../lib/transactionOrdering'
import type { LedgerRouteRange } from '../../../lib/appLocation'
import type { SensitivePreferenceStatus } from '../../../app/useAppPreferences'
import type { QueuedOp } from '../../../lib/outboxTypes'

export type LedgerTxType = TxTypeFilter
export type LedgerReloadFilter = StabilityReloadFilter

export const LEDGER_BUCKETS: readonly string[] = LEDGER_BUCKET_VALUES

// Re-exported so every ledger caller partitions filter chips through the one canonical helper.
// Hand-rolled LEDGER_BUCKETS.includes(f) splits were case-sensitive, which silently demoted a
// lower-cased bucket in a deep link to a sub-category that matches nothing.
export { splitFilterSelections, canonicalBucket }

export const parseAmountFilter = (value: string): number | undefined => {
  if (!value.trim()) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}

/**
 * A bound the user typed that the predicate will silently ignore — negative, or not a number.
 *
 * The bounds are absolute amounts, so a negative one cannot match anything and is dropped. Callers
 * use this to say so: counting a dropped bound as an active filter made the chip, the badge and the
 * URL all claim a filter was narrowing the list while every row was still coming back.
 */
export const isUnusableAmountFilter = (value: string): boolean =>
  value.trim().length > 0 && parseAmountFilter(value) === undefined

/** Whether an amount range will actually narrow the result. */
export const hasEffectiveAmountFilter = (minAmount: string, maxAmount: string): boolean =>
  parseAmountFilter(minAmount) !== undefined || parseAmountFilter(maxAmount) !== undefined

export const laterDate = (first?: string | null, second?: string | null) => {
  if (!first) return second || undefined
  if (!second) return first
  return first > second ? first : second
}

export const earlierDate = (first?: string | null, second?: string | null) => {
  if (!first) return second || undefined
  if (!second) return first
  return first < second ? first : second
}

export interface UseLedgerViewOptions {
  transactions: Transaction[]
  accounts?: LedgerAccount[]
  categories: any[]
  selectedMonth: string
  selectedYear: number
  cycleDay: number
  isMobile: boolean
  incomingCategory?: string | null | undefined
  incomingFilters?: string[] | undefined
  incomingSearch?: string | null | undefined
  incomingSearchMode?: TransactionSearchMode
  incomingDate?: string | null | undefined
  incomingStartDate?: string | null | undefined
  incomingEndDate?: string | null | undefined
  incomingMinAmount?: string | null | undefined
  incomingMaxAmount?: string | null | undefined
  incomingRecurringFilter?: TransactionLinkFilter | undefined
  incomingWishlistFilter?: TransactionLinkFilter | undefined
  incomingReloadFilter?: LedgerReloadFilter | undefined
  incomingAccountIds?: string[] | undefined
  incomingTxType?: LedgerTxType | undefined
  highlightedTxId?: string | null | undefined
  isSwitchingCycle?: boolean
  onClearIncomingFilters?: () => void
  onClearHighlightedTx?: () => void
  showAllCycles: boolean
  cyclesRange?: 'monthly' | '3month' | '6month' | 'yearly' | 'all'
  onRouteStateChange?: (state: {
    filters: string[]
    search: string
    searchMode: TransactionSearchMode
    startDate: string
    endDate: string
    minAmount: string
    maxAmount: string
    recurringFilter: TransactionLinkFilter
    wishlistFilter: TransactionLinkFilter
    reloadFilter: LedgerReloadFilter
    accountIds: string[]
    txType: LedgerTxType
    showAllCycles: boolean
    range: LedgerRouteRange
  }) => void
  onFetchPagedTransactions?: (params: any) => Promise<PagedTransactionResult>
  onExportTransactions?: (params: any) => Promise<{ blob: Blob; filename: string }>
  onShowAlert?: (message: string, title?: string) => void
  activeSyncId?: string | null
  activeSyncIds?: ReadonlyArray<string>
  /** Queued and just-completed outbox operations, for row-level optimistic retention. */
  operations?: ReadonlyArray<QueuedOp>
  deletingTxId?: string | null
  onDeleteTransaction: (id: string, transaction?: Transaction, attachedDocumentIdsToDelete?: number[]) => Promise<void> | void
  onAiExportRequestConsumed?: () => void
  aiExportRequest?: any
  hideSensitive: boolean
  sensitivePreferenceStatus?: SensitivePreferenceStatus
  formRef: React.RefObject<any>
  preferredPageSize?: number
  preferredSortOrder?: TransactionSort
}
