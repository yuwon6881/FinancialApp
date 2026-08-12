import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { SavingsGoal, WishlistItem } from '../../types'
import type { GoalPace, GoalPoolSummary } from '../../lib/savingsGoals'
import { RewardsPoolBar } from './RewardsPoolBar'
import { RewardCard } from './RewardCard'
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

// A second commitment, because the pool's own cycle panel is what *summing* looks like: with one
// goal every figure in it already appears verbatim on that goal's card, so the panel is suppressed
// and there would be nothing to assert against.
const secondGoal: SavingsGoal = { ...goal, id: 8, name: 'Laptop' }

const summary = (over: Partial<GoalPoolSummary> = {}): GoalPoolSummary => ({
  rewardsBalance: 550.4,
  totalEarmarked: 175,
  unassigned: 375.4,
  requiredPerCycleTotal: 175,
  fundedThisCycleTotal: 175,
  outstandingThisCycleTotal: 0,
  paceShortfall: 0,
  hasUnfinishedGoals: true,
  activeGoals: [goal, secondGoal],
  paces: new Map([[7, pace()], [8, pace({ goalId: 8 })]]),
  currentCycleKey: '2026-08',
  ...over,
})

const money = (value: number) => `RM ${value.toFixed(2)}`

const reward: WishlistItem = {
  id: 11,
  name: 'Noise-cancelling headphones',
  price: 250,
  priority: 'Medium',
  isPurchased: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  isActive: false,
}

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

function renderRewardCard(freeAfterGoalPace = 100, claimableBalance = 100) {
  render(
    <RewardCard
      item={reward}
      isFocused={false}
      claimableBalance={claimableBalance}
      freeAfterGoalPace={freeAfterGoalPace}
      formatSensitive={money}
      hideSensitive={false}
      isSyncing={false}
      isDeleting={false}
      onClaim={() => undefined}
      onFocus={() => undefined}
      onEdit={() => undefined}
      onDelete={() => undefined}
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
    expect(screen.getByText(/still to set aside across 2 commitments/)).toBeTruthy()
  })

  it('drops the panel entirely when there is nothing committed', () => {
    renderBar({ activeGoals: [], paces: new Map(), requiredPerCycleTotal: 0, fundedThisCycleTotal: 0 })
    expect(screen.queryByText('This cycle')).toBeNull()
  })

  it('drops the panel for a single commitment, whose own card already carries every figure in it', () => {
    renderBar({ activeGoals: [goal], paces: new Map([[7, pace()]]) })
    expect(screen.queryByText('This cycle')).toBeNull()
    expect(screen.queryByText(/of RM 175\.00 set aside/)).toBeNull()
  })

  it('reports a paced cycle as a status pill, never as a disabled button', () => {
    renderBar()
    const funded = screen.getByText('Funded this cycle')
    expect(funded.closest('button')).toBeNull()
    expect(screen.queryByRole('button', { name: /set aside/i })).toBeNull()
  })

  it('offers the funding button, with the outstanding amount on it, while the cycle is short', () => {
    renderBar({ fundedThisCycleTotal: 70, outstandingThisCycleTotal: 105 })
    expect(screen.getByRole('button', { name: /Set aside RM 105\.00/ })).toBeTruthy()
    expect(screen.queryByText('Funded this cycle')).toBeNull()
  })

  // The waterfall grants min(outstanding, free), so the button has to name the amount that will
  // actually move. Labelled with the outstanding figure it promised money the pool did not hold.
  it('names what the free balance can actually cover, not what the cycle owes', () => {
    renderBar({ fundedThisCycleTotal: 70, outstandingThisCycleTotal: 105, unassigned: 40 })
    expect(screen.getByRole('button', { name: /Set aside RM 40\.00/ })).toBeTruthy()
  })

  it('says so when the earmarks outrun the balance, instead of only showing nothing free', () => {
    renderBar({ rewardsBalance: 120, totalEarmarked: 175, unassigned: 0 })
    expect(screen.getByText(/claim RM 55\.00 more than your rewards hold/)).toBeTruthy()
  })

  it('stays quiet about over-commitment while the balance covers the earmarks', () => {
    renderBar()
    expect(screen.queryByText(/more than your rewards hold/)).toBeNull()
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

  it('animates into compact management actions without inheriting completion styles', async () => {
    renderCard()
    const completeButton = screen.getByRole('button', { name: 'Complete this cycle for Car Maintenance' })

    fireEvent.click(screen.getByRole('button', { name: 'Edit or delete Car Maintenance' }))

    const deleteButton = await screen.findByRole('button', { name: 'Delete Car Maintenance' })
    expect(deleteButton).not.toBe(completeButton)
    expect(deleteButton.className).toContain('shrink-0')
    expect(deleteButton.className).not.toContain('flex-1')
  })
})

describe('RewardCard management actions', () => {
  it('warns when a claimable reward would consume this cycle\'s goal pace', () => {
    renderRewardCard(200, 300)
    expect(screen.getByText(/Buying this leaves your goals/)).toBeTruthy()
    expect(screen.getByText('RM 50.00')).toBeTruthy()
  })

  it('does not warn when the claim leaves enough free money for the goal pace', () => {
    renderRewardCard(300, 300)
    expect(screen.queryByText(/leaves your goals/)).toBeNull()
  })

  it('animates into compact management actions without inheriting the claim style', async () => {
    renderRewardCard()
    const claimButton = screen.getByRole('button', { name: 'Claim' })

    fireEvent.click(screen.getByRole('button', { name: 'Edit or delete Noise-cancelling headphones' }))

    const editButton = await screen.findByRole('button', { name: 'Edit Noise-cancelling headphones' })
    expect(editButton).not.toBe(claimButton)
    expect(editButton.className).toContain('shrink-0')
    expect(editButton.className).not.toContain('flex-1')
  })
})
