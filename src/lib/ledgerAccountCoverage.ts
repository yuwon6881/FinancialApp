import type { LedgerAccount } from '../types'

export const LEDGER_ACCOUNT_BUCKETS: ReadonlyArray<{ name: LedgerAccount['bucket']; description: string }> = [
  { name: 'Essentials', description: 'Everyday spending' },
  { name: 'Growth', description: 'Money sent to investments' },
  { name: 'Stability', description: 'Emergency cushion' },
  { name: 'Rewards', description: 'Plans and treats' },
]

export function hasCompleteAccountCoverage(accounts: LedgerAccount[]): boolean {
  return LEDGER_ACCOUNT_BUCKETS.every(bucket =>
    accounts.some(account => account.bucket === bucket.name && !account.isArchived)
  )
}
