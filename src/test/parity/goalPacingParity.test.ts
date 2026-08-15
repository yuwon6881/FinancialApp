import { describe, expect, it } from 'vitest'
import type { SavingsGoal } from '../../types'
import { computePace } from '../../lib/savingsGoals'
import { forEachGoalPacingCase } from './runParity'

function localDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

describe('goal pacing parity fixture', () => {
  for (const testCase of forEachGoalPacingCase()) {
    it(`${testCase.id}: ${testCase.why}`, () => {
      const input = testCase.input
      const goal: SavingsGoal = {
        id: input.goal.id,
        name: 'Parity goal',
        targetAmount: input.goal.targetAmount,
        earmarkedAmount: input.goal.earmarkedAmount,
        targetDate: input.targetDate,
        priority: 'Medium',
        status: input.goal.status as SavingsGoal['status'],
        isRecurring: false,
        recurrenceMonths: 12,
        cycleFundedKey: input.goal.cycleFundedKey ?? undefined,
        cycleFundedAmount: input.goal.cycleFundedAmount,
        createdAt: '2026-01-01T00:00:00.000Z',
      }
      const actual = computePace(goal, localDate(input.today), input.cycleDay, input.currentCycleKey)

      expect(actual).toMatchObject(testCase.expected)
    })
  }
})
