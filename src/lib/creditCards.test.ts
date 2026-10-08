import { describe, expect, it } from 'vitest'
import type { LedgerAccount } from '../types'
import {
  buildCardPaymentPrefill,
  cardAvailableCredit,
  cardOwed,
  defaultCardPaymentSource,
  isKindAllowedInBucket,
  splitBucketCards,
} from './creditCards'

const account = (overrides: Partial<LedgerAccount>): LedgerAccount => ({
  id: 'acct',
  name: 'Account',
  bucket: 'Essentials',
  kind: 'Bank',
  isArchived: false,
  remaining: 0,
  createdAt: '2026-08-01T00:00:00Z',
  updatedAt: '2026-08-01T00:00:00Z',
  ...overrides,
})

describe('credit cards', () => {
  it('keeps cards out of the reserve and savings buckets', () => {
    expect(isKindAllowedInBucket('CreditCard', 'Essentials')).toBe(true)
    expect(isKindAllowedInBucket('CreditCard', 'Rewards')).toBe(true)
    expect(isKindAllowedInBucket('CreditCard', 'Stability')).toBe(false)
    expect(isKindAllowedInBucket('CreditCard', 'Growth')).toBe(false)
    expect(isKindAllowedInBucket('Bank', 'Stability')).toBe(true)
  })

  it('reads a negative card balance as money owed and a card in credit as owing nothing', () => {
    expect(cardOwed(account({ kind: 'CreditCard', remaining: -300 }))).toBe(300)
    expect(cardOwed(account({ kind: 'CreditCard', remaining: 25 }))).toBe(0)
    expect(cardOwed(account({ kind: 'Bank', remaining: -300 }))).toBe(0)
  })

  it('reports available credit only when a limit is recorded', () => {
    expect(cardAvailableCredit(account({ kind: 'CreditCard', remaining: -300, creditLimit: 5000 }))).toBe(4700)
    expect(cardAvailableCredit(account({ kind: 'CreditCard', remaining: -300 }))).toBeNull()
    expect(cardAvailableCredit(account({ kind: 'CreditCard', remaining: -300, creditLimit: null }))).toBeNull()
  })

  it('splits a bucket into cash and card debt, flagging when the cash cannot cover it', () => {
    const bank = account({ id: 'bank', remaining: 200 })
    const visa = account({ id: 'visa', kind: 'CreditCard', remaining: -300 })

    expect(splitBucketCards([bank])).toBeNull()
    expect(splitBucketCards([bank, visa])).toEqual({ cash: 200, owed: 300, isShort: true })
    expect(splitBucketCards([account({ id: 'bank', remaining: 2000 }), visa]))
      .toEqual({ cash: 2000, owed: 300, isShort: false })
  })

  it('ignores a closed card when deciding whether a bucket holds debt', () => {
    expect(splitBucketCards([
      account({ id: 'bank', remaining: 50 }),
      account({ id: 'old-visa', kind: 'CreditCard', isArchived: true }),
    ])).toBeNull()
  })

  it('pays a card by default from the richest open non-card account in its bucket', () => {
    const visa = account({ id: 'visa', kind: 'CreditCard', remaining: -300 })
    const accounts = [
      visa,
      account({ id: 'cash', kind: 'Cash', remaining: 40 }),
      account({ id: 'bank', remaining: 900 }),
      account({ id: 'closed', remaining: 5000, isArchived: true }),
      account({ id: 'rewards', bucket: 'Rewards', remaining: 9000 }),
      account({ id: 'other-card', kind: 'CreditCard', remaining: 0 }),
    ]

    expect(defaultCardPaymentSource(visa, accounts)?.id).toBe('bank')
    expect(defaultCardPaymentSource(visa, [visa])).toBeNull()
  })

  it('prefills a card payment as an in-bucket move of the owed amount into the card', () => {
    const visa = account({ id: 'visa', name: 'Visa', kind: 'CreditCard', remaining: -312.5 })
    const bank = account({ id: 'bank', remaining: 900 })

    expect(buildCardPaymentPrefill(visa, [visa, bank])).toEqual({
      transactionType: 'transfer',
      transferSource: 'Essentials',
      transferTarget: 'Essentials',
      accountId: 'bank',
      counterAccountId: 'visa',
      amount: '312.50',
      description: 'Pay Visa',
    })
  })

})
