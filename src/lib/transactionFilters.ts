// Shared transaction filter predicate. LedgerView carried two near-identical
// copies of this matching logic (one for the current-cycle list, one for the
// all-cycles pending list). Search, category, date, amount, recurring and
// transaction-type matching live here so the rules exist in exactly one place.

import type { Transaction } from '../types'
import { isReportTransfer, isReportableInflow, isReportableOutflow } from './transactionReportSemantics'

/** The ledger "bucket" pseudo-categories, distinct from user sub-categories. */
export const LEDGER_BUCKETS = ['Essentials', 'Growth', 'Stability', 'Rewards', 'Income'] as const

/** How a transaction relationship should affect the Ledger list. */
export type TransactionLinkFilter = 'all' | 'exclude' | 'only'
export type TransactionSearchMode = 'contains' | 'whole-word'

type TxTypeFilter = '' | 'inflow' | 'outflow' | 'transfer' | null | undefined

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
}

/**
 * Partition a flat list of selected filter chips into ledger buckets vs.
 * user sub-categories. Duplicated inline throughout LedgerView.
 */
export function splitFilterSelections(filters: string[]): { buckets: string[]; categories: string[] } {
  const bucketSet = LEDGER_BUCKETS as readonly string[]
  return {
    buckets: filters.filter(f => bucketSet.includes(f)),
    categories: filters.filter(f => !bucketSet.includes(f)),
  }
}

/** Whether a transaction is income (plain Income bucket or an IncomeSplit). */
export function isIncomeLedgerCategory(ledgerCategory: string | null | undefined): boolean {
  return ledgerCategory === 'Income' || (ledgerCategory || '').startsWith('IncomeSplit:')
}

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
  if (t.ledgerCategory === 'Discarded') return false

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
  } = criteria

  if (startDate && t.date < startDate) return false
  if (endDate && t.date > endDate) return false

  const absoluteAmount = Math.abs(t.amount)
  if (minAmount !== undefined && absoluteAmount < minAmount) return false
  if (maxAmount !== undefined && absoluteAmount > maxAmount) return false

  if (!matchesLinkFilter(Boolean(t.recurringPaymentId), recurringFilter ?? 'all')) return false
  if (!matchesLinkFilter(t.wishlistItemId != null, wishlistFilter ?? 'all')) return false

  const normalizedSearch = search?.trim().toLowerCase()
  if (normalizedSearch) {
    const q = normalizedSearch
    const fields = [t.description, t.ledgerCategory, t.category]
    const matchesSearch = fields.some(field => matchesTransactionText(field || '', q, searchMode))
    if (!matchesSearch) return false
  }

  if (buckets && buckets.length > 0) {
    const matchesBucket = buckets.some(bucket => {
      if (bucket === 'Income') return isIncomeLedgerCategory(t.ledgerCategory)
      return t.ledgerCategory === bucket || (t.ledgerCategory || '').includes(bucket)
    })
    if (!matchesBucket) return false
  }

  if (categories && categories.length > 0) {
    const matchesSubcat = categories.some(subcat => t.category === subcat)
    if (!matchesSubcat) return false
  }

  if (txType) {
    if (txType === 'inflow' && !isReportableInflow(t)) return false
    if (txType === 'outflow' && !isReportableOutflow(t)) return false
    if (txType === 'transfer' && !isReportTransfer(t)) return false
  }

  return true
}

/** A word character for boundary purposes: letters and digits, matching the server's rule. */
const WORD_CHARACTER = /[\p{L}\p{N}]/u

/** The code point ending at `index`, so a surrogate pair is not read as a lone half. */
function codePointBefore(value: string, index: number): string {
  if (index <= 0) return ''
  return [...value.slice(Math.max(0, index - 2), index)].at(-1) ?? ''
}

function codePointAt(value: string, index: number): string {
  if (index >= value.length) return ''
  return [...value.slice(index, index + 2)][0] ?? ''
}

/**
 * Whole-word matching is a scan rather than a regex: a lookbehind assertion is not available on
 * every browser this PWA is installed on (an unsupported engine throws while compiling it, not
 * while matching), and the regex was being rebuilt for every field of every row.
 */
export function matchesTransactionText(value: string, search: string, mode: TransactionSearchMode): boolean {
  const haystack = value.toLocaleLowerCase()
  const needle = search.toLocaleLowerCase()
  if (!needle) return true
  if (mode === 'contains') return haystack.includes(needle)

  for (let index = haystack.indexOf(needle); index !== -1; index = haystack.indexOf(needle, index + 1)) {
    const before = codePointBefore(haystack, index)
    const after = codePointAt(haystack, index + needle.length)
    if (!WORD_CHARACTER.test(before) && !WORD_CHARACTER.test(after)) return true
  }
  return false
}
