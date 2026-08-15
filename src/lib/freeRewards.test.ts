import { describe, expect, it } from 'vitest'
import type { SavingsGoal } from '../types'
import { calculateFreeRewardsBalance, pendingRewardsAmount } from './freeRewards'

function goal(overrides: Partial<SavingsGoal> = {}): SavingsGoal {
  return {
    id: 1,
    name: 'Goal',
    targetAmount: 1000,
    earmarkedAmount: 300,
    targetDate: '2026-09-20',
    priority: 'Medium',
    status: 'active',
    isRecurring: false,
    recurrenceMonths: 12,
    cycleFundedAmount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('free Rewards calculation', () => {
  it('subtracts active Rewards earmarks and pending Rewards bills', () => {
    expect(calculateFreeRewardsBalance(1000, [goal()], 150)).toBe(550)
  })

  it('ignores completed, Essentials, and pending-delete commitments', () => {
    expect(calculateFreeRewardsBalance(1000, [
      goal({ id: 1, status: 'completed', earmarkedAmount: 200 }),
      goal({ id: 2, fundingBucket: 'Essentials', earmarkedAmount: 300 }),
      goal({ id: 3, isPendingDelete: true, earmarkedAmount: 400 }),
    ], 0)).toBe(1000)
  })

  it('matches pending bills by exact bucket ledger category only', () => {
    expect(pendingRewardsAmount([
      { status: 'Pending', amount: 150, ledgerCategory: 'rewards' },
      { status: 'Pending', amount: 90, ledgerCategory: 'Essentials' },
      { status: 'Pending', amount: 60, ledgerCategory: '' },
      { status: 'Paid', amount: 40, ledgerCategory: 'Rewards' },
    ])).toBe(150)
  })
})
