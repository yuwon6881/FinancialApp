import type { LedgerAccount } from '../types'

export const LEDGER_ACCOUNT_BUCKETS: ReadonlyArray<{ name: LedgerAccount['bucket']; description: string }> = [
  { name: 'Essentials', description: 'Everyday spending' },
  { name: 'Growth', description: 'Money sent to investments' },
  { name: 'Stability', description: 'Emergency cushion' },
  { name: 'Rewards', description: 'Plans and treats' },
]

function hasConfirmedLiveAccount(accounts: LedgerAccount[], bucket: LedgerAccount['bucket']): boolean {
  return accounts.some(account => account.bucket === bucket && !account.isArchived && !account.isPendingSync)
}

export function hasCompleteAccountCoverage(accounts: LedgerAccount[]): boolean {
  return LEDGER_ACCOUNT_BUCKETS.every(bucket => hasConfirmedLiveAccount(accounts, bucket.name))
}
