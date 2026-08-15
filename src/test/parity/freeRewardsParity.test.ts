import { describe, expect, it } from 'vitest'
import { calculateFreeRewardsBalance, pendingRewardsAmount } from '../../lib/freeRewards'
import type { SavingsGoal } from '../../types'
import { forEachFreeRewardsCase } from './runParity'

describe('free Rewards parity fixture', () => {
  for (const testCase of forEachFreeRewardsCase()) {
    it(`${testCase.id}: ${testCase.why}`, () => {
      const goals: SavingsGoal[] = testCase.input.goals.map((goal, index) => ({
        id: index + 1,
        name: `Parity goal ${index + 1}`,
        targetAmount: goal.earmarkedAmount,
        earmarkedAmount: goal.earmarkedAmount,
        targetDate: '2026-09-20',
        priority: 'Medium',
        status: goal.status as SavingsGoal['status'],
        fundingBucket: goal.fundingBucket as SavingsGoal['fundingBucket'],
        isPendingDelete: goal.isPendingDelete,
        isRecurring: false,
        recurrenceMonths: 12,
        cycleFundedAmount: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
      }))
      const pending = pendingRewardsAmount(testCase.input.pendingOccurrences.map(occurrence => ({
        status: occurrence.status,
        amount: occurrence.scheduledAmount,
        ledgerCategory: occurrence.ledgerCategory,
      })))

      expect(pending).toBe(testCase.expected.pendingRewards)
      expect(calculateFreeRewardsBalance(
        testCase.input.rewardsBalance,
        goals,
        pending,
      )).toBe(testCase.expected.unassigned)
    })
  }
})
