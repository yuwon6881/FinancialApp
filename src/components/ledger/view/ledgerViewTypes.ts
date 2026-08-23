import type { LedgerAccount, Transaction } from '../../../types'
import type { PagedTransactionResult } from '../../../lib/api'
import { LEDGER_BUCKETS as LEDGER_BUCKET_VALUES, type TransactionLinkFilter } from '../../../lib/transactionFilters'
import type { TransactionSort } from '../../../lib/transactionOrdering'
import type { LedgerRouteRange } from '../../../lib/appLocation'
import type { SensitivePreferenceStatus } from '../../../app/useAppPreferences'

export type LedgerTxType = 'inflow' | 'outflow' | 'transfer' | null

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
  incomingDate?: string | null | undefined
  incomingStartDate?: string | null | undefined
  incomingEndDate?: string | null | undefined
  incomingMinAmount?: string | null | undefined
  incomingMaxAmount?: string | null | undefined
  incomingRecurringFilter?: TransactionLinkFilter | undefined
  incomingWishlistFilter?: TransactionLinkFilter | undefined
  incomingTxType?: LedgerTxType | undefined
  highlightedTxId?: string | null | undefined
  isSwitchingCycle?: boolean
  onClearIncomingFilters?: () => void
  onClearHighlightedTx?: () => void
  showAllCycles: boolean
  cyclesRange?: 'monthly' | '3month' | '6month' | 'yearly'
  onRouteStateChange?: (state: {
    filters: string[]
    search: string
    startDate: string
    endDate: string
    minAmount: string
    maxAmount: string
    recurringFilter: TransactionLinkFilter
    wishlistFilter: TransactionLinkFilter
    txType: LedgerTxType
    showAllCycles: boolean
    range: LedgerRouteRange
  }) => void
  onFetchPagedTransactions?: (params: any) => Promise<PagedTransactionResult>
  onExportTransactions?: (params: any) => Promise<{ blob: Blob; filename: string }>
  onShowAlert?: (message: string, title?: string) => void
  activeSyncId?: string | null
  activeSyncIds?: ReadonlyArray<string>
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
