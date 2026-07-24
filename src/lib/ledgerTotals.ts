export interface LedgerTotalTransaction {
  id: string
  amount: number
  category?: string | null
  ledgerCategory?: string | null
}

function isTransferTransaction(transaction: LedgerTotalTransaction): boolean {
  return (transaction.ledgerCategory ?? '').toLowerCase().startsWith('transfer:') ||
    (transaction.category ?? '').toLowerCase() === 'transfer'
}

export function calculateLedgerTotals(transactions: LedgerTotalTransaction[]) {
  return transactions.reduce(
    (totals, transaction) => {
      // Transfers are internal movement between buckets: they are deliberately
      // kept out of debit/credit, but we still surface their volume so the user
      // can see this money was moved/allocated rather than silently dropped.
      if (isTransferTransaction(transaction)) {
        totals.transfer += Math.abs(transaction.amount)
        return totals
      }

      const isIncomeRecord = transaction.ledgerCategory === 'Income' ||
        (transaction.ledgerCategory ?? '').startsWith('IncomeSplit:')
      const isSplitSub = transaction.id.includes('-split-')
      if (isIncomeRecord || isSplitSub) totals.inflow += transaction.amount
      else if (transaction.amount < 0) totals.outflow += Math.abs(transaction.amount)
      else totals.inflow += transaction.amount
      return totals
    },
    { inflow: 0, outflow: 0, transfer: 0 },
  )
}
