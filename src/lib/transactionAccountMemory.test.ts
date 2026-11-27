import { describe, expect, it } from 'vitest'
import { rememberedAccountForDescription } from './transactionAccountMemory'
import type { AutocompleteSuggestion, LedgerAccount, Transaction } from '../types'
import parity from '../test/parity/fixtures/autocomplete-source.cases.json'

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
const suggestion: AutocompleteSuggestion = { description: 'GRAB', ledgerCategory: 'Essentials', category: 'Transport', txType: 'outflow' }

describe('rememberedAccountForDescription', () => {
  it('reads the same accounts from the API suggestions and from locally loaded history', () => {
    const { input, expected } = parity.cases[0]
    const ledgerAccounts = ['checking', 'card', 'savings'].map(id => account(id, 'Essentials'))
    for (const value of expected.suggestions as AutocompleteSuggestion[]) {
      expect(rememberedAccountForDescription([], ledgerAccounts, value)).toBe(value.source?.accountId)
      expect(rememberedAccountForDescription(input.rows, ledgerAccounts, { ...value, source: undefined })).toBe(value.source?.accountId)
    }
  })

  it('returns the account of the latest matching row in the bucket, ignoring case and spacing', () => {
    const rows = [
      tx({ id: 'a', date: '2026-10-01', accountId: 'bank' }),
      tx({ id: 'b', date: '2026-11-03', accountId: 'card', description: '  grab ' }),
      tx({ id: 'c', date: '2026-11-02', accountId: 'bank' }),
    ]
    expect(rememberedAccountForDescription(rows, accounts, suggestion)).toBe('card')
  })

  it('breaks same-day ties by posting time', () => {
    const rows = [
      tx({ id: 'a', accountId: 'card', postedAt: '2026-11-01T09:00:00Z' }),
      tx({ id: 'b', accountId: 'bank', postedAt: '2026-11-01T18:00:00Z' }),
    ]
    expect(rememberedAccountForDescription(rows, accounts, suggestion)).toBe('bank')
  })

  it('ignores other buckets, other descriptions, structural and deleting rows', () => {
    const rows = [
      tx({ id: 'a', accountId: 'fun', ledgerCategory: 'Rewards' }),
      tx({ id: 'b', accountId: 'bank', description: 'Grab Food' }),
      tx({ id: 'c', accountId: 'bank', excludeFromAutocomplete: true }),
      tx({ id: 'd', accountId: 'bank', isPendingDelete: true }),
      tx({ id: 'e', accountId: 'bank', isAccountBalanceAdjustment: true }),
      tx({ id: 'f', accountId: 'bank', amount: 10 }),
    ]
    expect(rememberedAccountForDescription(rows, accounts, suggestion)).toBeNull()
  })

  it('does not resurrect an archived, missing or moved account', () => {
    expect(rememberedAccountForDescription([tx({ accountId: 'old' })], accounts, suggestion)).toBeNull()
    expect(rememberedAccountForDescription([tx({ accountId: 'gone' })], accounts, suggestion)).toBeNull()
    expect(rememberedAccountForDescription([tx({ accountId: 'fun' })], accounts, suggestion)).toBeNull()
  })

  it('returns nothing for a blank description', () => {
    expect(rememberedAccountForDescription([tx({ accountId: 'bank', description: ' ' })], accounts, { ...suggestion, description: ' ' })).toBeNull()
  })

  it('uses the source across cycles and prefers newer matching local work', () => {
    const source = tx({ id: 'source', date: '2026-10-01', accountId: 'card' })
    const fromHistory = { ...suggestion, source }
    expect(rememberedAccountForDescription([], accounts, fromHistory)).toBe('card')
    expect(rememberedAccountForDescription([tx({ accountId: 'bank', date: '2026-09-01' })], accounts, fromHistory)).toBe('card')
    expect(rememberedAccountForDescription([tx({ accountId: 'bank' })], accounts, fromHistory)).toBe('bank')
    expect(rememberedAccountForDescription([{ ...source, accountId: 'bank' }], accounts, fromHistory)).toBe('bank')
    expect(rememberedAccountForDescription([{ ...source, isPendingDelete: true }], accounts, fromHistory)).toBeNull()
  })
})
