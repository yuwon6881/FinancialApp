import { describe, expect, it } from 'vitest'
import type { SavingsGoal } from '../types'
import {
  computePace,
  calculateFreeRewardsBalance,
  cyclesRemaining,
  getPaceStatus,
  orderForFunding,
  previewRequiredPerCycle,
  summarizePool,
} from './savingsGoals'
import { pendingRecurringAmount, pendingRewardsAmount } from './freeRewards'

// cycleDay 1 keeps cycles aligned to calendar months so the expectations read plainly. The
// numbers below deliberately match SavingsGoalPacingTests.cs case for case — if one side changes,
// the other has to change with it or the UI will show a pace the server does not fund.
const CYCLE_DAY = 1
const CYCLE_KEY = '2026-07'
const TODAY = new Date(2026, 6, 15) // 15 Jul 2026, local

function newGoal(overrides: Partial<SavingsGoal> = {}): SavingsGoal {
  return {
    id: 1,
    name: 'Goal',
    targetAmount: 1000,
    earmarkedAmount: 0,
    targetDate: '2026-12-01',
    priority: 'Medium',
    status: 'active',
    isRecurring: false,
    recurrenceMonths: 12,
    createdAt: '2026-01-01T00:00:00.000Z',
    cycleFundedAmount: 0,
    ...overrides,
  }
}

describe('cyclesRemaining', () => {
  it('counts the current cycle, so a goal due this cycle has one left', () => {
    expect(cyclesRemaining(TODAY, new Date(2026, 6, 28), CYCLE_DAY)).toBe(1)
    expect(cyclesRemaining(TODAY, new Date(2026, 7, 5), CYCLE_DAY)).toBe(2)
    expect(cyclesRemaining(TODAY, new Date(2026, 9, 1), CYCLE_DAY)).toBe(4)
  })

  it('goes non-positive once the deadline has passed', () => {
    expect(cyclesRemaining(TODAY, new Date(2026, 5, 10), CYCLE_DAY)).toBe(0)
    expect(cyclesRemaining(TODAY, new Date(2026, 3, 10), CYCLE_DAY)).toBe(-2)
  })
})

describe('computePace', () => {
  it('spreads the remainder over the cycles left, rounding up to the cent', () => {
    // 1200 target, 400 set aside, three cycles to go -> 800/3.
    const pace = computePace(
      newGoal({ targetAmount: 1200, earmarkedAmount: 400, targetDate: '2026-09-20' }),
      TODAY,
      CYCLE_DAY,
      CYCLE_KEY,
    )

    expect(pace.remaining).toBe(800)
    expect(pace.cyclesRemaining).toBe(3)
    expect(pace.requiredPerCycle).toBe(266.67)
    // Rounding up matters: three of these must actually clear the 800.
    expect(pace.requiredPerCycle * 3).toBeGreaterThanOrEqual(pace.remaining)
    expect(pace.isOverdue).toBe(false)
    expect(pace.isFunded).toBe(false)
  })

  it('demands the whole remainder in the deadline cycle', () => {
    const pace = computePace(
      newGoal({ targetAmount: 1000, earmarkedAmount: 250, targetDate: '2026-07-30' }),
      TODAY,
      CYCLE_DAY,
      CYCLE_KEY,
    )

    expect(pace.cyclesRemaining).toBe(1)
    expect(pace.requiredPerCycle).toBe(750)
  })

  it('flags an overdue goal instead of quietly re-spreading it', () => {
    const pace = computePace(
      newGoal({ targetAmount: 500, earmarkedAmount: 100, targetDate: '2026-05-10' }),
      TODAY,
      CYCLE_DAY,
      CYCLE_KEY,
    )

    expect(pace.isOverdue).toBe(true)
    expect(pace.requiredPerCycle).toBe(400)
  })

  it('reports a fully funded goal as needing nothing', () => {
    const pace = computePace(newGoal({ targetAmount: 500, earmarkedAmount: 500 }), TODAY, CYCLE_DAY, CYCLE_KEY)

    expect(pace.isFunded).toBe(true)
    expect(pace.remaining).toBe(0)
    expect(pace.requiredPerCycle).toBe(0)
  })

  it('treats an overshot earmark as funded rather than negative', () => {
    const pace = computePace(newGoal({ targetAmount: 300, earmarkedAmount: 500 }), TODAY, CYCLE_DAY, CYCLE_KEY)

    expect(pace.remaining).toBe(0)
    expect(pace.requiredPerCycle).toBe(0)
  })
})

describe('orderForFunding', () => {
  it('puts priority first, then the nearest deadline', () => {
    const goals = [
      newGoal({ id: 1, targetDate: '2026-08-01', priority: 'Low' }),
      newGoal({ id: 2, targetDate: '2030-01-01', priority: 'High' }),
      newGoal({ id: 3, targetDate: '2026-08-05', priority: 'Medium' }),
      newGoal({ id: 4, targetDate: '2026-08-02', priority: 'Medium' }),
    ]

    // High wins even with a deadline four years out — that is what marking it High is for.
    expect(orderForFunding(goals).map(goal => goal.id)).toEqual([2, 4, 3, 1])
  })

  it('puts a positive local id after persisted ids when every domain field ties', () => {
    const goals = [
      newGoal({ id: 1_785_000_000_000_123 }),
      newGoal({ id: 42 }),
    ]

    expect(orderForFunding(goals).map(goal => goal.id)).toEqual([
      42,
      1_785_000_000_000_123,
    ])
  })

  it('does not mutate the input array', () => {
    const goals = [newGoal({ id: 1, priority: 'Low' }), newGoal({ id: 2, priority: 'High' })]

    orderForFunding(goals)

    expect(goals.map(goal => goal.id)).toEqual([1, 2])
  })
})

describe('outstanding this cycle', () => {
  const paced = (overrides: Partial<SavingsGoal>) =>
    computePace(
      newGoal({ targetAmount: 1200, targetDate: '2026-09-20', ...overrides }),
      TODAY,
      CYCLE_DAY,
      CYCLE_KEY,
    )

  it('ignores a tally left over from an earlier cycle', () => {
    const pace = paced({ earmarkedAmount: 400, cycleFundedKey: '2026-06', cycleFundedAmount: 266.67 })

    expect(pace.fundedThisCycle).toBe(0)
    expect(pace.outstandingThisCycle).toBe(266.67)
  })

  it('is zero once this cycle has been paced, and the pace itself holds still', () => {
    const pace = paced({ earmarkedAmount: 666.67, cycleFundedKey: CYCLE_KEY, cycleFundedAmount: 266.67 })

    expect(pace.outstandingThisCycle).toBe(0)
    // Measured from the cycle's starting position, so funding does not shrink the goal's own
    // requirement out from under it.
    expect(pace.requiredPerCycle).toBe(266.67)
  })

  it('reopens exactly the released amount, not a whole new cycle of pace', () => {
    // Funded 266.67 then released 100, leaving the net 166.67 credited this cycle.
    const pace = paced({ earmarkedAmount: 566.67, cycleFundedKey: CYCLE_KEY, cycleFundedAmount: 166.67 })

    expect(pace.outstandingThisCycle).toBe(100)
  })

  // The waterfall itself is server-side (SavingsGoalService.FundCurrentCycleAsync), so what the
  // client owes is the figure that waterfall reads: a hand-topped-up goal must report zero
  // outstanding, or the funding round would top it up a second time.
  it('counts a manual top-up toward the cycle so funding skips the goal', () => {
    const manual = paced({ earmarkedAmount: 666.67, cycleFundedKey: CYCLE_KEY, cycleFundedAmount: 266.67 })
    const untouched = paced({ id: 2, earmarkedAmount: 400 })

    expect(manual.outstandingThisCycle).toBe(0)
    expect(untouched.outstandingThisCycle).toBe(266.67)
  })

  it('never asks for more than the goal still needs', () => {
    const pace = paced({ targetAmount: 500, earmarkedAmount: 450, targetDate: '2026-07-30' })

    expect(pace.outstandingThisCycle).toBe(50)
  })
})

describe('free Rewards balance', () => {
  it('subtracts active earmarks and pending Rewards bills before a claim', () => {
    const active = newGoal({ earmarkedAmount: 300 })
    const completed = newGoal({ id: 2, earmarkedAmount: 200, status: 'completed' })
    const pendingRewards = {
      status: 'Pending' as const,
      amount: 150,
      ledgerCategory: 'Rewards',
      category: 'Entertainment',
    }
    const paidRewards = { ...pendingRewards, status: 'Paid' as const }
    const pendingEssentials = { ...pendingRewards, ledgerCategory: 'Essentials' }

    expect(pendingRewardsAmount([pendingRewards, paidRewards, pendingEssentials])).toBe(150)
    expect(calculateFreeRewardsBalance(1000, [active, completed], 150)).toBe(550)
  })

  it('clamps the free amount at zero and ignores goals queued out of the pool', () => {
    const pendingDelete = newGoal({ earmarkedAmount: 900, isPendingDelete: true })
    expect(calculateFreeRewardsBalance(100, [pendingDelete], 150)).toBe(0)
  })

  it('keeps an Essentials commitment out of the Rewards claim calculation', () => {
    const rewardsGoal = newGoal({ id: 1, earmarkedAmount: 300, fundingBucket: 'Rewards' })
    const essentialsGoal = newGoal({ id: 2, earmarkedAmount: 400, fundingBucket: 'Essentials' })

    expect(calculateFreeRewardsBalance(1000, [rewardsGoal, essentialsGoal], 0)).toBe(700)
    expect(pendingRecurringAmount([
      { status: 'Pending', amount: 120, ledgerCategory: 'Essentials' },
      { status: 'Pending', amount: 80, ledgerCategory: 'Rewards' },
    ], 'Essentials')).toBe(120)
  })

  // Matched the same way the server matches it. `category` is a ledger category, not a bucket, so
  // reading it as one held money aside that the server left free.
  it('matches a pending bill on its bucket only, case-insensitively', () => {
    const pending = { status: 'Pending' as const, amount: 150 }

    expect(pendingRewardsAmount([{ ...pending, ledgerCategory: 'rewards' }])).toBe(150)
    expect(pendingRewardsAmount([{ ...pending, ledgerCategory: 'Essentials' }])).toBe(0)
    expect(pendingRewardsAmount([{ ...pending, ledgerCategory: '' }])).toBe(0)
  })
})

describe('previewRequiredPerCycle', () => {
  it('quotes the same figure the goal will go on to ask for', () => {
    // 1200 over the three cycles to 20 Sep, i.e. the computePace case above.
    expect(previewRequiredPerCycle(1200, 0, '2026-09-20', TODAY, CYCLE_DAY)).toBe(400)
    // On an edit, money already set aside is part of the answer.
    expect(previewRequiredPerCycle(1200, 400, '2026-09-20', TODAY, CYCLE_DAY)).toBe(266.67)
  })

  it('has nothing to say about an unfinished form', () => {
    expect(previewRequiredPerCycle(Number.NaN, 0, '2026-09-20', TODAY, CYCLE_DAY)).toBe(0)
    expect(previewRequiredPerCycle(1200, 0, '', TODAY, CYCLE_DAY)).toBe(0)
  })
})

describe('summarizePool', () => {
  it('splits one balance into what goals claim and what is free', () => {
    const goals = [
      newGoal({ id: 1, name: 'Car service', targetAmount: 1200, earmarkedAmount: 400, targetDate: '2026-09-20' }),
      newGoal({ id: 2, name: 'House deposit', targetAmount: 60000, earmarkedAmount: 2000, targetDate: '2032-07-01' }),
    ]

    const summary = summarizePool(goals, 3000, 800, TODAY, CYCLE_DAY)

    expect(summary.totalEarmarked).toBe(2400)
    // This — not the 3000 — is what a wishlist reward can actually be claimed against.
    expect(summary.unassigned).toBe(600)
    expect(summary.requiredPerCycleTotal).toBe(1061.2)
    // Nothing set aside this cycle yet, so the whole requirement is still outstanding.
    expect(summary.outstandingThisCycleTotal).toBe(1061.2)
    expect(summary.hasUnfinishedGoals).toBe(true)
    // 800/cycle falls 261.20 short of the 1061.20 requirement, but 600 is already sitting free —
    // enough to close the gap, so nothing here is out of reach and no warning is owed.
    expect(summary.paceShortfall).toBe(0)
    expect(summary.activeGoals.map(goal => goal.id)).toEqual([1, 2])
    expect(summary.paces.get(1)?.requiredPerCycle).toBe(266.67)
  })

  it('reports nothing outstanding once every goal has had its share this cycle', () => {
    const goals = [
      newGoal({
        id: 1,
        targetAmount: 1200,
        earmarkedAmount: 666.67,
        targetDate: '2026-09-20',
        cycleFundedKey: CYCLE_KEY,
        cycleFundedAmount: 266.67,
      }),
    ]

    const summary = summarizePool(goals, 3000, 800, TODAY, CYCLE_DAY)

    expect(summary.outstandingThisCycleTotal).toBe(0)
    // Still an unfinished goal overall — it just does not need anything more this cycle.
    expect(summary.hasUnfinishedGoals).toBe(true)
    expect(summary.requiredPerCycleTotal).toBe(266.67)
  })

  it('reports no unfinished goals once everything is fully funded', () => {
    const goals = [newGoal({ id: 1, targetAmount: 500, earmarkedAmount: 500 })]

    const summary = summarizePool(goals, 3000, 800, TODAY, CYCLE_DAY)

    expect(summary.hasUnfinishedGoals).toBe(false)
    expect(summary.outstandingThisCycleTotal).toBe(0)
  })

  it('reports no shortfall when the inflow covers every commitment', () => {
    const goals = [newGoal({ id: 1, targetAmount: 1200, earmarkedAmount: 400, targetDate: '2026-09-20' })]

    const summary = summarizePool(goals, 3000, 800, TODAY, CYCLE_DAY)

    expect(summary.paceShortfall).toBe(0)
  })

  it('warns only when the inflow AND the free balance together fall short', () => {
    // 800 needed this cycle, 100 of inflow, and the pool holds nothing free once the earmark is out.
    const goals = [newGoal({ id: 1, targetAmount: 1000, earmarkedAmount: 200, targetDate: '2026-07-30' })]

    const summary = summarizePool(goals, 200, 100, TODAY, CYCLE_DAY)

    expect(summary.unassigned).toBe(0)
    expect(summary.requiredPerCycleTotal).toBe(800)
    expect(summary.paceShortfall).toBe(700)
  })

  it('excludes completed goals and rows pending deletion from the claim on the pool', () => {
    const goals = [
      newGoal({ id: 1, targetAmount: 500, earmarkedAmount: 500, status: 'completed' }),
      newGoal({ id: 2, targetAmount: 500, earmarkedAmount: 300, isPendingDelete: true }),
      newGoal({ id: 3, targetAmount: 500, earmarkedAmount: 100 }),
    ]

    const summary = summarizePool(goals, 1000, 400, TODAY, CYCLE_DAY)

    // A goal queued for deletion has already released its claim optimistically.
    expect(summary.totalEarmarked).toBe(100)
    expect(summary.unassigned).toBe(900)
    expect(summary.activeGoals.map(goal => goal.id)).toEqual([3])
  })

  it('does not leave a float remainder when earmarks exactly consume the pool', () => {
    const goals = [
      newGoal({ id: 1, targetAmount: 100, earmarkedAmount: 0.1 }),
      newGoal({ id: 2, targetAmount: 100, earmarkedAmount: 0.2 }),
    ]

    const summary = summarizePool(goals, 0.3, 0, TODAY, CYCLE_DAY)

    expect(summary.totalEarmarked).toBe(0.3)
    expect(summary.unassigned).toBe(0)
  })

  it('keeps pending Rewards subscriptions out of the pool and free remainder', () => {
    const summary = summarizePool(
      [newGoal({ earmarkedAmount: 300 })],
      1000,
      0,
      TODAY,
      CYCLE_DAY,
      150,
    )

    expect(summary.rewardsBalance).toBe(850)
    expect(summary.unassigned).toBe(550)
  })

  it('summarizes only the selected funding bucket', () => {
    const summary = summarizePool(
      [
        newGoal({ id: 1, earmarkedAmount: 300, fundingBucket: 'Rewards' }),
        newGoal({ id: 2, earmarkedAmount: 400, fundingBucket: 'Essentials' }),
      ],
      1000,
      0,
      TODAY,
      CYCLE_DAY,
      0,
      'Essentials',
    )

    expect(summary.fundingBucket).toBe('Essentials')
    expect(summary.totalEarmarked).toBe(400)
    expect(summary.unassigned).toBe(600)
    expect(summary.activeGoals.map(goal => goal.id)).toEqual([2])
  })
})

describe('getPaceStatus', () => {
  it('distinguishes funded, overdue, behind and on-pace', () => {
    const funded = computePace(newGoal({ targetAmount: 500, earmarkedAmount: 500 }), TODAY, CYCLE_DAY, CYCLE_KEY)
    const overdue = computePace(newGoal({ targetAmount: 500, targetDate: '2026-05-01' }), TODAY, CYCLE_DAY, CYCLE_KEY)
    const paced = computePace(
      newGoal({ targetAmount: 1200, earmarkedAmount: 400, targetDate: '2026-09-20' }),
      TODAY,
      CYCLE_DAY,
      CYCLE_KEY,
    )

    expect(getPaceStatus(funded)).toBe('funded')
    expect(getPaceStatus(overdue)).toBe('overdue')
    // Nothing set aside this cycle yet.
    expect(getPaceStatus(paced)).toBe('needsFunding')

    // Once this cycle's share is in, the goal reads as on pace — and only then. Previously this was
    // inferred from the budget, so a goal at 0% could claim to be on pace.
    const settled = computePace(
      newGoal({
        targetAmount: 1200,
        earmarkedAmount: 666.67,
        targetDate: '2026-09-20',
        cycleFundedKey: CYCLE_KEY,
        cycleFundedAmount: 266.67,
      }),
      TODAY,
      CYCLE_DAY,
      CYCLE_KEY,
    )
    expect(getPaceStatus(settled)).toBe('onPace')
  })
})
