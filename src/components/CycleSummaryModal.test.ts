import { describe, expect, it } from 'vitest'
import type { DashboardData, Loan, Transaction, WishlistItem } from '../types'
import { buildCycleSummary, formatRate, formatRateChange } from '../lib/cycleSummary'

function dashboard(overrides: Partial<DashboardData> = {}): DashboardData {
  return {
    setting: {
      targetStabilityFund: 1000,
      selectedMonth: 'Jul',
      selectedYear: 2026,
      essentialsAlloc: 0.5,
      growthAlloc: 0.2,
      stabilityAlloc: 0.1,
      rewardsAlloc: 0.2,
      cycleDay: 1,
      darkMode: false,
      hideSensitive: false,
    },
    cycleLabel: 'Jul 01 ~ Jul 31, 2026',
    categories: [
      { name: 'Essentials', allocation: 0.5, target: 500, incomeAllocated: 500, budget: 0, netChange: 375, spent: 125, remaining: 375 },
      { name: 'Growth', allocation: 0.2, target: 200, incomeAllocated: 200, budget: 0, netChange: 160, spent: 40, remaining: 160 },
      { name: 'Stability', allocation: 0.1, target: 100, incomeAllocated: 100, budget: 0, netChange: 100, spent: 0, remaining: 100 },
      { name: 'Rewards', allocation: 0.2, target: 200, incomeAllocated: 200, budget: 0, netChange: 175, spent: 25, remaining: 175 },
    ],
    stats: {
      totalBalance: 650,
      monthlyIncome: 1000,
      monthlyInflow: 1000,
      monthlyExpenses: 190,
      activeRecurringTotal: 0,
      growthPercentAchieved: 0.8,
      stabilityPercentReached: 0.1,
      pastThreeMonthsRewardsAverage: 0,
      hasRewardsHistory: false,
    },
    activeRecurringPayments: [],
    trendPoints: [],
    last3TrendPoints: [],
    last6TrendPoints: [],
    pendingNotifications: [],
    monthlyCategoryBreakdown: [{ category: 'Food', amount: 125 }, { category: 'Education', amount: 40 }],
    last3CategoryBreakdown: [],
    last6CategoryBreakdown: [],
    yearlyCategoryBreakdown: [],
    availableYears: [2026],
    ...overrides,
  }
}

function wish(overrides: Partial<WishlistItem> = {}): WishlistItem {
  return {
    id: 1,
    name: 'Headphones',
    price: 80,
    priority: 'Medium',
    isPurchased: true,
    purchasedAt: '2026-07-15T08:00:00.000Z',
    createdAt: '2026-06-01T00:00:00.000Z',
    isActive: false,
    ...overrides,
  }
}

describe('buildCycleSummary', () => {
  it('describes savings rates and percentage-point changes without cryptic notation', () => {
    expect(formatRate(0.81)).toBe('81%')
    expect(formatRateChange(-0.8)).toBe('80 points lower')
    expect(formatRateChange(0.087)).toBe('9 points higher')
    expect(formatRateChange(0)).toBe('No change')
  })

  it('uses true envelope outflows instead of treating net change as spending', () => {
    const summary = buildCycleSummary(dashboard(), null, [], 2026, 7, 1)

    expect(summary.envelopes.map(envelope => [envelope.name, envelope.spent])).toEqual([
      ['Essentials', 125],
      ['Growth', 40],
      ['Stability', 0],
      ['Rewards', 25],
    ])
  })

  it('keeps the account-level closing balances behind each ledger bucket', () => {
    const data = dashboard({
      categories: dashboard().categories.map(category => category.name === 'Essentials'
        ? {
            ...category,
            accounts: [
              { id: 'cash', name: 'Cash', kind: 'Cash', remaining: 75 },
              { id: 'bank', name: 'Main bank', kind: 'Bank', remaining: 300 },
            ],
          }
        : category),
    })

    const essentials = buildCycleSummary(data, null, [], 2026, 7, 1).envelopes[0]

    expect(essentials.accounts.map(account => [account.name, account.remaining])).toEqual([
      ['Main bank', 300],
      ['Cash', 75],
    ])
  })

  it('includes partial and payoff bill states in the cycle totals', () => {
    const summary = buildCycleSummary(dashboard({
      activeRecurringPayments: [
        { id: 'paid', recurringPaymentId: 'paid', name: 'Paid', amount: 100, paidAmount: 100, remainingAmount: 0, category: 'Bills', ledgerCategory: 'Essentials', dueDate: '2026-07-05', isPaid: true, isDiscarded: false, status: 'Paid' },
        { id: 'part', recurringPaymentId: 'part', name: 'Part', amount: 120, paidAmount: 40, remainingAmount: 80, category: 'Bills', ledgerCategory: 'Essentials', dueDate: '2026-07-10', isPaid: false, isDiscarded: false, status: 'PartiallyPaid' },
        { id: 'open', recurringPaymentId: 'open', name: 'Open', amount: 60, paidAmount: 0, remainingAmount: 60, category: 'Bills', ledgerCategory: 'Essentials', dueDate: '2026-07-15', isPaid: false, isDiscarded: false, status: 'Pending' },
        { id: 'settled', recurringPaymentId: 'settled', name: 'Settled loan', amount: 200, paidAmount: 0, remainingAmount: 0, category: 'Loan', ledgerCategory: 'Essentials', dueDate: '2026-07-20', isPaid: true, isDiscarded: false, status: 'SettledByLoanPayoff' },
      ],
    }), null, [], 2026, 7, 1)

    expect(summary.paidTotal).toBe(140)
    expect(summary.partPaidCount).toBe(1)
    expect(summary.paidOffBillsCount).toBe(1)
    expect(summary.outstandingCount).toBe(2)
    expect(summary.outstandingTotal).toBe(140)
  })

  it('summarizes loan payments, advance repayments, and a payoff from linked ledger rows', () => {
    const loan = {
      id: 'loan-1',
      name: 'Car loan',
      recurringPaymentId: 'car-bill',
      snapshot: {
        payments: [{ transactionId: 'advance', balanceAfter: 0 }],
      },
    } as Loan
    const transactions = [
      { id: 'regular', date: '2026-07-05', description: 'Car loan', category: 'Loan', ledgerCategory: 'Essentials', amount: -100, recurringPaymentId: 'car-bill', recurringOccurrenceDate: '2026-07-05' },
      { id: 'advance', date: '2026-07-10', description: 'Car loan advance', category: 'Loan', ledgerCategory: 'Essentials', amount: -200, recurringPaymentId: 'car-bill', recurringOccurrenceDate: '2026-08-05' },
      { id: 'other-bill', date: '2026-07-12', description: 'Phone', category: 'Bills', ledgerCategory: 'Essentials', amount: -50, recurringPaymentId: 'phone-bill', recurringOccurrenceDate: '2026-07-12' },
    ] as Transaction[]

    const summary = buildCycleSummary(dashboard(), null, [], 2026, 7, 1, transactions, [loan])

    expect(summary.loanPaymentTotal).toBe(300)
    expect(summary.loanPaymentCount).toBe(2)
    expect(summary.loanPaidAheadCount).toBe(1)
    expect(summary.loanPaidAheadTotal).toBe(200)
    expect(summary.loansPaidOffCount).toBe(1)
    expect(summary.loanActivity[0]).toMatchObject({ name: 'Car loan', total: 300, paidAheadCount: 1, paidOffThisCycle: true })
  })

  it('shows up to eight categories in Where it went', () => {
    const monthlyCategoryBreakdown = Array.from({ length: 10 }, (_, index) => ({
      category: `Category ${index + 1}`,
      amount: index + 1,
    }))

    const summary = buildCycleSummary(dashboard({ monthlyCategoryBreakdown }), null, [], 2026, 7, 1)

    expect(summary.topCategories).toHaveLength(8)
    expect(summary.topCategories.map(category => category.amount)).toEqual([10, 9, 8, 7, 6, 5, 4, 3])
  })

  it('includes only wishlist items purchased inside the summarized cycle', () => {
    const summary = buildCycleSummary(
      dashboard(),
      null,
      [wish(), wish({ id: 2, name: 'Old item', purchasedAt: '2026-06-30T08:00:00.000Z' })],
      2026,
      7,
      1,
    )

    expect(summary.purchasedThisCycle.map(item => item.name)).toEqual(['Headphones'])
    expect(summary.purchasedTotal).toBe(80)
  })

  it('uses the linked ledger snapshot for wishlist date and amount', () => {
    const item = wish({ price: 120, purchasedAt: '2026-08-01T08:00:00.000Z', purchaseTransactionId: 'wish-tx' })
    const linked = {
      id: 'wish-tx', date: '2026-07-20', amount: -80, wishlistItemId: item.id,
      description: 'Purchased: Headphones', category: 'Other', ledgerCategory: 'Rewards',
    } as Transaction

    const summary = buildCycleSummary(dashboard(), null, [item], 2026, 7, 1, [linked])

    expect(summary.purchasedThisCycle).toHaveLength(1)
    expect(summary.purchasedTotal).toBe(80)
  })

  it('bases savings rate on actual income and leaves it unavailable without income', () => {
    const withRefund = dashboard({
      stats: { ...dashboard().stats, monthlyIncome: 1000, monthlyInflow: 1200, monthlyExpenses: 190 },
    })
    const noIncome = dashboard({
      stats: { ...dashboard().stats, monthlyIncome: 0, monthlyInflow: 200, monthlyExpenses: 50 },
    })

    expect(buildCycleSummary(withRefund, null, [], 2026, 7, 1).savingsRate).toBeCloseTo(.81)
    expect(buildCycleSummary(noIncome, null, [], 2026, 7, 1).savingsRate).toBeNull()
  })

  it('derives previous-cycle spending, savings, category, and growth comparisons', () => {
    const previous = dashboard({
      categories: dashboard().categories.map(category => category.name === 'Growth' ? { ...category, remaining: 120 } : category),
      stats: { ...dashboard().stats, monthlyInflow: 900, monthlyIncome: 900, monthlyExpenses: 250 },
      monthlyCategoryBreakdown: [{ category: 'Food', amount: 200 }, { category: 'Education', amount: 20 }],
    })
    const summary = buildCycleSummary(dashboard(), previous, [], 2026, 7, 1)

    expect(summary.spendingDelta).toBe(-60)
    expect(summary.savingsRate).toBeCloseTo(0.81)
    expect(summary.previousSavingsRate).toBeCloseTo(650 / 900)
    expect(summary.biggestCategoryShift).toEqual({ category: 'Food', delta: -75 })
    expect(summary.growthDelta).toBe(40)
  })

  it('recognizes a truly empty cycle instead of presenting zero as a positive result', () => {
    const empty = dashboard({
      stats: { ...dashboard().stats, monthlyIncome: 0, monthlyInflow: 0, monthlyExpenses: 0 },
      monthlyCategoryBreakdown: [],
      activeRecurringPayments: [],
    })

    expect(buildCycleSummary(empty, null, [], 2026, 7, 1).hasActivity).toBe(false)
  })

  it('includes tracked category guides ordered by the ones needing attention', () => {
    const summary = buildCycleSummary(dashboard({
      categoryLimitProgress: [
        { category: 'Food', limit: 400, spent: 320, remaining: 80, pendingCommitted: 0, projectedSpend: 320, percentUsed: 0.8, status: 'OnTrack' },
        { category: 'Transport', limit: 200, spent: 230, remaining: -30, pendingCommitted: 0, projectedSpend: 230, percentUsed: 1.15, status: 'Exceeded' },
      ],
    }), null, [], 2026, 7, 1)

    expect(summary.categoryLimits.map(item => item.category)).toEqual(['Transport', 'Food'])
    expect(summary.categoryLimitsMet).toBe(1)
  })
})
