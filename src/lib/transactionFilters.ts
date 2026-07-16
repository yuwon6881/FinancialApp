// Shared transaction filter predicate. LedgerView carried two near-identical
// copies of this matching logic (one for the current-cycle list, one for the
// all-cycles pending list). Search, category, date, amount, recurring and
// transaction-type matching live here so the rules exist in exactly one place.

import type { Transaction } from '../types'

/** The ledger "bucket" pseudo-categories, distinct from user sub-categories. */
export const LEDGER_BUCKETS = ['Essentials', 'Growth', 'Stability', 'Rewards', 'Income'] as const

export type TxTypeFilter = '' | 'inflow' | 'outflow' | 'transfer' | null | undefined

export interface TransactionFilterCriteria {
  /** Free-text search; empty/undefined matches everything. */
  search?: string
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
  /** Only transactions generated from a recurring payment. */
  recurringOnly?: boolean
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

function isTransferTx(t: Transaction): boolean {
  return t.category === 'Transfer' || (t.ledgerCategory || '').startsWith('Transfer:')
}

/** Whether a transaction is income (plain Income bucket or an IncomeSplit). */
export function isIncomeLedgerCategory(ledgerCategory: string | null | undefined): boolean {
  return ledgerCategory === 'Income' || (ledgerCategory || '').startsWith('IncomeSplit:')
}

/**
 * Core transaction matcher shared by LedgerView's list memos. Excludes
 * Discarded rows, then applies all active ledger filters.
 */
export function matchesTransactionFilters(t: Transaction, criteria: TransactionFilterCriteria): boolean {
  if (t.ledgerCategory === 'Discarded') return false

  const { search, buckets, categories, txType, startDate, endDate, minAmount, maxAmount, recurringOnly } = criteria

  if (startDate && t.date < startDate) return false
  if (endDate && t.date > endDate) return false

  const absoluteAmount = Math.abs(t.amount)
  if (minAmount !== undefined && absoluteAmount < minAmount) return false
  if (maxAmount !== undefined && absoluteAmount > maxAmount) return false

  if (recurringOnly && !t.recurringPaymentId) return false

  if (search) {
    const q = search.toLowerCase()
    const matchesSearch =
      (t.description || '').toLowerCase().includes(q) ||
      (t.ledgerCategory || '').toLowerCase().includes(q) ||
      (t.category || '').toLowerCase().includes(q)
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
    const isTransfer = isTransferTx(t)
    if (txType === 'inflow' && !(t.amount > 0 && !isTransfer)) return false
    if (txType === 'outflow' && !(t.amount < 0 && !isTransfer)) return false
    if (txType === 'transfer' && !isTransfer) return false
  }

  return true
}
