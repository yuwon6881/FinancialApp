import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { SavingsGoal } from '../../types'
import type { GoalPace, GoalPoolSummary } from '../../lib/savingsGoals'
import { RewardsPoolBar } from './RewardsPoolBar'

const goal: SavingsGoal = {
  id: 7,
  name: 'Car Maintenance',
  targetAmount: 350,
  earmarkedAmount: 175,
  targetDate: '2026-09-15',
  priority: 'Medium',
  status: 'active',
  isRecurring: true,
  recurrenceMonths: 3,
  cycleFundedAmount: 175,
  createdAt: '2026-01-01T00:00:00.000Z',
}

const pace: GoalPace = {
  goalId: 7,
  remaining: 175,
  cyclesRemaining: 2,
  requiredPerCycle: 175,
  fundedThisCycle: 175,
  outstandingThisCycle: 0,
  isOverdue: false,
  isFunded: false,
}

const createSummary = (over: Partial<GoalPoolSummary> = {}): GoalPoolSummary => ({
  rewardsBalance: 550.4,
  totalEarmarked: 175,
  unassigned: 375.4,
  requiredPerCycleTotal: 175,
  fundedThisCycleTotal: 75,
  outstandingThisCycleTotal: 100,
  paceShortfall: 0,
  hasUnfinishedGoals: true,
  activeGoals: [goal],
  paces: new Map([[7, pace]]),
  currentCycleKey: '2026-08',
  ...over,
})

const money = (value: number) => `RM ${value.toFixed(2)}`

function renderBar(
  over: Partial<GoalPoolSummary> = {},
  props: Partial<React.ComponentProps<typeof RewardsPoolBar>> = {},
) {
  return render(
    <RewardsPoolBar
      summary={createSummary(over)}
      expectedInflow={0}
      formatSensitive={money}
      hideSensitive={false}
      isOffline={false}
      onFundCycle={() => undefined}
      {...props}
    />,
  )
}

describe('RewardsPoolBar Set aside action', () => {
  it('shows an enabled "Set aside" button when there are unfinished goals, outstanding > 0 and unassigned > 0', () => {
    renderBar({
      hasUnfinishedGoals: true,
      outstandingThisCycleTotal: 100,
      unassigned: 50,
    })
    const button = screen.getByRole('button', { name: /^Set aside/ })
    expect(button).toBeTruthy()
    expect((button as HTMLButtonElement).disabled).toBe(false)
  })

  it('does not show a button whose name starts with "Set aside" when goals are unfinished, outstanding > 0, but unassigned = 0', () => {
    renderBar({
      hasUnfinishedGoals: true,
      outstandingThisCycleTotal: 100,
      unassigned: 0,
    })
    expect(screen.queryByRole('button', { name: /^Set aside/ })).toBeNull()
  })

  it('does not show a "Set aside" button when the cycle is fully funded (outstandingThisCycleTotal = 0)', () => {
    renderBar({
      hasUnfinishedGoals: true,
      outstandingThisCycleTotal: 0,
      unassigned: 50,
    })
    expect(screen.queryByRole('button', { name: /^Set aside/ })).toBeNull()
  })

  it('keeps the button visible while a funding request is in flight', () => {
    renderBar(
      {
        hasUnfinishedGoals: true,
        outstandingThisCycleTotal: 100,
        unassigned: 0,
      },
      { isFunding: true },
    )
    expect(screen.getByRole('button', { name: /Setting aside/ })).toBeTruthy()
  })

  it('hides the button if fundableNow is NaN', () => {
    renderBar({
      hasUnfinishedGoals: true,
      outstandingThisCycleTotal: Number.NaN,
      unassigned: 50,
    })
    expect(screen.queryByRole('button', { name: /^Set aside/ })).toBeNull()
  })
})
