import { describe, expect, it } from 'vitest'
import type { LedgerAccount } from '../types'
import { LEDGER_ACCOUNT_BUCKETS, hasCompleteAccountCoverage } from './ledgerAccountCoverage'

function makeAccount(
  bucket: LedgerAccount['bucket'],
  overrides: Partial<LedgerAccount> = {},
): LedgerAccount {
  return {
    id: `acct-${bucket.toLowerCase()}`,
    name: `${bucket} Account`,
    bucket,
    kind: 'Bank',
    isArchived: false,
    remaining: 100,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('ledgerAccountCoverage', () => {
  it('defines the canonical four budget buckets', () => {
    expect(LEDGER_ACCOUNT_BUCKETS.map(b => b.name)).toEqual([
      'Essentials',
      'Growth',
      'Stability',
      'Rewards',
    ])
  })

  it('returns true only when every bucket has at least one unarchived account', () => {
    const full = [
      makeAccount('Essentials'),
      makeAccount('Growth'),
      makeAccount('Stability'),
      makeAccount('Rewards'),
    ]

    expect(hasCompleteAccountCoverage(full)).toBe(true)
  })

  it('returns false if any bucket is completely missing', () => {
    const missingRewards = [
      makeAccount('Essentials'),
      makeAccount('Growth'),
      makeAccount('Stability'),
    ]

    expect(hasCompleteAccountCoverage(missingRewards)).toBe(false)
  })

  it('returns false if a bucket only has archived accounts', () => {
    const archivedStability = [
      makeAccount('Essentials'),
      makeAccount('Growth'),
      makeAccount('Stability', { isArchived: true }),
      makeAccount('Rewards'),
    ]

    expect(hasCompleteAccountCoverage(archivedStability)).toBe(false)
  })

  it('returns true when a bucket has an optimistic pending sync unarchived account', () => {
    const pendingGrowth = [
      makeAccount('Essentials'),
      makeAccount('Growth', { isPendingSync: true }),
      makeAccount('Stability'),
      makeAccount('Rewards'),
    ]

    expect(hasCompleteAccountCoverage(pendingGrowth)).toBe(true)
  })

  it('returns true if a bucket has an archived account alongside an open account', () => {
    const multipleAccounts = [
      makeAccount('Essentials'),
      makeAccount('Growth'),
      makeAccount('Stability', { id: 'stab-1', isArchived: true }),
      makeAccount('Stability', { id: 'stab-2', isArchived: false, isPendingSync: false }),
      makeAccount('Rewards'),
    ]

    expect(hasCompleteAccountCoverage(multipleAccounts)).toBe(true)
  })
})
