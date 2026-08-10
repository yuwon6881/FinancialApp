import { netBucketAmount } from './bucketAttribution'

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

/**
 * Debit/credit/transfer volume for a list of rows, plus — when exactly one ledger bucket is being
 * filtered on — that bucket's net movement.
 *
 * The two answers are deliberately different sums. Debit and credit exclude transfers, because
 * moving money between your own buckets is not spending; but *within* one bucket a transfer is the
 * whole story, so a Stability-only view nets to zero on the headline figures while the fund has
 * plainly gone down. `bucketNet` is the figure that reads negative when a bucket has been drawn
 * on, and it uses each row's share of that bucket rather than its face amount.
 */
export function calculateLedgerTotals(transactions: LedgerTotalTransaction[], bucket?: string | null) {
  const totals = transactions.reduce(
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
  return {
    ...totals,
    bucket: bucket ?? null,
    bucketNet: bucket ? netBucketAmount(transactions, bucket) : 0,
  }
}

/** Whether the bucket-specific movement rounds to a different amount than page net position. */
export function hasDistinctBucketMovement(bucketNet: number, net: number): boolean {
  return Math.round(bucketNet * 100) !== Math.round(net * 100)
}
