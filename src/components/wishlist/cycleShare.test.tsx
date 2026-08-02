import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { SavingsGoal } from '../../types'
import type { GoalPace, GoalPoolSummary } from '../../lib/savingsGoals'
import { RewardsPoolBar } from './RewardsPoolBar'
import { SavingsGoalCard } from './SavingsGoalCard'

// The cycle share is the number a user acts on ("do I owe anything right now?"), so it is asserted
// as a labelled meter rather than trusted to a caption that is easy to lose in a redesign.

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

const pace = (over: Partial<GoalPace> = {}): GoalPace => ({
  goalId: 7,
  remaining: 175,
  cyclesRemaining: 2,
  requiredPerCycle: 175,
  fundedThisCycle: 175,
  outstandingThisCycle: 0,
  isOverdue: false,
  isFunded: false,
  ...over,
})

const summary = (over: Partial<GoalPoolSummary> = {}): GoalPoolSummary => ({
  rewardsBalance: 550.4,
  totalEarmarked: 175,
  unassigned: 375.4,
  requiredPerCycleTotal: 175,
  fundedThisCycleTotal: 175,
  outstandingThisCycleTotal: 0,
  paceShortfall: 0,
  hasUnfinishedGoals: true,
  activeGoals: [goal],
  paces: new Map([[7, pace()]]),
  currentCycleKey: '2026-08',
  ...over,
})

const money = (value: number) => `RM ${value.toFixed(2)}`

function renderBar(over: Partial<GoalPoolSummary> = {}) {
  render(
    <RewardsPoolBar
      summary={summary(over)}
      expectedInflow={379.2}
      formatSensitive={money}
      hideSensitive={false}
      isOffline={false}
      onFundCycle={() => undefined}
    />,
  )
}

function renderCard(over: Partial<GoalPace> = {}) {
  const p = pace(over)
  render(
    <SavingsGoalCard
      goal={goal}
      pace={p}
      status={p.isFunded ? 'funded' : p.outstandingThisCycle > 0 ? 'needsFunding' : 'onPace'}
      formatSensitive={money}
      hideSensitive={false}
      isSyncing={false}
      isDeleting={false}
      onEdit={() => undefined}
      onDelete={() => undefined}
      onComplete={() => undefined}
      onTopUp={() => undefined}
      onRelease={() => undefined}
    />,
  )
}

describe('RewardsPoolBar cycle share', () => {
  it('shows funded against required, and a full meter, once the cycle is paced', () => {
    renderBar()
    expect(screen.getByText('This cycle')).toBeTruthy()
    expect(screen.getByText(/of RM 175\.00 set aside/)).toBeTruthy()
    const meter = screen.getByLabelText('Every commitment has its share for this cycle')
    expect((meter.firstElementChild as HTMLElement).style.width).toBe('100%')
  })

  it('reports what is still owed and part-fills the meter when the cycle is short', () => {
    renderBar({ fundedThisCycleTotal: 70, outstandingThisCycleTotal: 105 })
    const meter = screen.getByLabelText("40% of this cycle's commitments set aside")
    expect((meter.firstElementChild as HTMLElement).style.width).toBe('40%')
    expect(screen.getByText(/still to set aside across 1 commitment/)).toBeTruthy()
  })

  it('drops the panel entirely when there is nothing committed', () => {
    renderBar({ activeGoals: [], paces: new Map(), requiredPerCycleTotal: 0, fundedThisCycleTotal: 0 })
    expect(screen.queryByText('This cycle')).toBeNull()
  })
})

describe('SavingsGoalCard cycle share', () => {
  it('gives the cycle its own meter separate from the target bar', () => {
    renderCard({ fundedThisCycle: 70, outstandingThisCycle: 105 })
    expect(screen.getByText('This cycle')).toBeTruthy()
    expect(screen.getByText(/of RM 175\.00/)).toBeTruthy()
    const meter = screen.getByLabelText("40% of this cycle's share set aside")
    expect((meter.firstElementChild as HTMLElement).style.width).toBe('40%')
    expect(screen.getByText(/RM 105\.00 still to set aside/)).toBeTruthy()
  })

  it('marks a paced cycle done', () => {
    renderCard()
    expect(screen.getByLabelText("This cycle's share is set aside")).toBeTruthy()
    expect(screen.getByText('Done for this cycle')).toBeTruthy()
  })

  it('replaces the meter with a ready chip once the goal is fully funded', () => {
    renderCard({ isFunded: true, remaining: 0 })
    expect(screen.getByText('Ready to use')).toBeTruthy()
    expect(screen.queryByText('This cycle')).toBeNull()
  })
})
