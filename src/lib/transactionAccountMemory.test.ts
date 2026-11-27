import { describe, expect, it } from 'vitest'
import { rememberedAccountForDescription } from './transactionAccountMemory'
import type { LedgerAccount, Transaction } from '../types'

const account = (id: string, bucket: LedgerAccount['bucket'], isArchived = false) =>
  ({ id, name: id, bucket, kind: 'Bank', isArchived, remaining: 0, createdAt: '', updatedAt: '' }) as LedgerAccount

const tx = (overrides: Partial<Transaction>): Transaction => ({
  id: overrides.id ?? 'tx',
  date: '2026-11-01',
  description: 'Grab',
  category: 'Transport',
  ledgerCategory: 'Essentials',
  amount: -10,
  ...overrides,
})

const accounts = [account('bank', 'Essentials'), account('card', 'Essentials'), account('old', 'Essentials', true), account('fun', 'Rewards')]

describe('rememberedAccountForDescription', () => {
  it('returns the account of the latest matching row in the bucket, ignoring case and spacing', () => {
    const rows = [
      tx({ id: 'a', date: '2026-10-01', accountId: 'bank' }),
      tx({ id: 'b', date: '2026-11-03', accountId: 'card', description: '  grab ' }),
      tx({ id: 'c', date: '2026-11-02', accountId: 'bank' }),
    ]
    expect(rememberedAccountForDescription(rows, accounts, 'GRAB', 'Essentials')).toBe('card')
  })

  it('breaks same-day ties by posting time', () => {
    const rows = [
      tx({ id: 'a', accountId: 'card', postedAt: '2026-11-01T09:00:00Z' }),
      tx({ id: 'b', accountId: 'bank', postedAt: '2026-11-01T18:00:00Z' }),
    ]
    expect(rememberedAccountForDescription(rows, accounts, 'Grab', 'Essentials')).toBe('bank')
  })

  it('ignores other buckets, other descriptions, structural and deleting rows', () => {
    const rows = [
      tx({ id: 'a', accountId: 'fun', ledgerCategory: 'Rewards' }),
      tx({ id: 'b', accountId: 'bank', description: 'Grab Food' }),
      tx({ id: 'c', accountId: 'bank', excludeFromAutocomplete: true }),
      tx({ id: 'd', accountId: 'bank', isPendingDelete: true }),
      tx({ id: 'e', accountId: 'bank', isAccountBalanceAdjustment: true }),
    ]
    expect(rememberedAccountForDescription(rows, accounts, 'Grab', 'Essentials')).toBeNull()
  })

  it('does not resurrect an archived, missing or moved account', () => {
    expect(rememberedAccountForDescription([tx({ accountId: 'old' })], accounts, 'Grab', 'Essentials')).toBeNull()
    expect(rememberedAccountForDescription([tx({ accountId: 'gone' })], accounts, 'Grab', 'Essentials')).toBeNull()
    expect(rememberedAccountForDescription([tx({ accountId: 'fun' })], accounts, 'Grab', 'Essentials')).toBeNull()
  })

  it('returns nothing for a blank description', () => {
    expect(rememberedAccountForDescription([tx({ accountId: 'bank', description: ' ' })], accounts, ' ', 'Essentials')).toBeNull()
  })
})
