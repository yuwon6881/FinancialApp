import type { Transaction } from '../types'

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

  const pendingDiff = Number(Boolean(b.isPendingSync)) - Number(Boolean(a.isPendingSync))
  if (pendingDiff !== 0) return pendingDiff

  return String(b.id).localeCompare(String(a.id))
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
