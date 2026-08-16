// Mirrors Services/Accounts/LedgerAccountAttribution.cs. Account balances are a partition of
// bucket balances, so the bucket leg is resolved first and only then placed into one account.

import type { LedgerAccount, Transaction } from '../types'
import { bucketAmount } from './bucketAttribution'
import { roundMoney } from './money'

export function accountAmount(
  transaction: Pick<Transaction, 'amount' | 'ledgerCategory' | 'accountId' | 'counterAccountId'>,
  account: Pick<LedgerAccount, 'id' | 'bucket'>,
  accountsById: ReadonlyMap<string, Pick<LedgerAccount, 'id' | 'bucket'>>,
): number {
  if (transaction.ledgerCategory.toLowerCase() === 'accountmove') {
    const source = transaction.accountId === account.id ? -Math.abs(transaction.amount) : 0
    const destination = transaction.counterAccountId === account.id ? Math.abs(transaction.amount) : 0
    return source + destination
  }

  const leg = bucketAmount(transaction, account.bucket)
  if (leg === 0) return 0
  const explicit = [transaction.accountId, transaction.counterAccountId]
    .map(id => id ? accountsById.get(id) : undefined)
    .find(candidate => candidate?.bucket.toLowerCase() === account.bucket.toLowerCase())
  return explicit?.id === account.id ? leg : 0
}

export function getAccountBalances(
  transactions: ReadonlyArray<Pick<Transaction, 'amount' | 'ledgerCategory' | 'accountId' | 'counterAccountId'>>,
  accounts: ReadonlyArray<LedgerAccount>,
): Map<string, number> {
  const accountsById = new Map(accounts.map(account => [account.id, account]))
  return new Map(accounts.map(account => [
    account.id,
    roundMoney(transactions.reduce(
      (total, transaction) => total + accountAmount(transaction, account, accountsById),
      0,
    ) * 100) / 100,
  ]))
}
