import { describe, expect, it } from 'vitest'
import {
  FORECAST_MAX_YEARS,
  buildForecastModel,
  calculateForecast,
  contributionsInTodayMoney,
  generateForecastCoefficients,
  inflationFactor,
  medianCompoundValue,
  niceCeiling,
  selectKth,
  toTodayMoney,
  type ForecastCoefficients,
  type ForecastModel,
} from './investmentForecast'

const model = (annualReturn = 0, annualVolatility = 0): ForecastModel => ({
  annualReturn,
  annualVolatility,
  weights: { USEquity: 0.66, InternationalExUS: 0.1, Bonds: 0.24 },
  assumptionId: 'test',
})

describe('investment forecast model', () => {
  it('weights the researched return and conservative volatility by the investment plan', () => {
    const result = buildForecastModel({
      usEquityTarget: 66,
      internationalExUsTarget: 10,
      bondsTarget: 24,
      watchDrift: 3,
      alertDrift: 5,
    })

    expect(result.annualReturn).toBeCloseTo(0.05134, 8)
    expect(result.annualVolatility).toBeCloseTo(0.13254, 8)
  })

  it('changes when plan weights change and normalizes imperfect totals', () => {
    const allBonds = buildForecastModel({
      usEquityTarget: 0,
      internationalExUsTarget: 0,
      bondsTarget: 50,
      watchDrift: 3,
      alertDrift: 5,
    })
    expect(allBonds.annualReturn).toBeCloseTo(0.048)
    expect(allBonds.annualVolatility).toBeCloseTo(0.062)
  })

  it('generates deterministic annual coefficients and retains no monthly matrix', () => {
    const first = generateForecastCoefficients(model(0.05, 0.12), 8, FORECAST_MAX_YEARS, 42)
    const second = generateForecastCoefficients(model(0.05, 0.12), 8, FORECAST_MAX_YEARS, 42)

    expect([...first.growth]).toEqual([...second.growth])
    expect([...first.contribution]).toEqual([...second.contribution])
    expect(first.growth).toHaveLength(8 * FORECAST_MAX_YEARS)
    expect(first.contribution).toHaveLength(8 * FORECAST_MAX_YEARS)
  })

  it('keeps the simulated arithmetic mean aligned with the published return assumption', () => {
    const coefficients = generateForecastCoefficients(model(0.05, 0.2), 20_000, 1, 42)
    const mean = [...coefficients.growth].reduce((sum, value) => sum + value, 0) / coefficients.paths

    expect(mean).toBeCloseTo(1.05, 2)
  })

  it('compounds the existing value and adds deposits at each month end', () => {
    const coefficients = generateForecastCoefficients(model(0.12), 1, 1, 1)
    const result = calculateForecast(coefficients, 1_000, 100, 1, 3_000)

    expect(result.ending.median).toBeCloseTo(medianCompoundValue(1_000, 100, 1, 0.12), 8)
    expect(result.futureContributions).toBe(1_200)
    expect(result.points[0].median).toBe(1_000)
  })

  it('keeps the existing amount fixed when the future contribution changes', () => {
    const coefficients = generateForecastCoefficients(model(0.05, 0.1), 20, 5, 7)
    const without = calculateForecast(coefficients, 2_500, 0, 5, 10_000)
    const withDeposits = calculateForecast(coefficients, 2_500, 500, 5, 10_000)

    expect(without.points[0]).toEqual({ year: 0, lower: 2_500, median: 2_500, upper: 2_500 })
    expect(withDeposits.points[0]).toEqual(without.points[0])
    expect(withDeposits.ending.median).toBeGreaterThan(without.ending.median)
  })

  it('backtracks the median monthly contribution required for a target', () => {
    const coefficients = generateForecastCoefficients(model(), 9, 10, 9)
    const result = calculateForecast(coefficients, 1_000, 0, 10, 2_200)

    expect(result.requiredMonthlyContribution).toBeCloseTo(10, 8)
    expect(result.targetChance).toBe(0)
    const atTarget = calculateForecast(coefficients, 1_000, 10, 10, 2_200)
    expect(atTarget.targetChance).toBe(1)
  })

  it('handles a loss path, zero requirement, and a very large target', () => {
    const coefficients: ForecastCoefficients = {
      paths: 3,
      years: 1,
      growth: new Float64Array([0.5, 1, 1.5]),
      contribution: new Float64Array([10, 12, 14]),
    }
    const loss = calculateForecast(coefficients, 1_000, 0, 1, 500)
    expect(loss.estimatedGrowth).toBe(0)
    expect(loss.requiredMonthlyContribution).toBe(0)

    const large = calculateForecast(coefficients, 1_000, 0, 1, 1e12)
    expect(Number.isFinite(large.requiredMonthlyContribution)).toBe(true)
    expect(large.requiredMonthlyContribution).toBeGreaterThan(0)
  })

  it('converts future values to today money without changing year zero', () => {
    expect(inflationFactor(0.02, 10)).toBeGreaterThan(1)
    expect(toTodayMoney(1_000, 0.02, 0)).toBe(1_000)
    expect(toTodayMoney(1_000, 0.02, 10)).toBeLessThan(1_000)
    expect(contributionsInTodayMoney(100, 0, 1)).toBe(1_200)
    expect(contributionsInTodayMoney(100, 0.12, 1)).toBeLessThan(1_200)
    expect(contributionsInTodayMoney(100, 0.12, 1)).toBeGreaterThan(1_100)
  })

  it('selects percentiles and rounded slider ceilings without sorting inputs first', () => {
    const values = new Float64Array([9, 1, 7, 3, 5])
    expect(selectKth(values, 2)).toBe(5)
    expect(niceCeiling(8_333)).toBe(10_000)
  })
})
