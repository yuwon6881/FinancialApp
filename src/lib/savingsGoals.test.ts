import { describe, expect, it } from 'vitest'
import type { SavingsGoal } from '../types'
import {
  computePace,
  cyclesRemaining,
  cyclesToFund,
  distribute,
  getPaceStatus,
  orderForFunding,
  summarizePool,
  unassigned,
} from './savingsGoals'

// cycleDay 1 keeps cycles aligned to calendar months so the expectations read plainly. The
// numbers below deliberately match SavingsGoalPacingTests.cs case for case — if one side changes,
// the other has to change with it or the UI will show a pace the server does not fund.
const CYCLE_DAY = 1
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
    )

    expect(pace.cyclesRemaining).toBe(1)
    expect(pace.requiredPerCycle).toBe(750)
  })

  it('flags an overdue goal instead of quietly re-spreading it', () => {
    const pace = computePace(
      newGoal({ targetAmount: 500, earmarkedAmount: 100, targetDate: '2026-05-10' }),
      TODAY,
      CYCLE_DAY,
    )

    expect(pace.isOverdue).toBe(true)
    expect(pace.requiredPerCycle).toBe(400)
  })

  it('reports a fully funded goal as needing nothing', () => {
    const pace = computePace(newGoal({ targetAmount: 500, earmarkedAmount: 500 }), TODAY, CYCLE_DAY)

    expect(pace.isFunded).toBe(true)
    expect(pace.remaining).toBe(0)
    expect(pace.requiredPerCycle).toBe(0)
  })

  it('treats an overshot earmark as funded rather than negative', () => {
    const pace = computePace(newGoal({ targetAmount: 300, earmarkedAmount: 500 }), TODAY, CYCLE_DAY)

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

  it('does not mutate the input array', () => {
    const goals = [newGoal({ id: 1, priority: 'Low' }), newGoal({ id: 2, priority: 'High' })]

    orderForFunding(goals)

    expect(goals.map(goal => goal.id)).toEqual([1, 2])
  })
})

describe('distribute', () => {
  it('caps each goal at its own pace and leaves the rest free to spend', () => {
    const car = newGoal({ id: 1, targetAmount: 1200, earmarkedAmount: 400, targetDate: '2026-09-20' })
    const house = newGoal({ id: 2, targetAmount: 60000, earmarkedAmount: 2000, targetDate: '2032-07-01' })

    const result = distribute([car, house], 1200, TODAY, CYCLE_DAY)

    // 800 over 3 cycles, and 58000 over 73 cycles.
    expect(result.grants.find(grant => grant.goalId === 1)?.amount).toBe(266.67)
    expect(result.grants.find(grant => grant.goalId === 2)?.amount).toBe(794.53)
    expect(result.totalGranted).toBe(1061.2)
    expect(result.freeToSpend).toBe(138.8)
    expect(result.shortfall).toBe(0)
  })

  it('reports a shortfall when the goals want more than the cycle has', () => {
    const car = newGoal({ id: 1, targetAmount: 1200, earmarkedAmount: 400, targetDate: '2026-09-20' })
    const house = newGoal({ id: 2, targetAmount: 60000, earmarkedAmount: 2000, targetDate: '2032-07-01' })

    const result = distribute([car, house], 800, TODAY, CYCLE_DAY)

    expect(result.totalGranted).toBe(800)
    expect(result.freeToSpend).toBe(0)
    expect(result.shortfall).toBeGreaterThan(0)
    // The nearer, equally-prioritised deadline was covered; the long-horizon fund absorbed the gap.
    expect(result.grants.find(grant => grant.goalId === 1)?.shortfall).toBe(0)
    expect(result.grants.find(grant => grant.goalId === 2)?.shortfall).toBeGreaterThan(0)
  })

  it('never grants past the target', () => {
    // Due this cycle and 50 short, with far more available than it needs.
    const goal = newGoal({ id: 1, targetAmount: 500, earmarkedAmount: 450, targetDate: '2026-07-30' })

    const result = distribute([goal], 5000, TODAY, CYCLE_DAY)

    expect(result.totalGranted).toBe(50)
    expect(result.freeToSpend).toBe(4950)
  })

  it('handles an empty pool and no goals', () => {
    const broke = distribute([newGoal({ targetAmount: 500 })], 0, TODAY, CYCLE_DAY)
    expect(broke.totalGranted).toBe(0)
    expect(broke.shortfall).toBeGreaterThan(0)

    const noGoals = distribute([], 250, TODAY, CYCLE_DAY)
    expect(noGoals.grants).toEqual([])
    expect(noGoals.freeToSpend).toBe(250)
    expect(noGoals.shortfall).toBe(0)
  })

  it('clamps a negative available amount to zero', () => {
    // A Rewards balance below the outstanding earmarks must not read as money available.
    const result = distribute([newGoal({ targetAmount: 500 })], -300, TODAY, CYCLE_DAY)

    expect(result.totalGranted).toBe(0)
    expect(result.freeToSpend).toBe(0)
  })
})

describe('unassigned', () => {
  it('floors at zero when earmarks exceed the balance', () => {
    expect(unassigned(3000, 2400)).toBe(600)
    expect(unassigned(1000, 2400)).toBe(0)
    expect(unassigned(-50, 0)).toBe(0)
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
    // 800/cycle cannot cover 1061.20 of commitments, so at least one deadline is unreachable.
    expect(summary.paceShortfall).toBe(261.2)
    expect(summary.activeGoals.map(goal => goal.id)).toEqual([1, 2])
    expect(summary.paces.get(1)?.requiredPerCycle).toBe(266.67)
  })

  it('reports no shortfall when the inflow covers every commitment', () => {
    const goals = [newGoal({ id: 1, targetAmount: 1200, earmarkedAmount: 400, targetDate: '2026-09-20' })]

    const summary = summarizePool(goals, 3000, 800, TODAY, CYCLE_DAY)

    expect(summary.paceShortfall).toBe(0)
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
})

describe('getPaceStatus', () => {
  it('distinguishes funded, overdue, behind and on-pace', () => {
    const funded = computePace(newGoal({ targetAmount: 500, earmarkedAmount: 500 }), TODAY, CYCLE_DAY)
    const overdue = computePace(newGoal({ targetAmount: 500, targetDate: '2026-05-01' }), TODAY, CYCLE_DAY)
    const paced = computePace(
      newGoal({ targetAmount: 1200, earmarkedAmount: 400, targetDate: '2026-09-20' }),
      TODAY,
      CYCLE_DAY,
    )

    expect(getPaceStatus(funded, 0)).toBe('funded')
    expect(getPaceStatus(overdue, 0)).toBe('overdue')
    expect(getPaceStatus(paced, 100)).toBe('behind')
    expect(getPaceStatus(paced, 266.67)).toBe('onPace')
  })
})

describe('cyclesToFund', () => {
  it('returns the cycles needed at a given rate, or null when the rate cannot get there', () => {
    const pace = computePace(
      newGoal({ targetAmount: 1200, earmarkedAmount: 400, targetDate: '2026-09-20' }),
      TODAY,
      CYCLE_DAY,
    )

    expect(cyclesToFund(pace, 400)).toBe(2)
    expect(cyclesToFund(pace, 0)).toBeNull()
    expect(cyclesToFund(pace, -10)).toBeNull()

    const funded = computePace(newGoal({ targetAmount: 500, earmarkedAmount: 500 }), TODAY, CYCLE_DAY)
    expect(cyclesToFund(funded, 0)).toBe(0)
  })
})
