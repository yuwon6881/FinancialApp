import { describe, expect, it } from 'vitest'
import {
  matchesTransactionFilters,
  splitFilterSelections,
  isIncomeLedgerCategory,
} from './transactionFilters'
import type { Transaction } from '../types'

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: 't1',
    description: '',
    amount: -10,
    category: 'Food',
    ledgerCategory: 'Essentials',
    date: '2026-07-01',
    ...partial,
  } as Transaction
}

describe('splitFilterSelections', () => {
  it('separates ledger buckets from sub-categories', () => {
    expect(splitFilterSelections(['Income', 'Food', 'Growth', 'Hobbies'])).toEqual({
      buckets: ['Income', 'Growth'],
      categories: ['Food', 'Hobbies'],
    })
  })
})

describe('isIncomeLedgerCategory', () => {
  it('matches plain Income and IncomeSplit', () => {
    expect(isIncomeLedgerCategory('Income')).toBe(true)
    expect(isIncomeLedgerCategory('IncomeSplit:50,20,20,10')).toBe(true)
    expect(isIncomeLedgerCategory('Essentials')).toBe(false)
    expect(isIncomeLedgerCategory(null)).toBe(false)
  })
})

describe('matchesTransactionFilters', () => {
  it('always excludes Discarded rows', () => {
    expect(matchesTransactionFilters(tx({ ledgerCategory: 'Discarded' }), {})).toBe(false)
  })

  it('matches everything when no criteria are given', () => {
    expect(matchesTransactionFilters(tx({}), {})).toBe(true)
  })

  it('searches description, ledgerCategory and category case-insensitively', () => {
    expect(matchesTransactionFilters(tx({ description: 'Groceries' }), { search: 'groc' })).toBe(true)
    expect(matchesTransactionFilters(tx({ category: 'Food' }), { search: 'foo' })).toBe(true)
    expect(matchesTransactionFilters(tx({ ledgerCategory: 'Growth' }), { search: 'grow' })).toBe(true)
    expect(matchesTransactionFilters(tx({ description: 'Rent' }), { search: 'zzz' })).toBe(false)
  })

  it('matches the Income bucket against IncomeSplit categories', () => {
    expect(
      matchesTransactionFilters(tx({ ledgerCategory: 'IncomeSplit:50,20,20,10' }), { buckets: ['Income'] })
    ).toBe(true)
    expect(matchesTransactionFilters(tx({ ledgerCategory: 'Essentials' }), { buckets: ['Income'] })).toBe(false)
  })

  it('matches a bucket via substring for split ledger categories', () => {
    expect(
      matchesTransactionFilters(tx({ ledgerCategory: 'Transfer:Essentials->Rewards' }), { buckets: ['Rewards'] })
    ).toBe(true)
  })

  it('filters by sub-category exactly', () => {
    expect(matchesTransactionFilters(tx({ category: 'Food' }), { categories: ['Food'] })).toBe(true)
    expect(matchesTransactionFilters(tx({ category: 'Food' }), { categories: ['Hobbies'] })).toBe(false)
  })

  it('applies the inflow type filter (positive, non-transfer)', () => {
    expect(matchesTransactionFilters(tx({ amount: 100, ledgerCategory: 'Income' }), { txType: 'inflow' })).toBe(true)
    expect(matchesTransactionFilters(tx({ amount: -100 }), { txType: 'inflow' })).toBe(false)
    expect(
      matchesTransactionFilters(tx({ amount: 100, category: 'Transfer', ledgerCategory: 'Transfer:A->B' }), { txType: 'inflow' })
    ).toBe(false)
  })

  it('applies the outflow type filter (negative, non-transfer)', () => {
    expect(matchesTransactionFilters(tx({ amount: -5 }), { txType: 'outflow' })).toBe(true)
    expect(matchesTransactionFilters(tx({ amount: 5 }), { txType: 'outflow' })).toBe(false)
    expect(
      matchesTransactionFilters(
        tx({ amount: -5, category: 'Transfer', ledgerCategory: 'Transfer:Rewards->Growth' }),
        { txType: 'outflow' },
      ),
    ).toBe(false)
  })

  it('applies the transfer type filter', () => {
    expect(
      matchesTransactionFilters(tx({ amount: 5, ledgerCategory: 'Transfer:A->B' }), { txType: 'transfer' })
    ).toBe(true)
    expect(matchesTransactionFilters(tx({ amount: 5, ledgerCategory: 'Income' }), { txType: 'transfer' })).toBe(false)
  })

  it('applies inclusive date ranges', () => {
    expect(matchesTransactionFilters(tx({ date: '2026-07-10' }), { startDate: '2026-07-10', endDate: '2026-07-10' })).toBe(true)
    expect(matchesTransactionFilters(tx({ date: '2026-07-09' }), { startDate: '2026-07-10' })).toBe(false)
    expect(matchesTransactionFilters(tx({ date: '2026-07-11' }), { endDate: '2026-07-10' })).toBe(false)
  })

  it('applies amount ranges to absolute values', () => {
    expect(matchesTransactionFilters(tx({ amount: -50 }), { minAmount: 50, maxAmount: 100 })).toBe(true)
    expect(matchesTransactionFilters(tx({ amount: 49.99 }), { minAmount: 50 })).toBe(false)
    expect(matchesTransactionFilters(tx({ amount: -100.01 }), { maxAmount: 100 })).toBe(false)
  })

  it('filters recurring transactions by their recurring payment link', () => {
    expect(matchesTransactionFilters(tx({ recurringPaymentId: 'rent' }), { recurringOnly: true })).toBe(true)
    expect(matchesTransactionFilters(tx({ recurringPaymentId: null }), { recurringOnly: true })).toBe(false)
  })

  it('filters wishlist purchases by their wishlist item link', () => {
    expect(matchesTransactionFilters(tx({ wishlistItemId: 7 }), { wishlistOnly: true })).toBe(true)
    expect(matchesTransactionFilters(tx({ wishlistItemId: null }), { wishlistOnly: true })).toBe(false)
  })

  it('requires all provided criteria to pass', () => {
    const t = tx({ description: 'Salary', amount: 500, category: 'Salary', ledgerCategory: 'Income' })
    expect(matchesTransactionFilters(t, { search: 'sal', buckets: ['Income'], txType: 'inflow' })).toBe(true)
    expect(matchesTransactionFilters(t, { search: 'sal', buckets: ['Growth'], txType: 'inflow' })).toBe(false)
  })
})
