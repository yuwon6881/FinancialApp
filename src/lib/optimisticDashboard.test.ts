import { describe, expect, it } from 'vitest'
import { computeOptimisticDashboard } from './optimisticDashboard'
import type { DashboardData, Transaction } from '../types'
import type { QueuedOp } from './outbox'

function makeDashboard(): DashboardData {
  return {
    setting: { currency: 'USD', cycleDay: 1 } as DashboardData['setting'],
    cycleLabel: 'Jan',
    categories: [
      { name: 'Food', allocation: 0, target: 0, budget: 100, netChange: -20, remaining: 80 },
      { name: 'Salary', allocation: 0, target: 0, budget: 0, netChange: 500, remaining: 500 },
    ],
    stats: {
      totalBalance: 1000,
      monthlyIncome: 0,
      monthlyInflow: 500,
      monthlyExpenses: 20,
      activeRecurringTotal: 0,
      growthPercentAchieved: 0,
      stabilityPercentReached: 0,
      pastThreeMonthsRewardsAverage: 0,
      hasRewardsHistory: false,
    },
    activeRecurringPayments: [],
    trendPoints: [],
    last3TrendPoints: [],
    last6TrendPoints: [],
    pendingNotifications: [],
    monthlyCategoryBreakdown: [],
    last3CategoryBreakdown: [],
    last6CategoryBreakdown: [],
    yearlyCategoryBreakdown: [],
  }
}

function op(partial: Partial<QueuedOp>): QueuedOp {
  return { id: 'op1', entity: 'transaction', type: 'add', targetId: 't1', createdAt: 0, retryCount: 0, ...partial }
}

describe('computeOptimisticDashboard', () => {
  it('returns null when there is no dashboard data', () => {
    expect(computeOptimisticDashboard(null, { activeOps: [], pendingOps: [], transactions: [] })).toBeNull()
  })

  it('returns an unchanged (but cloned) copy when there are no ops', () => {
    const dash = makeDashboard()
    const result = computeOptimisticDashboard(dash, { activeOps: [], pendingOps: [], transactions: [] })
    expect(result).not.toBe(dash)
    expect(result!.stats).toEqual(dash.stats)
    expect(result!.stats).not.toBe(dash.stats)
    expect(result!.categories[0]).not.toBe(dash.categories[0])
  })

  it('applies a pending expense: balance down, expenses up, category adjusted', () => {
    const result = computeOptimisticDashboard(makeDashboard(), {
      activeOps: [],
      pendingOps: [op({ type: 'add', payload: { amount: -30, category: 'Food' } })],
      transactions: [],
    })
    expect(result!.stats.totalBalance).toBe(970)
    expect(result!.stats.monthlyExpenses).toBe(50)
    const food = result!.categories.find(c => c.name === 'Food')!
    expect(food.netChange).toBe(-50)
    expect(food.remaining).toBe(50)
  })

  it('counts an IncomeSplit add toward monthlyIncome as well as inflow', () => {
    const result = computeOptimisticDashboard(makeDashboard(), {
      activeOps: [],
      pendingOps: [op({ type: 'add', payload: { amount: 200, ledgerCategory: 'IncomeSplit:50,20,20,10' } })],
      transactions: [],
    })
    expect(result!.stats.monthlyInflow).toBe(700)
    expect(result!.stats.monthlyIncome).toBe(200)
  })

  it('applies an update as the delta against the original transaction', () => {
    const orig: Transaction = { id: 't1', amount: -20, category: 'Food', ledgerCategory: 'Essentials' } as Transaction
    const result = computeOptimisticDashboard(makeDashboard(), {
      activeOps: [],
      pendingOps: [op({ type: 'update', targetId: 't1', payload: { amount: -50 } })],
      transactions: [orig],
    })
    // diff = -50 - (-20) = -30
    expect(result!.stats.totalBalance).toBe(970)
    expect(result!.stats.monthlyExpenses).toBe(50)
    const food = result!.categories.find(c => c.name === 'Food')!
    expect(food.netChange).toBe(-50)
  })

  it('reverses a delete using the original transaction amount', () => {
    const orig: Transaction = { id: 't1', amount: 500, category: 'Salary', ledgerCategory: 'Income' } as Transaction
    const result = computeOptimisticDashboard(makeDashboard(), {
      activeOps: [],
      pendingOps: [op({ type: 'delete', targetId: 't1' })],
      transactions: [orig],
    })
    expect(result!.stats.totalBalance).toBe(500)
    expect(result!.stats.monthlyInflow).toBe(0)
    const salary = result!.categories.find(c => c.name === 'Salary')!
    expect(salary.netChange).toBe(0)
  })

  it('merges a pending settings update from activeOps', () => {
    const result = computeOptimisticDashboard(makeDashboard(), {
      activeOps: [op({ entity: 'settings', type: 'update', payload: { currency: 'EUR' } })],
      pendingOps: [],
      transactions: [],
    })
    expect(result!.setting.currency).toBe('EUR')
  })

  it('ignores transaction ops that appear only in activeOps, not pendingOps', () => {
    const result = computeOptimisticDashboard(makeDashboard(), {
      activeOps: [op({ type: 'add', payload: { amount: -30, category: 'Food' } })],
      pendingOps: [],
      transactions: [],
    })
    expect(result!.stats.totalBalance).toBe(1000)
  })
})
