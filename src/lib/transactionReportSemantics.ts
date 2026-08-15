import type { Transaction } from '../types'

const normalized = (value: string | null | undefined) => value?.toLowerCase()

export function isReportTransfer(transaction: Pick<Transaction, 'category' | 'ledgerCategory'>): boolean {
  const ledgerCategory = normalized(transaction.ledgerCategory)
  return normalized(transaction.category) === 'transfer' ||
    ledgerCategory === 'accountmove' ||
    ledgerCategory?.startsWith('transfer:') === true
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

export function isReportableIncome(
  transaction: Pick<Transaction, 'amount' | 'category' | 'ledgerCategory'>,
): boolean {
  const ledgerCategory = normalized(transaction.ledgerCategory)
  const isIncomeLedgerCategory = ledgerCategory === 'income' || ledgerCategory?.startsWith('incomesplit:') === true
  return transaction.amount > 0 && isIncomeLedgerCategory && isReportableCashMovement(transaction)
}
