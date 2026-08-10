import type { Transaction } from '../types'

const normalized = (value: string | null | undefined) => value?.toLowerCase()

export function isReportTransfer(transaction: Pick<Transaction, 'category' | 'ledgerCategory'>): boolean {
  return normalized(transaction.category) === 'transfer' ||
    normalized(transaction.ledgerCategory)?.startsWith('transfer:') === true
}

export function isBalanceAdjustment(transaction: Pick<Transaction, 'category'>): boolean {
  return normalized(transaction.category) === 'adjustment'
}

export function isReportableCashMovement(
  transaction: Pick<Transaction, 'amount' | 'category' | 'ledgerCategory'>,
): boolean {
  return transaction.amount !== 0 &&
    !isReportTransfer(transaction) &&
    !isBalanceAdjustment(transaction) &&
    normalized(transaction.ledgerCategory) !== 'discarded'
}

export const isReportableInflow = (
  transaction: Pick<Transaction, 'amount' | 'category' | 'ledgerCategory'>,
) => transaction.amount > 0 && isReportableCashMovement(transaction)

export const isReportableOutflow = (
  transaction: Pick<Transaction, 'amount' | 'category' | 'ledgerCategory'>,
) => transaction.amount < 0 && isReportableCashMovement(transaction)
