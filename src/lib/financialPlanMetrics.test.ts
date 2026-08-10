import { describe, expect, it } from 'vitest'
import type { CategorySummary } from '../types'
import { calculateEssentialsMetric, calculateGrowthMetric, calculateStabilityMetric } from './financialPlanMetrics'

const category = (overrides: Partial<CategorySummary>): CategorySummary => ({
  name: 'Growth', allocation: .2, target: 100, incomeAllocated: 100,
  budget: 0, netChange: 0, remaining: 0, ...overrides,
})

describe('financial plan metrics', () => {
  it('calculates Growth current and projected percentages before clamping each', () => {
    const result = calculateGrowthMetric(category({ netChange: 150, remaining: 150 }), 25)
    expect(result.currentPct).toBe(1)
    expect(result.safePct).toBe(1)
    expect(result.projectedRemaining).toBe(125)
  })

  it('keeps projected deficits signed', () => {
    expect(calculateGrowthMetric(category({ remaining: 10 }), 25).projectedRemaining).toBe(-15)
    expect(calculateStabilityMetric(category({ remaining: 10 }), 100, 25).projectedBalance).toBe(-15)
  })

  it('uses opening balance plus actual income added for Essentials', () => {
    const result = calculateEssentialsMetric(category({ budget: 50, target: 100, incomeAllocated: 40, remaining: 45 }), 60)
    expect(result.totalAvailable).toBe(90)
    expect(result.currentPct).toBe(.5)
    expect(result.projectedRemaining).toBe(-15)
    expect(result.projectedPct).toBe(0)
  })
})
