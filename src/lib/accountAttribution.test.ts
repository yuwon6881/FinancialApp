import { describe, expect, it } from 'vitest'
import type { LedgerAccount } from '../types'
import { accountAmount, getAccountBalances } from './accountAttribution'

const account = (id: string, bucket: LedgerAccount['bucket'], overrides: Partial<LedgerAccount> = {}): LedgerAccount => ({
  id,
  name: id,
  bucket,
  kind: 'Bank',
  interestEnabled: false,
  interestRatePercent: 0,
  interestFrequency: 'Monthly',
  isDefault: false,
  isArchived: false,
  remaining: 0,
  createdAt: '2026-08-01T00:00:00Z',
  updatedAt: '2026-08-01T00:00:00Z',
  ...overrides,
})

const accounts = [
  account('essentials-default', 'Essentials', { isDefault: true }),
  account('essentials-closed', 'Essentials', { isArchived: true }),
  account('rewards-default', 'Rewards', { isDefault: true }),
]

describe('accountAttribution', () => {
  it('uses the existing bucket leg before placing a plain row in its explicit account', () => {
    const balances = getAccountBalances([
      { amount: -80, ledgerCategory: 'Essentials', accountId: 'essentials-closed' },
    ], accounts)

    expect(balances.get('essentials-closed')).toBe(-80)
    expect(balances.get('essentials-default')).toBe(0)
  })

  it('uses the bucket leg rather than the salary amount for a split', () => {
    const balances = getAccountBalances([
      { amount: 1000, ledgerCategory: 'IncomeSplit:50,25,15,10' },
    ], accounts)

    expect(balances.get('essentials-default')).toBe(500)
    expect(balances.get('rewards-default')).toBe(100)
  })

  it('binds each side of a cross-bucket transfer by account placement', () => {
    const balances = getAccountBalances([
      {
        amount: 120,
        ledgerCategory: 'Transfer:Essentials->Rewards',
        accountId: 'essentials-default',
        counterAccountId: 'rewards-default',
      },
    ], accounts)

    expect(balances.get('essentials-default')).toBe(-120)
    expect(balances.get('rewards-default')).toBe(120)
  })

  it('falls back to the live bucket default when no account is attached', () => {
    const balances = getAccountBalances([
      { amount: -25, ledgerCategory: 'Essentials' },
    ], accounts)

    expect(balances.get('essentials-default')).toBe(-25)
    expect(balances.get('essentials-closed')).toBe(0)
  })

  it('keeps an AccountMove inside the bucket while moving absolute money between accounts', () => {
    const move = {
      amount: 40,
      ledgerCategory: 'AccountMove',
      accountId: 'essentials-default',
      counterAccountId: 'essentials-closed',
    }

    expect(accountAmount(move, accounts[0], new Map(accounts.map(item => [item.id, item])), new Map())).toBe(-40)
    expect(accountAmount(move, accounts[1], new Map(accounts.map(item => [item.id, item])), new Map())).toBe(40)
    expect(getAccountBalances([move], accounts).get('rewards-default')).toBe(0)
  })
})
