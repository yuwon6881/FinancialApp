export interface LedgerTotalTransaction {
  id: string
  amount: number
  category?: string | null
  ledgerCategory?: string | null
}

export function isTransferTransaction(transaction: LedgerTotalTransaction): boolean {
  return (transaction.ledgerCategory ?? '').toLowerCase().startsWith('transfer:') ||
    (transaction.category ?? '').toLowerCase() === 'transfer'
}

export function calculateLedgerTotals(transactions: LedgerTotalTransaction[]) {
  return transactions.reduce(
    (totals, transaction) => {
      if (isTransferTransaction(transaction)) return totals

      const isIncomeRecord = transaction.ledgerCategory === 'Income' ||
        (transaction.ledgerCategory ?? '').startsWith('IncomeSplit:')
      const isSplitSub = transaction.id.includes('-split-')
      if (isIncomeRecord || isSplitSub) totals.inflow += transaction.amount
      else if (transaction.amount < 0) totals.outflow += Math.abs(transaction.amount)
      else totals.inflow += transaction.amount
      return totals
    },
    { inflow: 0, outflow: 0 },
  )
}
