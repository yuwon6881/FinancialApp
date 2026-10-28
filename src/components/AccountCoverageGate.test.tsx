import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { LedgerAccount } from '../types'
import { hasCompleteAccountCoverage } from '../lib/ledgerAccountCoverage'
import { AccountCoverageGate } from './AccountCoverageGate'

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

describe('AccountCoverageGate', () => {
  it('says how many of the four buckets are already set up', () => {
    render(
      <AccountCoverageGate
        accounts={[account('Essentials'), account('Growth'), account('Rewards', { isArchived: true })]}
        currency="MYR"
        loading={false}
        hideSensitive={false}
        formatSensitive={value => String(value)}
        onAddAccount={vi.fn()}
        onUpdateAccount={vi.fn()}
        onRetry={vi.fn()}
      />,
    )
    expect(screen.getByText('2 of 4 set up')).toBeTruthy()
  })
})
