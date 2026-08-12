import { describe, expect, it } from 'vitest'
import type { DashboardData, Transaction } from '../types'
import type { QueuedOp } from './outbox'
import { computeOptimisticDashboard } from './optimisticDashboard'

const transaction = (partial: Partial<Transaction> & Pick<Transaction, 'id' | 'amount'>): Transaction => ({
  date: '2026-08-10',
  description: String(partial.id),
  category: 'Food',
  ledgerCategory: 'Essentials',
  ...partial,
} as Transaction)

const baseTransactions = (): Transaction[] => [
  transaction({ id: 'salary', amount: 500, category: 'Salary', ledgerCategory: 'IncomeSplit:50,20,20,10', date: '2026-08-01' }),
  transaction({ id: 'food', amount: -20, category: 'Food', ledgerCategory: 'Essentials' }),
]

function dashboard(stabilityRecovery?: DashboardData['stabilityRecovery']): DashboardData {
  return {
    setting: {
      selectedMonth: 'Aug', selectedYear: 2026, cycleDay: 1, currency: 'USD',
      essentialsAlloc: .5, growthAlloc: .2, stabilityAlloc: .2, rewardsAlloc: .1,
      targetStabilityFund: 1000,
    } as DashboardData['setting'],
    cycleLabel: 'Aug 01 ~ Aug 31, 2026',
    categories: [
      { name: 'Essentials', allocation: .5, target: 250, incomeAllocated: 250, budget: 100, netChange: 230, spent: 20, remaining: 330 },
      { name: 'Growth', allocation: .2, target: 100, incomeAllocated: 100, budget: 0, netChange: 100, spent: 0, remaining: 100 },
      { name: 'Stability', allocation: .2, target: 100, incomeAllocated: 100, budget: 0, netChange: 100, spent: 0, remaining: 100 },
      { name: 'Rewards', allocation: .1, target: 50, incomeAllocated: 50, budget: 0, netChange: 50, spent: 0, remaining: 50 },
    ],
    stats: {
      totalBalance: 480, monthlyIncome: 500, monthlyInflow: 500, monthlyExpenses: 20,
      activeRecurringTotal: 0, growthPercentAchieved: 1, stabilityPercentReached: .1,
      pastThreeMonthsRewardsAverage: 0, hasRewardsHistory: false,
    },
    activeRecurringPayments: [], pendingNotifications: [],
    trendPoints: [{ cycleKey: '2026-08', month: 'Aug', balance: 100 }],
    last3TrendPoints: [{ cycleKey: '2026-08', month: 'Aug', balance: 100 }],
    last6TrendPoints: [{ cycleKey: '2026-08', month: 'Aug', balance: 100 }],
    monthlyCategoryBreakdown: [{ category: 'Food', amount: 20 }],
    last3CategoryBreakdown: [], last6CategoryBreakdown: [], yearlyCategoryBreakdown: [],
    cycleSummaryInsights: {
      cycleLengthDays: 31, noSpendDays: 30, transactionCount: 1,
      committedSpend: 0, discretionarySpend: 20,
    },
    stabilityRecovery,
  }
}

const recovery = (overrides: Partial<NonNullable<DashboardData['stabilityRecovery']>> = {}): NonNullable<DashboardData['stabilityRecovery']> => ({
  isActive: true,
  markedTotal: 500,
  target: 1000,
  currentBalance: 900,
  outstandingShortfall: 500,
  cyclesRemaining: 3,
  requiredThisCycle: 167,
  toppedUpThisCycle: 0,
  outstandingThisCycle: 167,
  isOverdue: false,
  lastDrawdownCycleKey: '2026-08',
  repaidTotal: 0,
  essentialsCommitted: 0,
  rewardsCommitted: 0,
  suggestedDraws: [],
  ...overrides,
})

const op = (partial: Partial<QueuedOp>): QueuedOp => ({
  id: 'op-1', entity: 'transaction', type: 'add', targetId: 'new', createdAt: 1, retryCount: 0,
  ...partial,
})

describe('computeOptimisticDashboard', () => {
  it('returns a cloned unchanged snapshot when no report-affecting operation exists', () => {
    const source = dashboard()
    const result = computeOptimisticDashboard(source, { activeOps: [], transactions: baseTransactions() })!
    expect(result).not.toBe(source)
    expect(result.stats).toEqual(source.stats)
  })

  it('replays a queued target change even when no transaction operation is pending', () => {
    const source = dashboard(recovery({
      currentBalance: 900,
      outstandingShortfall: 500,
      openingOutstanding: 500,
      openingOldestDate: '2026-08-01',
    }))
    const result = computeOptimisticDashboard(source, {
      activeOps: [op({
        entity: 'settings',
        type: 'update',
        targetId: 'settings',
        createdAt: Date.parse('2026-08-12T08:00:00.000Z'),
        payload: { targetStabilityFund: 800 },
      })],
      transactions: [],
    })!

    expect(result.setting.targetStabilityFund).toBe(800)
    expect(result.stabilityRecovery).toMatchObject({
      target: 800,
      outstandingShortfall: 0,
      isActive: false,
    })
  })

  it('projects a selected-cycle expense through totals, spending, breakdown, and insights', () => {
    const result = computeOptimisticDashboard(dashboard(), {
      activeOps: [op({ payload: { ...transaction({ id: 'new', amount: -30, category: 'food' }) } })],
      transactions: baseTransactions(),
    })!
    expect(result.stats.monthlyExpenses).toBe(50)
    expect(result.categories[0]).toMatchObject({ spent: 50, netChange: 200, remaining: 300 })
    expect(result.monthlyCategoryBreakdown).toEqual([{ category: 'Food', amount: 50 }])
    expect(result.cycleSummaryInsights?.transactionCount).toBe(2)
  })

  it('projects a marked drawdown before dispatch and keeps the same result after completion', () => {
    const drawdown = transaction({
      id: 'drawdown', amount: -50, category: 'Emergency', ledgerCategory: 'Stability',
      stabilityReloadIntent: 'Required',
    })
    const pending = computeOptimisticDashboard(dashboard(recovery()), {
      activeOps: [op({ payload: { ...drawdown } })],
      transactions: baseTransactions(),
    })!
    const completed = computeOptimisticDashboard(dashboard(recovery()), {
      activeOps: [op({ payload: { ...drawdown }, isCompleted: true })],
      transactions: baseTransactions(),
    })!

    expect(pending.stabilityRecovery).toMatchObject({
      currentBalance: 850,
      markedTotal: 550,
      outstandingShortfall: 550,
      isActive: true,
    })
    expect(completed.stabilityRecovery).toEqual(pending.stabilityRecovery)
  })

  it('does not project an add dated outside the selected cycle', () => {
    const result = computeOptimisticDashboard(dashboard(), {
      activeOps: [op({ payload: { ...transaction({ id: 'new', amount: -30, date: '2026-09-01' }) } })],
      transactions: baseTransactions(),
    })!
    expect(result.stats.monthlyExpenses).toBe(20)
    expect(result.categories[0].remaining).toBe(330)
  })

  it('removes the old side when an update moves a row out of the selected cycle', () => {
    const result = computeOptimisticDashboard(dashboard(), {
      activeOps: [op({ type: 'update', targetId: 'food', payload: { date: '2026-09-01' } })],
      transactions: baseTransactions(),
    })!
    expect(result.stats.monthlyExpenses).toBe(0)
    expect(result.categories[0]).toMatchObject({ spent: 0, netChange: 250, remaining: 350 })
  })

  it('adds the new side when an update moves a row into the selected cycle', () => {
    const outside = transaction({ id: 'outside', amount: -15, date: '2026-09-01' })
    const result = computeOptimisticDashboard(dashboard(), {
      activeOps: [op({ type: 'update', targetId: 'outside', payload: { date: '2026-08-20' } })],
      transactions: [...baseTransactions(), outside],
    })!
    expect(result.stats.monthlyExpenses).toBe(35)
    expect(result.categories[0].spent).toBe(35)
  })

  it('keeps transfers and adjustments out of report cash flow in every queue state', () => {
    const operations = [
      op({ targetId: 'adjust', payload: { ...transaction({ id: 'adjust', amount: -25, category: 'ADJUSTMENT' }) } }),
      op({ id: 'op-2', targetId: 'transfer', isCompleted: true, payload: { ...transaction({ id: 'transfer', amount: 10, category: 'transfer', ledgerCategory: 'Transfer:Essentials->Growth' }) } }),
    ]
    const result = computeOptimisticDashboard(dashboard(), { activeOps: operations, transactions: baseTransactions() })!
    expect(result.stats.monthlyInflow).toBe(500)
    expect(result.stats.monthlyExpenses).toBe(20)
    expect(result.monthlyCategoryBreakdown).toEqual([{ category: 'Food', amount: 20 }])
    expect(result.categories[0].remaining).toBe(295)
    expect(result.categories[1].remaining).toBe(110)
  })

  it('projects a bulk delete and a completed-before-refresh operation identically', () => {
    const pending = op({
      type: 'bulkDelete', targetId: 'bulk',
      payload: { transactionIds: ['food'], transactions: [baseTransactions()[1]] },
    })
    const pendingResult = computeOptimisticDashboard(dashboard(), { activeOps: [pending], transactions: baseTransactions() })!
    const completedResult = computeOptimisticDashboard(dashboard(), { activeOps: [{ ...pending, isCompleted: true }], transactions: baseTransactions() })!
    expect(pendingResult.stats.monthlyExpenses).toBe(0)
    expect(completedResult).toEqual(pendingResult)
  })

  it('updates the selected and downstream Growth trend points', () => {
    const source = dashboard()
    source.trendPoints.push({ cycleKey: '2026-09', month: 'Sep', balance: 120 })
    const result = computeOptimisticDashboard(source, {
      activeOps: [op({ payload: { ...transaction({ id: 'growth', amount: 25, category: 'Deposit', ledgerCategory: 'Growth' }) } })],
      transactions: baseTransactions(),
    })!
    expect(result.trendPoints.map(point => point.balance)).toEqual([125, 145])
  })

  it('projects a selected-cycle recurring settlement and clears its alert', () => {
    const source = dashboard()
    source.activeRecurringPayments = [{
      id: 'occ', recurringPaymentId: 'rent', name: 'Rent', amount: 50, category: 'Bills',
      ledgerCategory: 'Essentials', dueDate: '2026-08-12', isPaid: false, isDiscarded: false, status: 'Pending',
    }]
    source.pendingNotifications = [{
      id: 'occ', recurringPaymentId: 'rent', name: 'Rent', amount: 50, category: 'Bills',
      ledgerCategory: 'Essentials', billingDate: '2026-08-12', year: 2026, month: 8, cycleLabel: 'Aug',
    }]
    const result = computeOptimisticDashboard(source, {
      activeOps: [op({
        entity: 'recurringOccurrence', type: 'settle', targetId: 'occ',
        payload: {
          recurringPaymentId: 'rent', occurrenceDate: '2026-08-12', status: 'Paid',
          optimisticTransaction: transaction({ id: 'rent-tx', amount: -50, category: 'Bills', recurringPaymentId: 'rent' }),
        },
      })],
      transactions: baseTransactions(),
    })!
    expect(result.activeRecurringPayments[0].status).toBe('Paid')
    expect(result.pendingNotifications).toEqual([])
    expect(result.stats.monthlyExpenses).toBe(70)
  })
})
