import { describe, expect, it } from 'vitest'
import { resolveInvestmentTotalValue } from './investmentTotalValue'

describe('resolveInvestmentTotalValue', () => {
  it('prefers the cached portfolio total the investments page wrote', () => {
    expect(resolveInvestmentTotalValue(51_371.15, { investedValue: 1, availableCash: 2 })).toBe(51_371.15)
    expect(resolveInvestmentTotalValue(0, { investedValue: 1, availableCash: 2 })).toBe(0)
  })

  it('adds the allocation overview parts when the portfolio has not been loaded', () => {
    expect(resolveInvestmentTotalValue(undefined, { investedValue: 105_848.2, availableCash: 2_450.75 }))
      .toBeCloseTo(108_298.95, 2)
  })

  it('leaves the total absent rather than counting an unvalued part as nothing', () => {
    expect(resolveInvestmentTotalValue(undefined, { investedValue: null, availableCash: 2_450.75 })).toBeUndefined()
    expect(resolveInvestmentTotalValue(undefined, { investedValue: 105_848.2, availableCash: null })).toBeUndefined()
    expect(resolveInvestmentTotalValue(undefined, {})).toBeUndefined()
    expect(resolveInvestmentTotalValue(null, null)).toBeUndefined()
  })
})
