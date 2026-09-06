import { describe, expect, it } from 'vitest'
import {
  evaluateEssentialsChallenge,
  isOverBudgetTier,
  isUnrankedTier,
  type EssentialsChallengeInput,
} from './essentialsChallenge'

const activeCycle = { phase: 'active' as const, dayNumber: 15, totalDays: 30, daysLeft: 16 }

/** A funded cycle projected to finish exactly on its budget. */
const onPlan: EssentialsChallengeInput = {
  totalAvailable: 2000,
  projectedRemaining: 1000,
  projectedEndingBalance: 0,
  currentDailyPace: 40,
  unpaidRecurringCount: 0,
  exceededCategoryLimits: 0,
  cycle: activeCycle,
}

const withRemaining = (projectedRemaining: number, overrides: Partial<EssentialsChallengeInput> = {}) =>
  evaluateEssentialsChallenge({ ...onPlan, projectedRemaining, ...overrides })

describe('evaluateEssentialsChallenge tiers', () => {
  it('ranks a cycle projected to finish exactly on its budget as on plan', () => {
    const result = evaluateEssentialsChallenge(onPlan)
    expect(result.tier).toBe('on-track')
    expect(result.projectedUsage).toBeCloseTo(1, 10)
    expect(result.drift).toBeCloseTo(0, 10)
    expect(result.score).toBe(70)
  })

  it('ranks money that is outlasting the clock by a wide margin as far ahead', () => {
    // 40% of the budget used by cycle end projects to $1,200 ending balance.
    const result = withRemaining(1600, { projectedEndingBalance: 1200 })
    expect(result.tier).toBe('far-ahead')
    expect(result.projectedUsage).toBeCloseTo(0.4, 10)
    expect(result.paceGap).toBeCloseTo(1200, 10)
    expect(result.score).toBe(100)
  })

  it('separates comfortably ahead from far ahead', () => {
    // 90% of the budget used by cycle end projects to $200 ending balance.
    const result = withRemaining(1100, { projectedEndingBalance: 200 })
    expect(result.tier).toBe('ahead')
    expect(result.score).toBe(90)
  })

  it('ranks spending that outruns the clock but still fits as cutting it fine', () => {
    // Spending pace outruns the daily allowance, but projection still lands above zero.
    const result = withRemaining(600, { currentDailyPace: 80, projectedEndingBalance: 40 })
    expect(result.tier).toBe('near-limit')
    expect(result.projectedUsage).toBeCloseTo(0.98, 10)
    expect(result.score).toBe(74)
  })

  it('can rank the opening days of a cycle, which a plain clock comparison cannot', () => {
    const dayTwo = { phase: 'active' as const, dayNumber: 2, totalDays: 30, daysLeft: 29 }
    // Nothing committed yet.
    const untouched = evaluateEssentialsChallenge({ ...onPlan, projectedRemaining: 2000, projectedEndingBalance: 2000, cycle: dayTwo })
    expect(untouched.tier).toBe('far-ahead')
    expect(untouched.score).toBe(100)

    // An ordinary early spend with strong forecast buffer.
    const ordinaryDay = evaluateEssentialsChallenge({ ...onPlan, projectedRemaining: 1840, projectedEndingBalance: 400, cycle: dayTwo })
    expect(ordinaryDay.projectedUsage).toBeCloseTo(0.8, 10)
    expect(ordinaryDay.tier).toBe('far-ahead')

    // Spending faster than allowance early on.
    const heavyDay = evaluateEssentialsChallenge({ ...onPlan, projectedRemaining: 1400, currentDailyPace: 100, projectedEndingBalance: 40, cycle: dayTwo })
    expect(heavyDay.tier).toBe('near-limit')
  })

  it('ranks a bucket that still has money but is projected to close short as heading over', () => {
    const result = withRemaining(600, { projectedEndingBalance: -120 })
    expect(result.tier).toBe('off-track')
  })

  it('separates over by a little from over by a lot at a tenth of the budget', () => {
    const little = withRemaining(-150, { projectedEndingBalance: -150 })
    const lot = withRemaining(-260, { projectedEndingBalance: -260 })
    expect(little.tier).toBe('over-a-little')
    expect(lot.tier).toBe('over-a-lot')
    expect(little.overspend).toBe(150)
    expect(lot.overspend).toBe(260)
  })

  it('keeps every in-budget score above every over-budget score', () => {
    // The worst in-budget case: projected heavy shortfall at cycle close.
    const worstInBudget = evaluateEssentialsChallenge({
      ...onPlan,
      projectedRemaining: 20,
      projectedEndingBalance: -500,
      cycle: { phase: 'active', dayNumber: 1, totalDays: 30, daysLeft: 30 },
    })
    const mildestOver = withRemaining(-1, { projectedEndingBalance: -1 })
    expect(worstInBudget.score).toBe(41)
    expect(mildestOver.score).toBe(40)
    expect(isOverBudgetTier(mildestOver.tier)).toBe(true)
    expect(isOverBudgetTier(worstInBudget.tier)).toBe(false)
  })

  it('floors the score at zero however far past the budget the bucket runs', () => {
    const result = withRemaining(-5000, { projectedEndingBalance: -5000 })
    expect(result.score).toBe(0)
    expect(result.tier).toBe('over-a-lot')
  })
})

describe('evaluateEssentialsChallenge states without a rank', () => {
  it('reports an unfunded cycle rather than scoring a budget of zero', () => {
    const result = evaluateEssentialsChallenge({
      ...onPlan,
      totalAvailable: 0,
      projectedRemaining: 0,
      projectedEndingBalance: 0,
    })
    expect(result.tier).toBe('unfunded')
    expect(result.score).toBeNull()
    expect(isUnrankedTier(result.tier)).toBe(true)
    expect(result.paceGap).toBe(0)
  })

  it('reports a cycle that has not begun rather than crediting a full budget as ahead', () => {
    const result = evaluateEssentialsChallenge({
      ...onPlan,
      projectedRemaining: 2000,
      cycle: { phase: 'upcoming', dayNumber: 0, totalDays: 30, daysLeft: 30 },
    })
    expect(result.tier).toBe('not-started')
    expect(result.score).toBeNull()
  })

  it('scores an ended cycle against its whole length, where the projection is the outcome', () => {
    const result = evaluateEssentialsChallenge({
      ...onPlan,
      projectedRemaining: 300,
      projectedEndingBalance: 300,
      cycle: { phase: 'ended', dayNumber: 30, totalDays: 30, daysLeft: 0 },
    })
    expect(result.paceRatio).toBe(1)
    expect(result.projectedUsage).toBeCloseTo(result.usedRatio, 10)
    expect(result.tier).toBe('ahead')
    expect(result.spendDays).toBe(1)
  })
})

describe('evaluateEssentialsChallenge daily figures', () => {
  it('spreads the remaining money across the days that are left', () => {
    const result = withRemaining(800, { currentDailyPace: 25 })
    expect(result.spendDays).toBe(16)
    expect(result.dailyAllowance).toBe(50)
    expect(result.paceDifference).toBeCloseTo(-0.5, 10)
  })

  it('treats any spending as fully over pace once no allowance is left', () => {
    const result = withRemaining(-100, { currentDailyPace: 25, projectedEndingBalance: -100 })
    expect(result.dailyAllowance).toBe(0)
    expect(result.paceDifference).toBe(1)
  })

  it('reports no overshoot when nothing is left and nothing is being spent', () => {
    const result = withRemaining(0, { currentDailyPace: 0, projectedEndingBalance: 0 })
    expect(result.paceDifference).toBe(0)
    expect(result.overspend).toBe(0)
  })
})

describe('evaluateEssentialsChallenge badges', () => {
  it('awards every badge for a clean, ahead-of-pace cycle', () => {
    const result = withRemaining(1600, { projectedEndingBalance: 1200 })
    expect(result.earnedBadgeCount).toBe(4)
    expect(result.badges.every(badge => badge.earned)).toBe(true)
  })

  it('withholds the badges each condition owns', () => {
    const result = withRemaining(600, {
      projectedEndingBalance: -10,
      unpaidRecurringCount: 2,
      exceededCategoryLimits: 1,
    })
    const earned = Object.fromEntries(result.badges.map(badge => [badge.id, badge.earned]))
    expect(earned).toEqual({
      'under-pace': false,
      'buffer-held': false,
      'bills-clear': false,
      'limits-clean': false,
    })
    expect(result.earnedBadgeCount).toBe(0)
  })

  it('never awards a pace badge to an unfunded cycle', () => {
    const result = evaluateEssentialsChallenge({
      ...onPlan,
      totalAvailable: 0,
      projectedRemaining: 0,
      projectedEndingBalance: 0,
    })
    const earned = Object.fromEntries(result.badges.map(badge => [badge.id, badge.earned]))
    expect(earned['under-pace']).toBe(false)
    expect(earned['buffer-held']).toBe(false)
  })
})
