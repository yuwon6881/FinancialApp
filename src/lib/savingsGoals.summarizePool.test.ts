import { describe, expect, it } from 'vitest'
import type { SavingsGoal } from '../types'
import { summarizePool } from './savingsGoals'

const today = new Date(2026, 6, 15)

function goal(overrides: Partial<SavingsGoal> = {}): SavingsGoal {
  return {
    id: 1,
    name: 'Goal',
    targetAmount: 1000,
    earmarkedAmount: 0,
    targetDate: '2026-08-05',
    priority: 'Medium',
    status: 'active',
    isRecurring: false,
    recurrenceMonths: 12,
    cycleFundedAmount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('summarizePool', () => {
  it('nets free money into the pacing warning', () => {
    const summary = summarizePool([goal()], 5000, 0, today, 1)

    expect(summary.rewardsBalance).toBe(5000)
    expect(summary.totalEarmarked).toBe(0)
    expect(summary.unassigned).toBe(5000)
    expect(summary.requiredPerCycleTotal).toBe(500)
    expect(summary.outstandingThisCycleTotal).toBe(500)
    expect(summary.paceShortfall).toBe(0)
  })

  it('holds pending Rewards bills and excludes completed commitments', () => {
    const summary = summarizePool([
      goal({ id: 1, earmarkedAmount: 300 }),
      goal({ id: 2, status: 'completed', earmarkedAmount: 200 }),
    ], 1000, 0, today, 1, 150)

    expect(summary.rewardsBalance).toBe(850)
    expect(summary.totalEarmarked).toBe(300)
    expect(summary.unassigned).toBe(550)
    expect(summary.activeGoals.map(item => item.id)).toEqual([1])
  })
})
