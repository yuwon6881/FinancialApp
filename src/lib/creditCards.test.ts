import { describe, expect, it } from 'vitest'
import type { LedgerAccount, TransactionCategory } from '../types'
import {
  cardAvailableCredit,
  cardOwed,
  cardPaymentSources,
  defaultRebateCategory,
  isKindAllowedInBucket,
  planCardSettlement,
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

  // Stability carries reload obligations and Growth carries contributions; a payment out of either
  // needs the full ledger form, so the card sheet offers only the spending buckets.
  it("offers open cash accounts from the spending buckets, the card's own bucket first", () => {
    const visa = account({ id: 'visa', kind: 'CreditCard', remaining: -300 })
    const accounts = [
      visa,
      account({ id: 'rewards', bucket: 'Rewards', remaining: 9000 }),
      account({ id: 'cash', kind: 'Cash', remaining: 40 }),
      account({ id: 'bank', remaining: 900 }),
      account({ id: 'closed', remaining: 5000, isArchived: true }),
      account({ id: 'reserve', bucket: 'Stability', remaining: 7000 }),
      account({ id: 'growth', bucket: 'Growth', remaining: 7000 }),
      account({ id: 'other-card', kind: 'CreditCard', remaining: 0 }),
    ]

    expect(cardPaymentSources(visa, accounts).map(source => source.id)).toEqual(['bank', 'cash', 'rewards'])
  })

  it('prefers a cashback-style inflow category for a rebate, then Other', () => {
    const category = (name: string, type?: TransactionCategory['type'], extra: Partial<TransactionCategory> = {}): TransactionCategory =>
      ({ id: name, name, type, ...extra })

    expect(defaultRebateCategory([category('Food'), category('Other'), category('Card cashback', 'inflow')])).toBe('Card cashback')
    expect(defaultRebateCategory([category('Rebates', 'outflow'), category('Other')])).toBe('Other')
    expect(defaultRebateCategory([category('Refund', 'both', { isPendingDelete: true }), category('Salary', 'inflow')])).toBe('')
    expect(defaultRebateCategory([category('Transfer'), category('Food', 'outflow')])).toBe('')
  })
})

describe('planCardSettlement', () => {
  const visa = account({ id: 'visa', name: 'Visa', kind: 'CreditCard', remaining: -280 })
  const bank = account({ id: 'bank', name: 'Main bank', remaining: 2000 })
  const rewardsBank = account({ id: 'rewards-bank', name: 'Fun money', bucket: 'Rewards', remaining: 500 })
  const base = {
    card: visa,
    source: bank,
    amountPaid: 280,
    remainder: null,
    rebateCategory: 'Cashback',
    date: '2026-10-08',
  }

  it('pays the full amount owed as an in-bucket move that is not spending', () => {
    expect(planCardSettlement(base)).toEqual({
      ok: true,
      rebate: 0,
      stillOwed: 0,
      transactions: [{
        date: '2026-10-08',
        description: 'Pay Visa',
        category: 'Transfer',
        ledgerCategory: 'AccountMove',
        amount: 280,
        accountId: 'bank',
        counterAccountId: 'visa',
      }],
    })
  })

  it('clears the card when the bank took the rest off as a rebate', () => {
    const plan = planCardSettlement({ ...base, amountPaid: 250, remainder: 'rebate' })

    expect(plan).toMatchObject({ ok: true, rebate: 30, stillOwed: 0 })
    expect(plan.ok && plan.transactions).toEqual([
      expect.objectContaining({ ledgerCategory: 'AccountMove', amount: 250 }),
      {
        date: '2026-10-08',
        description: 'Rebate on Visa',
        category: 'Cashback',
        ledgerCategory: 'Essentials',
        amount: 30,
        accountId: 'visa',
      },
    ])
  })

  it('leaves the rest owed on a partial payment and records no rebate', () => {
    const plan = planCardSettlement({ ...base, amountPaid: 100, remainder: 'owed' })

    expect(plan).toMatchObject({ ok: true, rebate: 0, stillOwed: 180 })
    expect(plan.ok && plan.transactions).toHaveLength(1)
  })

  it('pays from the other spending bucket as a cross-bucket transfer into the card', () => {
    const plan = planCardSettlement({ ...base, source: rewardsBank, amountPaid: 200, remainder: 'owed' })

    expect(plan.ok && plan.transactions[0]).toMatchObject({
      ledgerCategory: 'Transfer:Rewards->Essentials',
      category: 'Transfer',
      amount: 200,
      accountId: 'rewards-bank',
      counterAccountId: 'visa',
    })
  })

  it('asks what happened to the rest instead of guessing', () => {
    expect(planCardSettlement({ ...base, amountPaid: 250 })).toMatchObject({ ok: false, field: 'remainder' })
  })

  it('refuses an amount above what is owed, above what the account holds, or not above zero', () => {
    expect(planCardSettlement({ ...base, amountPaid: 280.01 })).toMatchObject({ ok: false, field: 'amount' })
    expect(planCardSettlement({ ...base, amountPaid: 0, remainder: 'rebate' })).toMatchObject({ ok: false, field: 'amount' })
    expect(planCardSettlement({ ...base, amountPaid: Number.NaN })).toMatchObject({ ok: false, field: 'amount' })
    expect(planCardSettlement({ ...base, source: { ...rewardsBank, remaining: 200 }, amountPaid: 280 }))
      .toMatchObject({ ok: false, field: 'amount' })
  })

  it('needs a source account, a category for a rebate, and a card that owes something', () => {
    expect(planCardSettlement({ ...base, source: undefined })).toMatchObject({ ok: false, field: 'source' })
    expect(planCardSettlement({ ...base, amountPaid: 250, remainder: 'rebate', rebateCategory: '' }))
      .toMatchObject({ ok: false, field: 'category' })
    expect(planCardSettlement({ ...base, card: { ...visa, remaining: 10 } })).toMatchObject({ ok: false, field: 'amount' })
  })
})
