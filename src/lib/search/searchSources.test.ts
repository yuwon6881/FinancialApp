import { describe, expect, it } from 'vitest'
import type { LedgerAccount, Loan, RecurringPayment, SavingsGoal, Transaction, WishlistItem } from '../../types'
import { RESULTS_PER_KIND, buildSearchResults, groupSearchResults, visibleSearchResults } from './searchSources'

const transaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 'tx-1',
  date: '2026-08-04',
  description: 'Coffee beans',
  category: 'Food',
  ledgerCategory: 'Essentials',
  amount: -12.5,
  ...overrides,
})

const account = (overrides: Partial<LedgerAccount> = {}): LedgerAccount => ({
  id: 'acc-1',
  name: 'Maybank Current',
  bucket: 'Essentials',
  kind: 'Bank',
  isArchived: false,
  remaining: 3200,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  ...overrides,
} as LedgerAccount)

const bill = (overrides: Partial<RecurringPayment> = {}): RecurringPayment => ({
  id: 'rp-1',
  name: 'Netflix',
  amount: 55,
  frequency: 'Monthly',
  category: 'Entertainment',
  ledgerCategory: 'Rewards',
  accountId: 'acc-1',
  nextDueDate: '2026-08-20',
  dueDate: 20,
  startDate: '2026-01-20',
  active: true,
  paymentMode: 'Manual',
  ...overrides,
} as RecurringPayment)

const loan = (overrides: Partial<Loan> = {}): Loan => ({
  id: 'loan-1',
  name: 'Education loan',
  recurringPaymentId: 'rp-ptptn',
  recurringPaymentName: 'PTPTN',
  openingPrincipal: 12000,
  trackingStartDate: '2026-01-01',
  annualRatePercent: 1.5,
  termPeriods: 120,
  interestMethod: 'ReducingBalance',
  snapshot: {
    outstandingBalance: 12000,
    scheduledPayment: 120,
    totalScheduledInterest: 300,
    totalInterestPaid: 0,
    payments: [],
    futureSchedule: [],
  },
  ...overrides,
})

const goal = (overrides: Partial<SavingsGoal> = {}): SavingsGoal => ({
  id: 1,
  name: 'Car fund',
  targetAmount: 20000,
  earmarkedAmount: 500,
  fundingBucket: 'Rewards',
  targetDate: '2027-01-01',
  priority: 'High',
  status: 'active',
  isRecurring: false,
  recurrenceMonths: 0,
  ...overrides,
} as SavingsGoal)

const reward = (overrides: Partial<WishlistItem> = {}): WishlistItem => ({
  id: 1,
  name: 'Headphones',
  price: 899,
  priority: 'Medium',
  isPurchased: false,
  createdAt: '2026-02-01',
  isActive: true,
  ...overrides,
} as WishlistItem)

describe('buildSearchResults', () => {
  it('returns nothing for an empty query rather than every record', () => {
    expect(buildSearchResults({ transactions: [transaction()] }, '   ')).toEqual([])
  })

  it('finds a transaction by description and targets it for highlight', () => {
    const [result] = buildSearchResults({ transactions: [transaction()] }, 'coffee')
    expect(result.kind).toBe('transaction')
    expect(result.title).toBe('Coffee beans')
    expect(result.amount).toBe(-12.5)
    expect(result.target).toEqual({ to: 'transaction', transactionId: 'tx-1', transactionDate: '2026-08-04' })
  })

  it('matches an amount on its bare magnitude so an outflow is findable', () => {
    expect(buildSearchResults({ transactions: [transaction()] }, '12.50')).toHaveLength(1)
    expect(buildSearchResults({ transactions: [transaction()] }, '13')).toHaveLength(0)
  })

  it('finds a transaction by category and by bucket', () => {
    expect(buildSearchResults({ transactions: [transaction()] }, 'food')).toHaveLength(1)
    expect(buildSearchResults({ transactions: [transaction()] }, 'essentials')).toHaveLength(1)
  })

  it('reads the bucket out of a compound ledger category', () => {
    const split = transaction({ ledgerCategory: 'Transfer:Growth->Essentials' })
    expect(buildSearchResults({ transactions: [split] }, 'transfer')).toHaveLength(1)
  })

  it('skips rows being deleted and rows with no description', () => {
    expect(buildSearchResults({ transactions: [transaction({ isPendingDelete: true })] }, 'coffee')).toEqual([])
    expect(buildSearchResults({ transactions: [transaction({ description: '  ' })] }, 'coffee')).toEqual([])
  })

  it('labels a closed account and a paused bill instead of hiding them', () => {
    const [closed] = buildSearchResults({ accounts: [account({ isArchived: true })] }, 'maybank')
    expect(closed.subtitle).toBe('Essentials · Closed')
    const [paused] = buildSearchResults({ recurringPayments: [bill({ active: false })] }, 'netflix')
    expect(paused.subtitle).toBe('Entertainment · Paused')
  })

  it('labels a bill whose schedule has ended even when its active flag remains set', () => {
    const [ended] = buildSearchResults({
      recurringPayments: [bill({ active: true, endDate: '2000-01-01' })],
    }, 'netflix')

    expect(ended.subtitle).toBe('Entertainment · Ended')
  })

  it('finds a loan through its linked bill name', () => {
    const [found] = buildSearchResults({ loans: [loan()] }, 'ptptn')
    expect(found.kind).toBe('loan')
    expect(found.title).toBe('Education loan')
    expect(found.subtitle).toBe('Paid by PTPTN')
  })

  it('sends every kind to its own row, so no result lands on a page and leaves the user searching again', () => {
    const [foundBill] = buildSearchResults({ recurringPayments: [bill()] }, 'netflix')
    expect(foundBill.target).toEqual({ to: 'bill', recurringPaymentId: 'rp-1' })
    const [foundLoan] = buildSearchResults({ loans: [loan()] }, 'education')
    expect(foundLoan.target).toEqual({ to: 'loan', loanId: 'loan-1' })
    const [foundGoal] = buildSearchResults({ savingsGoals: [goal()] }, 'car')
    expect(foundGoal.target).toEqual({ to: 'commitment', savingsGoalId: '1' })
    const [foundReward] = buildSearchResults({ wishlist: [reward()] }, 'headphones')
    expect(foundReward.target).toEqual({ to: 'reward', wishlistItemId: '1' })
    const [foundDraft] = buildSearchResults(
      { draftTransactions: [transaction({ id: 'draft-1', description: 'Weekend market' })] },
      'market',
    )
    expect(foundDraft.kind).toBe('draft')
    expect(foundDraft.target).toEqual({ to: 'draft', draftId: 'draft-1' })
  })

  it('opens a claimed reward through its linked purchase and omits an unlinked dead end', () => {
    const [claimed] = buildSearchResults({
      wishlist: [reward({
        isPurchased: true,
        purchaseTransactionId: 'purchase-tx-1',
        purchasedAt: '2026-07-18T08:00:00.000Z',
      })],
    }, 'headphones')
    expect(claimed.target).toEqual({
      to: 'transaction',
      transactionId: 'purchase-tx-1',
      transactionDate: '2026-07-18',
    })

    expect(buildSearchResults({
      wishlist: [reward({ isPurchased: true, purchaseTransactionId: null })],
    }, 'headphones')).toEqual([])
  })

  it('excludes the generated rows the server marks structural, and keeps a legacy row with no marker', () => {
    const generated = transaction({
      id: 'tx-split',
      description: '[Split: Essentials] Salary',
      excludeFromAutocomplete: true,
    })
    const adjustment = transaction({
      id: 'tx-adj',
      description: 'Salary adjustment',
      isAccountBalanceAdjustment: true,
    })
    const legacy = transaction({ id: 'tx-legacy', description: 'Salary' })
    const results = buildSearchResults(
      { transactions: [generated, adjustment, legacy] },
      'salary',
    )
    expect(results.map(result => result.id)).toEqual(['transaction:tx-legacy'])
  })

  it('drops a record queued for deletion and labels one still waiting to be saved', () => {
    const deleted = buildSearchResults({
      transactions: [transaction({ isPendingDelete: true })],
      accounts: [account({ isPendingDelete: true })],
      recurringPayments: [bill({ isPendingDelete: true })],
      loans: [loan({ isPendingDelete: true })],
      savingsGoals: [goal({ isPendingDelete: true })],
      wishlist: [reward({ isPendingDelete: true })],
    }, 'e')
    expect(deleted).toEqual([])

    const [pendingAccount] = buildSearchResults(
      { accounts: [account({ isPendingSync: true })] },
      'maybank',
    )
    expect(pendingAccount.isPendingSync).toBe(true)
  })

  it('narrows by when something happened, which is what an ANDed two-word query promised', () => {
    const august = transaction({ id: 'tx-aug', date: '2026-08-04', description: 'Coffee beans' })
    const january = transaction({ id: 'tx-jan', date: '2026-01-04', description: 'Coffee beans' })
    const source = { transactions: [august, january] }

    expect(buildSearchResults(source, 'coffee jan').map(result => result.id)).toEqual(['transaction:tx-jan'])
    expect(buildSearchResults(source, 'coffee january').map(result => result.id)).toEqual(['transaction:tx-jan'])
    expect(buildSearchResults(source, 'coffee 2026')).toHaveLength(2)
    expect(buildSearchResults(source, 'coffee march')).toEqual([])
  })

  it('searches every record kind from one query', () => {
    const results = buildSearchResults({
      transactions: [transaction({ description: 'Fund transfer' })],
      accounts: [account({ name: 'Fund account' })],
      recurringPayments: [bill({ name: 'Fund fee' })],
      savingsGoals: [goal({ name: 'Car fund' })],
      wishlist: [reward({ name: 'Fund book' })],
    }, 'fund')
    expect(results.map(result => result.kind).sort()).toEqual(
      ['account', 'bill', 'commitment', 'reward', 'transaction'],
    )
  })

  it('reports every match, and leaves the cap to grouping so the count cannot understate it', () => {
    const many = Array.from({ length: RESULTS_PER_KIND + 4 }, (_, index) =>
      transaction({ id: `tx-${index}`, description: `Coffee ${index}` }))
    expect(buildSearchResults({ transactions: many }, 'coffee')).toHaveLength(RESULTS_PER_KIND + 4)
  })

  it('ranks a stronger match first', () => {
    const results = buildSearchResults({
      transactions: [
        transaction({ id: 'tx-weak', description: 'Discount at Carrefour' }),
        transaction({ id: 'tx-strong', description: 'Car service' }),
      ],
    }, 'car')
    expect(results[0].id).toBe('transaction:tx-strong')
  })

  it('gives every result a unique id across kinds sharing a numeric key', () => {
    const results = buildSearchResults({ savingsGoals: [goal()], wishlist: [reward({ name: 'Car mount' })] }, 'car')
    expect(new Set(results.map(result => result.id)).size).toBe(results.length)
  })
})

describe('groupSearchResults', () => {
  it('groups in a fixed order and omits empty groups', () => {
    const groups = groupSearchResults(buildSearchResults({
      wishlist: [reward({ name: 'Car mount' })],
      transactions: [transaction({ description: 'Car wash' })],
    }, 'car'))
    expect(groups.map(group => group.kind)).toEqual(['transaction', 'reward'])
    expect(groups[0].label).toBe('Transactions in this cycle')
  })

  it('caps a group but still says how many matched, so nothing is dropped silently', () => {
    const many = Array.from({ length: RESULTS_PER_KIND + 4 }, (_, index) =>
      transaction({ id: `tx-${index}`, description: `Coffee ${index}` }))
    const [group] = groupSearchResults(buildSearchResults({ transactions: many }, 'coffee'))
    expect(group.results).toHaveLength(RESULTS_PER_KIND)
    expect(group.totalMatched).toBe(RESULTS_PER_KIND + 4)
  })

  it('reports no phantom extras when everything fits', () => {
    const [group] = groupSearchResults(buildSearchResults({ transactions: [transaction()] }, 'coffee'))
    expect(group.totalMatched).toBe(group.results.length)
  })

  it('offers exactly the rendered rows for keyboard selection', () => {
    const many = Array.from({ length: RESULTS_PER_KIND + 4 }, (_, index) =>
      transaction({ id: `tx-${index}`, description: `Coffee ${index}` }))
    const groups = groupSearchResults(buildSearchResults({ transactions: many }, 'coffee'))
    expect(visibleSearchResults(groups)).toHaveLength(RESULTS_PER_KIND)
  })
})
