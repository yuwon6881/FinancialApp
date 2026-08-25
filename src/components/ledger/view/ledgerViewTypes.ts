import type { LedgerAccount, Transaction } from '../../../types'
import type { PagedTransactionResult } from '../../../lib/api'
import {
  LEDGER_BUCKETS as LEDGER_BUCKET_VALUES,
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

export const parseAmountFilter = (value: string): number | undefined => {
  if (!value.trim()) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}

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
