import type { Transaction } from '../types'
import { getTransactionCyclePlacement } from './transactionCyclePlacement'

interface OpenLedgerTransactionOptions {
  transactionId: string
  transactionDate?: string
  transactions: readonly Transaction[]
  cycleDay: number
  fetchTransactionById: (id: string) => Promise<Transaction>
  navigate: (options: {
    highlightedTxId: string
    targetMonth: string
    targetYear: number
    range: 'monthly'
    showAllCycles: false
  }) => void
}

/**
 * Opens an exact transaction in its financial cycle. Current optimistic rows win so a queued
 * purchase remains usable offline; historical records are resolved authoritatively by id.
 */
export async function openLedgerTransaction(options: OpenLedgerTransactionOptions): Promise<boolean> {
  try {
    const cached = options.transactions.find(transaction =>
      String(transaction.id) === String(options.transactionId))
    const transaction = cached ?? await options.fetchTransactionById(options.transactionId)
    const date = transaction.date || options.transactionDate
    const placement = date
      ? getTransactionCyclePlacement(date.slice(0, 10), options.cycleDay)
      : null
    if (!placement) return false

    options.navigate({
      highlightedTxId: transaction.id,
      targetMonth: placement.month,
      targetYear: placement.year,
      range: 'monthly',
      showAllCycles: false,
    })
    return true
  } catch {
    return false
  }
}
