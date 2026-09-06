import { describe, expect, it } from 'vitest'
import { evaluateEssentialsChallenge, type EssentialsChallengeInput } from './essentialsChallenge'

const input: EssentialsChallengeInput = {
  totalAvailable: 2000,
  projectedRemaining: 600,
  projectedEndingBalance: 200,
  currentDailyPace: 20,
  unpaidRecurringCount: 1,
  exceededCategoryLimits: 0,
  cycle: { phase: 'active', dayNumber: 10, totalDays: 30, daysLeft: 21 },
}

describe('Essentials challenge forecast consistency', () => {
  it('does not extrapolate committed monthly bills as repeating daily spending', () => {
    const result = evaluateEssentialsChallenge(input)
    expect(result.projectedUsage).toBeCloseTo(0.9)
    expect(result.tier).toBe('ahead')
    expect(result.score).toBe(90)
    expect(result.badges.find(badge => badge.id === 'under-pace')?.earned).toBe(true)
  })

  it('cannot award a perfect score alongside a forecast shortfall', () => {
    const result = evaluateEssentialsChallenge({ ...input, projectedRemaining: 1900, projectedEndingBalance: -200 })
    expect(result.tier).toBe('off-track')
    expect(result.score).toBeLessThan(70)
  })

  it('uses the final server balance after a cycle ends, without reserving pending bills again', () => {
    const result = evaluateEssentialsChallenge({ ...input, projectedRemaining: -50,
      cycle: { phase: 'ended', dayNumber: 30, totalDays: 30, daysLeft: 0 } })
    expect(result.tier).toBe('ahead')
    expect(result.overspend).toBe(0)
    expect(result.projectedRemaining).toBe(200)
  })

  it('does not award achievements before the cycle starts', () => {
    const result = evaluateEssentialsChallenge({ ...input, unpaidRecurringCount: 0,
      cycle: { phase: 'upcoming', dayNumber: 0, totalDays: 30, daysLeft: 30 } })
    expect(result.earnedBadgeCount).toBe(0)
  })
})
