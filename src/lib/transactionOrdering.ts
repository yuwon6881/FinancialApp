import type { Transaction } from '../types'

export type TransactionSort = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'

function transactionDay(transaction: Transaction): number {
  const calendarDate = Date.parse(`${transaction.date}T00:00:00.000Z`)
  return Number.isFinite(calendarDate) ? calendarDate : 0
}

function transactionTime(transaction: Transaction): number {
  const postedAt = transaction.postedAt ? Date.parse(transaction.postedAt) : NaN
  if (Number.isFinite(postedAt)) return postedAt
  return transactionDay(transaction)
}

/** Newest calendar date first, then newest creation timestamp within that date. */
export function compareTransactionsNewestFirst(a: Transaction, b: Transaction): number {
  const dayDiff = transactionDay(b) - transactionDay(a)
  if (dayDiff !== 0) return dayDiff

  const timeDiff = transactionTime(b) - transactionTime(a)
  if (timeDiff !== 0) return timeDiff

  // Sync state must never affect position. Existing rows temporarily become
  // pending during edits/deletes (including cascades from wishlist/recurring
  // deletes), and legacy same-day rows may not have postedAt to distinguish
  // them. Sorting pending rows first made those rows jump to the top while the
  // request was in flight. New optimistic adds already receive a postedAt.
  return String(b.id).localeCompare(String(a.id))
}

export function compareTransactions(a: Transaction, b: Transaction, sort: TransactionSort): number {
  if (sort === 'amount-desc' || sort === 'amount-asc') {
    const amountDiff = Math.abs(a.amount) - Math.abs(b.amount)
    if (amountDiff !== 0) return sort === 'amount-asc' ? amountDiff : -amountDiff
    return compareTransactionsNewestFirst(a, b)
  }

  const newestFirst = compareTransactionsNewestFirst(a, b)
  return sort === 'date-asc' ? -newestFirst : newestFirst
}

/**
 * Merge server rows with optimistic rows without pinning the optimistic group above newer data.
 * Optimistic rows win duplicate ids because they carry the latest local sync state.
 */
export function mergeTransactionsNewestFirst(
  serverTransactions: Transaction[],
  optimisticTransactions: Transaction[],
): Transaction[] {
  const byId = new Map(serverTransactions.map(transaction => [String(transaction.id), transaction]))
  for (const transaction of optimisticTransactions) {
    byId.set(String(transaction.id), transaction)
  }
  return [...byId.values()].sort(compareTransactionsNewestFirst)
}

export function mergeTransactions(
  serverTransactions: Transaction[],
  optimisticTransactions: Transaction[],
  sort: TransactionSort,
): Transaction[] {
  const byId = new Map(serverTransactions.map(transaction => [String(transaction.id), transaction]))
  for (const transaction of optimisticTransactions) {
    byId.set(String(transaction.id), transaction)
  }
  return [...byId.values()].sort((a, b) => compareTransactions(a, b, sort))
}
