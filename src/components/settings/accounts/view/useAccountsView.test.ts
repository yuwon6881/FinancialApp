import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { LedgerAccount } from '../../../../types'
import { useAccountsView } from './useAccountsView'

const makeAccount = (partial: Partial<LedgerAccount>): LedgerAccount => ({
  id: 'acc-1',
  name: 'Checking',
  bucket: 'Essentials',
  kind: 'Bank',
  remaining: 1000,
  interestEnabled: false,
  interestRatePercent: 0,
  interestFrequency: 'Monthly',
  isArchived: false,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...partial,
})

describe('useAccountsView', () => {
  it('groups accounts into 4 bucket groups and calculates balances', () => {
    const accounts: LedgerAccount[] = [
      makeAccount({ id: 'acc-1', name: 'Maybank Checking', bucket: 'Essentials', remaining: 2000 }),
      makeAccount({ id: 'acc-2', name: 'Cash', bucket: 'Essentials', remaining: 500 }),
      makeAccount({ id: 'acc-3', name: 'StashAway', bucket: 'Growth', remaining: 5000 }),
      makeAccount({ id: 'acc-4', name: 'Emergency Fund', bucket: 'Stability', remaining: 10000 }),
      makeAccount({ id: 'acc-5', name: 'Old Vault', bucket: 'Stability', isArchived: true, remaining: 100 }),
    ]

    const { result } = renderHook(() => useAccountsView({ accounts }))

    expect(result.current.rows).toHaveLength(5)
    expect(result.current.openAccountCount).toBe(4)
    expect(result.current.archivedAccountCount).toBe(1)
    expect(result.current.bucketGroups).toHaveLength(4)

    const essentials = result.current.bucketGroups.find(g => g.bucket === 'Essentials')
    expect(essentials).toBeDefined()
    expect(essentials!.accounts).toHaveLength(2)
    expect(essentials!.balance).toBe(2500)
    expect(essentials!.openCount).toBe(2)

    const growth = result.current.bucketGroups.find(g => g.bucket === 'Growth')
    expect(growth!.balance).toBe(5000)

    const stability = result.current.bucketGroups.find(g => g.bucket === 'Stability')
    expect(stability!.balance).toBe(10100)
    expect(stability!.openCount).toBe(1)
    expect(stability!.archivedCount).toBe(1)

    const rewards = result.current.bucketGroups.find(g => g.bucket === 'Rewards')
    expect(rewards!.accounts).toHaveLength(0)
    expect(rewards!.balance).toBe(0)
  })

  it('filters account lists inside groups when searchQuery is provided without altering total balance', () => {
    const accounts: LedgerAccount[] = [
      makeAccount({ id: 'acc-1', name: 'Maybank Checking', bucket: 'Essentials', remaining: 2000 }),
      makeAccount({ id: 'acc-2', name: 'Cash Wallet', bucket: 'Essentials', remaining: 500 }),
    ]

    const { result } = renderHook(() => useAccountsView({ accounts, searchQuery: 'Maybank' }))

    const essentials = result.current.bucketGroups.find(g => g.bucket === 'Essentials')
    expect(essentials!.accounts).toHaveLength(1)
    expect(essentials!.accounts[0].name).toBe('Maybank Checking')
    expect(essentials!.allBucketAccounts).toHaveLength(2)
    expect(essentials!.balance).toBe(2500) // Total balance remains true to all accounts
  })
})
