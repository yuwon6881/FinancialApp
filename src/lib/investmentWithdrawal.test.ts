import { describe, expect, it } from 'vitest'
import { planWithdrawal, type WithdrawalSleeveInput } from './investmentWithdrawal'

// A balanced 60/30/10 portfolio worth 10,000.
const balanced: WithdrawalSleeveInput[] = [
  { sleeve: 'USEquity', label: 'US shares', targetPercentage: 60, value: 6000, unrealisedProfitLoss: 600 },
  { sleeve: 'InternationalExUS', label: 'Shares outside the US', targetPercentage: 30, value: 3000, unrealisedProfitLoss: -150 },
  { sleeve: 'Bonds', label: 'Bonds', targetPercentage: 10, value: 1000, unrealisedProfitLoss: 20 },
]

const amounts = (sleeves: { amount: number }[]) => sleeves.map(sleeve => sleeve.amount)

describe('planWithdrawal', () => {
  it('returns nothing for a zero or negative request', () => {
    expect(planWithdrawal(0, 500, balanced)).toBeNull()
    expect(planWithdrawal(-100, 500, balanced)).toBeNull()
  })

  it('spends uninvested broker cash before selling anything', () => {
    const plan = planWithdrawal(400, 1000, balanced)!
    expect(plan.fromCash).toBe(400)
    expect(plan.fromHoldings).toBe(0)
    expect(amounts(plan.sleeves)).toEqual([0, 0, 0])
  })

  it('sells only the part cash cannot cover', () => {
    const plan = planWithdrawal(1500, 500, balanced)!
    expect(plan.fromCash).toBe(500)
    expect(plan.fromHoldings).toBe(1000)
  })

  it('splits a withdrawal from a balanced portfolio by target weight', () => {
    const plan = planWithdrawal(1000, 0, balanced)!
    // Every basket is exactly on target, so each gives up its target share.
    expect(amounts(plan.sleeves)).toEqual([600, 300, 100])
    plan.sleeves.forEach(sleeve => expect(sleeve.projectedDriftPercentagePoints).toBe(0))
    expect(plan.worstProjectedDrift).toBe(0)
    expect(plan.projectedTotal).toBe(9000)
  })

  it('takes from whichever basket is overweight, rebalancing on the way out', () => {
    // US equity has run up to 7,000 of a 10,000 portfolio against a 60% target.
    const drifted: WithdrawalSleeveInput[] = [
      { ...balanced[0], value: 7000 },
      { ...balanced[1], value: 2000 },
      { ...balanced[2], value: 1000 },
    ]
    const plan = planWithdrawal(1000, 0, drifted)!

    // Post-withdrawal target values on 9,000 are 5,400 / 2,700 / 900. Only US equity
    // and Bonds are above those, so the whole sale comes from them.
    expect(plan.sleeves[1].amount).toBe(0)
    expect(plan.sleeves[0].amount).toBeGreaterThan(plan.sleeves[2].amount)
    expect(plan.sleeves[0].amount + plan.sleeves[2].amount).toBe(1000)
    // The overweight basket ends up closer to target than it started (+10.0 points).
    expect(Math.abs(plan.sleeves[0].projectedDriftPercentagePoints)).toBeLessThan(10)
  })

  it('never asks a basket for more than it holds', () => {
    const lopsided: WithdrawalSleeveInput[] = [
      { ...balanced[0], value: 9800 },
      { ...balanced[1], value: 100 },
      { ...balanced[2], value: 100 },
    ]
    const plan = planWithdrawal(5000, 0, lopsided)!
    plan.sleeves.forEach((sleeve, index) => {
      expect(sleeve.amount).toBeLessThanOrEqual(lopsided[index].value)
      expect(sleeve.projectedValue).toBeGreaterThanOrEqual(0)
    })
  })

  it('reports a shortfall rather than overselling', () => {
    const plan = planWithdrawal(20000, 500, balanced)!
    expect(plan.fromCash).toBe(500)
    expect(plan.fromHoldings).toBe(10000)
    expect(plan.shortfall).toBe(9500)
    expect(plan.projectedTotal).toBe(0)
  })

  it('keeps the parts adding up to the amount raised by selling', () => {
    // 333.33 across three baskets is the classic case where naive rounding loses a cent.
    const plan = planWithdrawal(1000.01, 0, balanced)!
    const total = plan.sleeves.reduce((sum, sleeve) => sum + sleeve.amount, 0)
    expect(Math.round(total * 100) / 100).toBe(plan.fromHoldings)
  })

  it('pro-rates on-paper gain and loss by the share of each basket sold', () => {
    const plan = planWithdrawal(1000, 0, balanced)!
    // A tenth of every basket is sold, so a tenth of each basket's on-paper result.
    expect(plan.sleeves[0].estimatedRealisedProfitLoss).toBe(60)
    expect(plan.sleeves[1].estimatedRealisedProfitLoss).toBe(-15)
    expect(plan.sleeves[2].estimatedRealisedProfitLoss).toBe(2)
    expect(plan.estimatedRealisedProfitLoss).toBe(47)
  })

  it('withholds the overall gain figure when any basket is unpriced', () => {
    const partial: WithdrawalSleeveInput[] = [
      balanced[0],
      { ...balanced[1], unrealisedProfitLoss: undefined },
      balanced[2],
    ]
    const plan = planWithdrawal(1000, 0, partial)!
    expect(plan.sleeves[1].estimatedRealisedProfitLoss).toBeUndefined()
    expect(plan.estimatedRealisedProfitLoss).toBeUndefined()
  })

  it('does not let a loss-making basket dodge a sale it is overweight for', () => {
    // The overweight basket is the one sitting on a loss. The target mix still decides.
    const losing: WithdrawalSleeveInput[] = [
      { ...balanced[0], value: 7000, unrealisedProfitLoss: -900 },
      { ...balanced[1], value: 2000, unrealisedProfitLoss: 400 },
      { ...balanced[2], value: 1000, unrealisedProfitLoss: 100 },
    ]
    const plan = planWithdrawal(1000, 0, losing)!
    expect(plan.sleeves[0].amount).toBeGreaterThan(0)
    expect(plan.sleeves[0].estimatedRealisedProfitLoss).toBeLessThan(0)
  })
})
