import { describe, expect, it } from 'vitest'
import type { LedgerAccount } from '../types'
import { hasCompleteAccountCoverage } from '../lib/ledgerAccountCoverage'

function account(bucket: LedgerAccount['bucket'], overrides: Partial<LedgerAccount> = {}): LedgerAccount {
  return {
    id: bucket,
    name: bucket,
    bucket,
    kind: 'Bank',
    isArchived: false,
    remaining: 0,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('hasCompleteAccountCoverage', () => {
  it('requires one open account in every bucket', () => {
    const accounts = [
      account('Essentials'),
      account('Growth'),
      account('Stability'),
      account('Rewards'),
    ]

    expect(hasCompleteAccountCoverage(accounts)).toBe(true)
    expect(hasCompleteAccountCoverage(accounts.slice(0, 3))).toBe(false)
    expect(hasCompleteAccountCoverage(accounts.map(row => row.bucket === 'Rewards' ? { ...row, isArchived: true } : row))).toBe(false)
    expect(hasCompleteAccountCoverage(accounts.map(row => row.bucket === 'Rewards' ? { ...row, isPendingSync: true } : row))).toBe(true)
  })
})
