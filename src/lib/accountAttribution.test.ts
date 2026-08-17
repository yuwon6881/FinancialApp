import { describe, expect, it } from 'vitest'
import type { LedgerAccount } from '../types'
import { accountAmount, getAccountBalances } from './accountAttribution'

const account = (id: string, bucket: LedgerAccount['bucket'], overrides: Partial<LedgerAccount> = {}): LedgerAccount => ({
  id,
  name: id,
  bucket,
  kind: 'Bank',
  isArchived: false,
  remaining: 0,
  createdAt: '2026-08-01T00:00:00Z',
  updatedAt: '2026-08-01T00:00:00Z',
  ...overrides,
})

const accounts = [
  account('essentials-main', 'Essentials'),
  account('essentials-closed', 'Essentials', { isArchived: true }),
  account('rewards-main', 'Rewards'),
]

describe('accountAttribution', () => {
  it('uses the existing bucket leg before placing a plain row in its explicit account', () => {
    const balances = getAccountBalances([
      { amount: -80, ledgerCategory: 'Essentials', accountId: 'essentials-closed' },
    ], accounts)

    expect(balances.get('essentials-closed')).toBe(-80)
    expect(balances.get('essentials-main')).toBe(0)
  })

  it('uses the bucket leg rather than the salary amount for a split', () => {
    const balances = getAccountBalances([
      { amount: 500, ledgerCategory: 'Transfer:Income->Essentials', accountId: 'essentials-main' },
      { amount: 100, ledgerCategory: 'Transfer:Income->Rewards', accountId: 'rewards-main' },
    ], accounts)

    expect(balances.get('essentials-main')).toBe(500)
    expect(balances.get('rewards-main')).toBe(100)
  })

  it('binds each side of a cross-bucket transfer by account placement', () => {
    const balances = getAccountBalances([
      {
        amount: 120,
        ledgerCategory: 'Transfer:Essentials->Rewards',
        accountId: 'essentials-main',
        counterAccountId: 'rewards-main',
      },
    ], accounts)

    expect(balances.get('essentials-main')).toBe(-120)
    expect(balances.get('rewards-main')).toBe(120)
  })

  it('leaves an unplaced legacy row out of account balances', () => {
    const balances = getAccountBalances([
      { amount: -25, ledgerCategory: 'Essentials' },
    ], accounts)

    expect(balances.get('essentials-main')).toBe(0)
    expect(balances.get('essentials-closed')).toBe(0)
  })

  it('keeps an AccountMove inside the bucket while moving absolute money between accounts', () => {
    const move = {
      amount: 40,
      ledgerCategory: 'AccountMove',
      accountId: 'essentials-main',
      counterAccountId: 'essentials-closed',
    }

    expect(accountAmount(move, accounts[0], new Map(accounts.map(item => [item.id, item])))).toBe(-40)
    expect(accountAmount(move, accounts[1], new Map(accounts.map(item => [item.id, item])))).toBe(40)
    expect(getAccountBalances([move], accounts).get('rewards-main')).toBe(0)
  })
})
