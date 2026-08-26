// Shared transaction filter predicate. LedgerView carried two near-identical
// copies of this matching logic (one for the current-cycle list, one for the
// all-cycles pending list). Search, category, date, amount, recurring, stability
// reload and transaction-type matching live here so the rules exist in exactly one place.

import type { Transaction, StabilityReloadFilter } from '../types'
import { isReportTransfer, isReportableInflow, isReportableOutflow } from './transactionReportSemantics'
import {
  isIncomeLedgerCategory,
  isStabilityReloadDrawdown,
  normalizeReloadIntent,
} from './stabilityRecoveryReplay'

/** The ledger "bucket" pseudo-categories, distinct from user sub-categories. */
export const LEDGER_BUCKETS = ['Essentials', 'Growth', 'Stability', 'Rewards', 'Income'] as const

/** How a transaction relationship should affect the Ledger list. */
export type TransactionLinkFilter = 'all' | 'exclude' | 'only'
export type TransactionSearchMode = 'contains' | 'exact'

export type TransactionTypeFilterOption = 'inflow' | 'outflow' | 'transfer'
export type TxTypeFilter = string | string[] | null | undefined
export type { StabilityReloadFilter }

export function parseTxTypes(value: TxTypeFilter): TransactionTypeFilterOption[] {
  if (!value) return []
  const items = Array.isArray(value) ? value : value.split(',')
  const valid = items
    .map(s => s.trim().toLowerCase())
    .filter((s): s is TransactionTypeFilterOption => s === 'inflow' || s === 'outflow' || s === 'transfer')
  const unique = Array.from(new Set(valid))
  return unique.length === 3 ? [] : unique
}

export interface TransactionFilterCriteria {
  /** Free-text search; empty/undefined matches everything. */
  search?: string
  searchMode?: TransactionSearchMode
  /** Selected ledger buckets; empty matches everything. */
  buckets?: string[]
  /** Selected sub-categories; empty matches everything. */
  categories?: string[]
  /** Transaction-type filter; empty/undefined matches everything. */
  txType?: TxTypeFilter
  /** Inclusive transaction date bounds in yyyy-MM-dd format. */
  startDate?: string
  endDate?: string
  /** Inclusive absolute amount bounds, so they work with either inflows or outflows. */
  minAmount?: number
  maxAmount?: number
  /** Whether recurring-linked transactions are included, excluded, or shown alone. */
  recurringFilter?: TransactionLinkFilter
  /** Whether wishlist-linked transactions are included, excluded, or shown alone. */
  wishlistFilter?: TransactionLinkFilter
  /** Optional intent/status filter for Stability drawdown rows. */
  reloadFilter?: StabilityReloadFilter
  /** Stable ledger account IDs. Either side of a transfer/account move may match. */
  accountIds?: string[]
}

/**
 * Partition a flat list of selected filter chips into ledger buckets vs.
 * user sub-categories. Duplicated inline throughout LedgerView.
 */
export function splitFilterSelections(filters: string[]): { buckets: string[]; categories: string[] } {
  const buckets: string[] = []
  const categories: string[] = []
  for (const filter of filters) {
    const canonical = canonicalBucket(filter)
    if (canonical) buckets.push(canonical)
    else categories.push(filter)
  }
  return { buckets, categories }
}

/**
 * The canonically-cased bucket a filter chip names, or null when it names a sub-category.
 *
 * Matching is case-insensitive but the canonical spelling is what comes back, so the wire
 * parameter, the chip label and the predicate all agree. A case-sensitive match silently demoted
 * a deep-linked `?filters=stability` to a sub-category that matches nothing, while the summary
 * chip still claimed a Stability filter was active.
 */
export function canonicalBucket(filter: string): string | null {
  const normalized = filter.trim().toLowerCase()
  return (LEDGER_BUCKETS as readonly string[])
    .find(bucket => bucket.toLowerCase() === normalized) ?? null
}

/** Whether a transaction is income (plain Income bucket or an IncomeSplit). */
export { isIncomeLedgerCategory }

function matchesLinkFilter(hasLink: boolean, filter: TransactionLinkFilter): boolean {
  if (filter === 'only') return hasLink
  if (filter === 'exclude') return !hasLink
  return true
}

/**
 * Core transaction matcher shared by LedgerView's list memos. Excludes
 * Discarded rows, then applies all active ledger filters.
 */
export function matchesTransactionFilters(t: Transaction, criteria: TransactionFilterCriteria): boolean {
  // Case-insensitive, matching the server's reader-side exclusion and every writer-side check.
  if ((t.ledgerCategory || '').toLowerCase() === 'discarded') return false

  const {
    search, searchMode = 'contains',
    buckets,
    categories,
    txType,
    startDate,
    endDate,
    minAmount,
    maxAmount,
    recurringFilter,
    wishlistFilter,
    reloadFilter,
    accountIds,
  } = criteria

  if (accountIds && accountIds.length > 0
    && !accountIds.includes(String(t.accountId ?? ''))
    && !accountIds.includes(String(t.counterAccountId ?? ''))) return false

  if (startDate && t.date < startDate) return false
  if (endDate && t.date > endDate) return false

  const absoluteAmount = Math.abs(t.amount)
  if (minAmount !== undefined && absoluteAmount < minAmount) return false
  if (maxAmount !== undefined && absoluteAmount > maxAmount) return false

  if (!matchesLinkFilter(Boolean(t.recurringPaymentId), recurringFilter ?? 'all')) return false
  if (!matchesLinkFilter(t.wishlistItemId != null, wishlistFilter ?? 'all')) return false

  if (reloadFilter && reloadFilter !== 'all') {
    if (t.isAccountBalanceAdjustment) return false
    if (!isStabilityReloadDrawdown(t)) return false

    const intent = normalizeReloadIntent(t.stabilityReloadIntent)
    if (reloadFilter === 'not-required') return intent === 'NotRequired'
    // Legacy and offline-authored rows may still carry Unanswered. The authoritative FIFO replay
    // deliberately treats every value except NotRequired as a promise to put the money back, so
    // Ledger filtering must not hide those obligations.
    if (intent === 'NotRequired') return false
    if (reloadFilter === 'put-back') return true

    const status = t.stabilityReloadStatus ?? 'Outstanding'
    if (reloadFilter === 'needs-put-back') return status === 'Outstanding' || status === 'PartlyRepaid'
    if (reloadFilter === 'outstanding') return status === 'Outstanding'
    if (reloadFilter === 'partly-repaid') return status === 'PartlyRepaid'
    if (reloadFilter === 'complete') return status === 'Complete'
  }

  const normalizedSearch = search?.trim().toLowerCase()
  if (normalizedSearch) {
    const q = normalizedSearch
    const fields = [t.description, t.ledgerCategory, t.category]
    const matchesSearch = fields.some(field => matchesTransactionText(field || '', q, searchMode))
    if (!matchesSearch) return false
  }

  // Bucket and sub-category matching is case-insensitive on both sides, matching the server's
  // lower()-on-both-sides SQL. A case-only difference used to return different rows in
  // current-cycle mode than in all-cycles mode for the same filter.
  if (buckets && buckets.length > 0) {
    const ledger = (t.ledgerCategory || '').toLowerCase()
    const matchesBucket = buckets.some(bucket => {
      if (bucket.toLowerCase() === 'income') return isIncomeLedgerCategory(t.ledgerCategory)
      return ledger.includes(bucket.toLowerCase())
    })
    if (!matchesBucket) return false
  }

  if (categories && categories.length > 0) {
    const subcategory = (t.category || '').toLowerCase()
    const matchesSubcat = categories.some(subcat => subcategory === subcat.trim().toLowerCase())
    if (!matchesSubcat) return false
  }

  const activeTxTypes = parseTxTypes(txType)
  if (activeTxTypes.length > 0) {
    const matchesType = activeTxTypes.some(type => {
      if (type === 'inflow') return isReportableInflow(t)
      if (type === 'outflow') return isReportableOutflow(t)
      if (type === 'transfer') return isReportTransfer(t)
      return false
    })
    if (!matchesType) return false
  }

  return true
}

/** Match anywhere by default, or require equality with one complete searchable field. */
export function matchesTransactionText(value: string, search: string, mode: TransactionSearchMode): boolean {
  // Locale-invariant on both sides. toLocaleLowerCase folds differently per locale — in tr-TR an
  // uppercase I becomes a dotless ı — so a needle and a haystack folded under different rules
  // could fail to match text the server's ILIKE happily finds.
  const haystack = value.toLowerCase()
  const needle = search.toLowerCase()
  if (!needle) return true
  if (mode === 'contains') return haystack.includes(needle)
  return haystack === needle
}
