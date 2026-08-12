// How much of one transaction lands in one ledger bucket.
//
// Mirror of `CategoryAttributionService.GetCategoryAmount` on the backend, which is the single
// rule that produces every bucket balance the app shows. A transaction's own `amount` is not its
// effect on a bucket: a salary reaches Stability as a percentage written into its `IncomeSplit:`
// spec, and a `Transfer:A->B` is negative to A and positive to B while its amount is one positive
// number. Anything that sums raw amounts to answer "how did this bucket move" gets a different —
// and usually much smaller — answer than the balance beside it.
//
// `Category` is deliberately never read, exactly as on the server. A downward `Adjustment` counts
// as a withdrawal because of the shape of its ledger category, not its label.

import type { Transaction } from '../types'

/** Order of the four percentages in an `IncomeSplit:` spec. */
const SPLIT_BUCKETS = ['Essentials', 'Growth', 'Stability', 'Rewards'] as const

type AttributableTransaction = Pick<Transaction, 'amount'> & { ledgerCategory?: string | null }

export function bucketAmount(transaction: AttributableTransaction, bucket: string): number {
  const ledgerCategory = transaction.ledgerCategory ?? ''
  const target = bucket.toLowerCase()

  // AccountMove is an in-bucket movement. Its two account legs are handled by
  // accountAttribution; it must never change a bucket total.
  if (ledgerCategory.toLowerCase() === 'accountmove') return 0

  if (ledgerCategory.toLowerCase() === target) return transaction.amount

  if (ledgerCategory.toLowerCase().startsWith('incomesplit:')) {
    const parts = ledgerCategory.slice('IncomeSplit:'.length).split(',')
    if (parts.length !== 4) return 0
    const index = SPLIT_BUCKETS.findIndex(name => name.toLowerCase() === target)
    if (index < 0) return 0
    const percent = Number(parts[index])
    return Number.isFinite(percent) ? transaction.amount * (percent / 100) : 0
  }

  if (ledgerCategory.toLowerCase().startsWith('transfer:')) {
    const [source, destination] = ledgerCategory.slice('Transfer:'.length).split('->')
    if (destination === undefined) return 0
    if (source.trim().toLowerCase() === target) return -Math.abs(transaction.amount)
    if (destination.trim().toLowerCase() === target) return Math.abs(transaction.amount)
  }

  return 0
}

/**
 * Net movement into a bucket across a list, rounded to cents so a repeating split percentage
 * cannot surface as a trailing fraction.
 */
export function netBucketAmount(transactions: AttributableTransaction[], bucket: string): number {
  const total = transactions.reduce((sum, transaction) => sum + bucketAmount(transaction, bucket), 0)
  return Math.round(total * 100) / 100
}
