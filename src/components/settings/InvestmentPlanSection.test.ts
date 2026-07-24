import { describe, expect, it } from 'vitest'
import { redistributeInvestmentTargets } from '../../lib/investmentAllocation'

describe('redistributeInvestmentTargets', () => {
  it('keeps all sleeves positive and the total at 100', () => {
    const result = redistributeInvestmentTargets({
      usEquityTarget: 66,
      internationalExUsTarget: 10,
      bondsTarget: 24,
    }, 'usEquityTarget', 75)

    expect(result).toEqual({
      usEquityTarget: 75,
      internationalExUsTarget: 7,
      bondsTarget: 18,
    })
    expect(Object.values(result).reduce((sum, value) => sum + value, 0)).toBe(100)
  })

  it('clamps extreme target changes so the other sleeves remain assignable', () => {
    const result = redistributeInvestmentTargets({
      usEquityTarget: 66,
      internationalExUsTarget: 10,
      bondsTarget: 24,
    }, 'bondsTarget', 100)

    expect(result.bondsTarget).toBe(98)
    expect(result.usEquityTarget).toBe(1)
    expect(result.internationalExUsTarget).toBe(1)
  })
})
