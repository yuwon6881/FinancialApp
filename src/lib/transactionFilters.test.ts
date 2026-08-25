import { describe, expect, it } from 'vitest'
import {
  matchesTransactionFilters,
  splitFilterSelections,
  isIncomeLedgerCategory,
  parseTxTypes,
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

describe('parseTxTypes', () => {
  it('parses string, array, and normalizes all three to empty', () => {
    expect(parseTxTypes('inflow')).toEqual(['inflow'])
    expect(parseTxTypes(['inflow', 'outflow'])).toEqual(['inflow', 'outflow'])
    expect(parseTxTypes('inflow,outflow')).toEqual(['inflow', 'outflow'])
    expect(parseTxTypes(['inflow', 'outflow', 'transfer'])).toEqual([])
    expect(parseTxTypes('inflow,outflow,transfer')).toEqual([])
    expect(parseTxTypes(null)).toEqual([])
    expect(parseTxTypes(undefined)).toEqual([])
  })
})

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
    expect(matchesTransactionFilters(tx({ amount: 100, category: 'ADJUSTMENT' }), { txType: 'inflow' })).toBe(false)
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
    expect(matchesTransactionFilters(tx({ amount: -5, category: 'adjustment' }), { txType: 'outflow' })).toBe(false)
  })

  it('applies the transfer type filter', () => {
    expect(
      matchesTransactionFilters(tx({ amount: 5, ledgerCategory: 'Transfer:A->B' }), { txType: 'transfer' })
    ).toBe(true)
    expect(matchesTransactionFilters(tx({ amount: 5, ledgerCategory: 'Income' }), { txType: 'transfer' })).toBe(false)
  })

  it('supports multi-type filtering such as inflow + outflow or inflow + transfer', () => {
    const inflow = tx({ amount: 100, ledgerCategory: 'Income' })
    const outflow = tx({ amount: -50, ledgerCategory: 'Essentials' })
    const transfer = tx({ amount: 50, ledgerCategory: 'Transfer:Essentials->Rewards' })

    expect(matchesTransactionFilters(inflow, { txType: ['inflow', 'outflow'] })).toBe(true)
    expect(matchesTransactionFilters(outflow, { txType: ['inflow', 'outflow'] })).toBe(true)
    expect(matchesTransactionFilters(transfer, { txType: ['inflow', 'outflow'] })).toBe(false)

    expect(matchesTransactionFilters(inflow, { txType: 'inflow,outflow' })).toBe(true)
    expect(matchesTransactionFilters(transfer, { txType: 'inflow,transfer' })).toBe(true)
    expect(matchesTransactionFilters(outflow, { txType: 'inflow,transfer' })).toBe(false)

    // All three selected normalizes to matching all
    expect(matchesTransactionFilters(transfer, { txType: ['inflow', 'outflow', 'transfer'] })).toBe(true)
    expect(matchesTransactionFilters(inflow, { txType: 'inflow,outflow,transfer' })).toBe(true)
  })

  it('filters by stability reload put-back intent', () => {
    const putBackOutflow = tx({
      amount: -100,
      ledgerCategory: 'Stability',
      stabilityReloadIntent: 'Required',
      stabilityReloadStatus: 'Outstanding',
    })
    const partlyRepaid = tx({
      id: 'partly',
      amount: -80,
      ledgerCategory: 'Stability',
      stabilityReloadIntent: 'Required',
      stabilityReloadStatus: 'PartlyRepaid',
    })
    const complete = tx({
      id: 'complete',
      amount: -60,
      ledgerCategory: 'Stability',
      stabilityReloadIntent: 'Required',
      stabilityReloadStatus: 'Complete',
    })
    const spentForGoodOutflow = tx({
      amount: -100,
      ledgerCategory: 'Stability',
      stabilityReloadIntent: 'NotRequired',
    })
    const incomeSplit = tx({
      amount: 1000,
      ledgerCategory: 'IncomeSplit:50,25,15,10',
    })
    const putBackTransfer = tx({
      amount: 80,
      ledgerCategory: 'Transfer:Stability->Rewards',
      stabilityReloadIntent: 'Required',
    })
    const adjustment = tx({
      amount: -100,
      ledgerCategory: 'Stability',
      isAccountBalanceAdjustment: true,
      stabilityReloadIntent: 'Required',
    })

    expect(matchesTransactionFilters(putBackOutflow, { reloadFilter: 'put-back' })).toBe(true)
    expect(matchesTransactionFilters(putBackTransfer, { reloadFilter: 'put-back' })).toBe(true)
    expect(matchesTransactionFilters(spentForGoodOutflow, { reloadFilter: 'put-back' })).toBe(false)
    expect(matchesTransactionFilters(incomeSplit, { reloadFilter: 'put-back' })).toBe(false)
    expect(matchesTransactionFilters(adjustment, { reloadFilter: 'put-back' })).toBe(false)

    expect(matchesTransactionFilters(putBackOutflow, { reloadFilter: 'needs-put-back' })).toBe(true)
    expect(matchesTransactionFilters(partlyRepaid, { reloadFilter: 'needs-put-back' })).toBe(true)
    expect(matchesTransactionFilters(complete, { reloadFilter: 'needs-put-back' })).toBe(false)
    expect(matchesTransactionFilters(putBackOutflow, { reloadFilter: 'outstanding' })).toBe(true)
    expect(matchesTransactionFilters(partlyRepaid, { reloadFilter: 'outstanding' })).toBe(false)
    expect(matchesTransactionFilters(partlyRepaid, { reloadFilter: 'partly-repaid' })).toBe(true)
    expect(matchesTransactionFilters(complete, { reloadFilter: 'complete' })).toBe(true)
    expect(matchesTransactionFilters(spentForGoodOutflow, { reloadFilter: 'not-required' })).toBe(true)
  })

  // Parity with the server filter and with the authoritative Stability replay: only an explicit
  // NotRequired opts a drawdown out. Missing and Unanswered intents are obligations, and the
  // filter meant to list them must not be the one place they disappear.
  it('treats unanswered and missing reload intent as required', () => {
    const unanswered = tx({
      id: 'unanswered',
      amount: -300,
      ledgerCategory: 'Stability',
      stabilityReloadIntent: 'Unanswered',
    })
    const missing = tx({ id: 'missing', amount: -200, ledgerCategory: 'Stability' })
    const spentForGood = tx({
      id: 'spent',
      amount: -100,
      ledgerCategory: 'Stability',
      stabilityReloadIntent: 'NotRequired',
    })

    for (const row of [unanswered, missing]) {
      expect(matchesTransactionFilters(row, { reloadFilter: 'put-back' })).toBe(true)
      expect(matchesTransactionFilters(row, { reloadFilter: 'needs-put-back' })).toBe(true)
      expect(matchesTransactionFilters(row, { reloadFilter: 'outstanding' })).toBe(true)
      expect(matchesTransactionFilters(row, { reloadFilter: 'not-required' })).toBe(false)
    }

    // 'Spent for good' stays isolated to NotRequired.
    expect(matchesTransactionFilters(spentForGood, { reloadFilter: 'put-back' })).toBe(false)
    expect(matchesTransactionFilters(spentForGood, { reloadFilter: 'needs-put-back' })).toBe(false)
    expect(matchesTransactionFilters(spentForGood, { reloadFilter: 'not-required' })).toBe(true)
  })

  it('matches an account filter on either the direct or the counter leg', () => {
    const direct = tx({ id: 'direct', accountId: 'essentials-wallet' })
    const counter = tx({
      id: 'counter',
      amount: 150,
      ledgerCategory: 'Transfer:Growth->Stability',
      accountId: 'growth-pot',
      counterAccountId: 'essentials-wallet',
    })
    const elsewhere = tx({ id: 'elsewhere', accountId: 'rewards-card' })
    const unattributed = tx({ id: 'unattributed' })

    const criteria = { accountIds: ['essentials-wallet'] }
    expect(matchesTransactionFilters(direct, criteria)).toBe(true)
    expect(matchesTransactionFilters(counter, criteria)).toBe(true)
    expect(matchesTransactionFilters(elsewhere, criteria)).toBe(false)
    expect(matchesTransactionFilters(unattributed, criteria)).toBe(false)

    // Multi-select is a union, and an empty selection is no filter at all.
    expect(matchesTransactionFilters(elsewhere, { accountIds: ['essentials-wallet', 'rewards-card'] })).toBe(true)
    expect(matchesTransactionFilters(unattributed, { accountIds: [] })).toBe(true)
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

  it('matches only a complete searchable field in exact mode', () => {
    expect(matchesTransactionFilters(tx({ description: 'Badminton' }), { search: 'badminton', searchMode: 'exact' })).toBe(true)
    expect(matchesTransactionFilters(tx({ description: 'Badminton String' }), { search: 'badminton', searchMode: 'exact' })).toBe(false)
    expect(matchesTransactionFilters(tx({ description: 'Badmintons' }), { search: 'badminton', searchMode: 'exact' })).toBe(false)
  })

  it('matches category and ledger allocation only when the complete field is equal', () => {
    expect(matchesTransactionFilters(tx({ description: 'Lunch', category: 'Food' }), { search: 'food', searchMode: 'exact' })).toBe(true)
    expect(matchesTransactionFilters(tx({ description: 'Lunch', category: 'Food Court' }), { search: 'food', searchMode: 'exact' })).toBe(false)
  })

  it('ignores surrounding whitespace in search text', () => {
    expect(matchesTransactionFilters(tx({ description: 'Coffee shop' }), { search: '  coffee  ' })).toBe(true)
    expect(matchesTransactionFilters(tx({ description: 'Coffee shop' }), { search: '   ' })).toBe(true)
  })

  it('supports all three recurring relationship modes', () => {
    const recurring = tx({ recurringPaymentId: 'rent' })
    const ordinary = tx({ recurringPaymentId: null })
    expect(matchesTransactionFilters(recurring, { recurringFilter: 'all' })).toBe(true)
    expect(matchesTransactionFilters(ordinary, { recurringFilter: 'all' })).toBe(true)
    expect(matchesTransactionFilters(recurring, { recurringFilter: 'exclude' })).toBe(false)
    expect(matchesTransactionFilters(ordinary, { recurringFilter: 'exclude' })).toBe(true)
    expect(matchesTransactionFilters(recurring, { recurringFilter: 'only' })).toBe(true)
    expect(matchesTransactionFilters(ordinary, { recurringFilter: 'only' })).toBe(false)
  })

  it('filters wishlist purchases by their wishlist item link', () => {
    expect(matchesTransactionFilters(tx({ wishlistItemId: 7 }), { wishlistFilter: 'only' })).toBe(true)
    expect(matchesTransactionFilters(tx({ wishlistItemId: null }), { wishlistFilter: 'only' })).toBe(false)
  })

  it('supports all three wishlist relationship modes', () => {
    const purchase = tx({ wishlistItemId: 7 })
    const ordinary = tx({ wishlistItemId: null })
    expect(matchesTransactionFilters(purchase, { wishlistFilter: 'exclude' })).toBe(false)
    expect(matchesTransactionFilters(ordinary, { wishlistFilter: 'exclude' })).toBe(true)
    expect(matchesTransactionFilters(purchase, { wishlistFilter: 'only' })).toBe(true)
    expect(matchesTransactionFilters(ordinary, { wishlistFilter: 'only' })).toBe(false)
  })

  it('requires all provided criteria to pass', () => {
    const t = tx({ description: 'Salary', amount: 500, category: 'Salary', ledgerCategory: 'Income' })
    expect(matchesTransactionFilters(t, { search: 'sal', buckets: ['Income'], txType: 'inflow' })).toBe(true)
    expect(matchesTransactionFilters(t, { search: 'sal', buckets: ['Growth'], txType: 'inflow' })).toBe(false)
  })
})
