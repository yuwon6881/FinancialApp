import { describe, expect, it } from 'vitest'
import { planDeposit, type DepositSleeveInput } from './investmentDeposit'

// A balanced 60/30/10 portfolio worth 10,000.
const balanced: DepositSleeveInput[] = [
  { sleeve: 'USEquity', label: 'US shares', targetPercentage: 60, value: 6000 },
  { sleeve: 'InternationalExUS', label: 'Shares outside the US', targetPercentage: 30, value: 3000 },
  { sleeve: 'Bonds', label: 'Bonds', targetPercentage: 10, value: 1000 },
]

const amounts = (sleeves: { amount: number }[]) => sleeves.map(sleeve => sleeve.amount)

describe('planDeposit', () => {
  it('returns nothing for a zero or negative request', () => {
    expect(planDeposit(0, balanced)).toBeNull()
    expect(planDeposit(-100, balanced)).toBeNull()
  })

  it('splits a deposit into a balanced portfolio by target weight', () => {
    const plan = planDeposit(1000, balanced)!
    // Every basket is exactly on target, so each takes its target share.
    expect(amounts(plan.sleeves)).toEqual([600, 300, 100])
    plan.sleeves.forEach(sleeve => expect(sleeve.projectedDriftPercentagePoints).toBe(0))
    expect(plan.worstProjectedDrift).toBe(0)
    expect(plan.projectedTotal).toBe(11000)
  })

  it('directs more money to the underweight basket, rebalancing on the way in', () => {
    // Bonds has drifted down: 500 of a 10,000 portfolio against a 10% target.
    const drifted: DepositSleeveInput[] = [
      { ...balanced[0], value: 6500 },
      { ...balanced[1], value: 3000 },
      { ...balanced[2], value: 500 },
    ]
    const plan = planDeposit(1000, drifted)!

    // Post-deposit total is 11,000:
    //   US target = 6,600  → deficit = 100
    //   Intl target = 3,300 → deficit = 300
    //   Bonds target = 1,100 → deficit = 600
    // Total deficit = 1,000 → allocations: US=100, Intl=300, Bonds=600
    expect(amounts(plan.sleeves)).toEqual([100, 300, 600])
    // Bonds (most underweight) receives the most.
    expect(plan.sleeves[2].amount).toBeGreaterThan(plan.sleeves[0].amount)
    expect(plan.sleeves[2].amount).toBeGreaterThan(plan.sleeves[1].amount)
    expect(amounts(plan.sleeves).reduce((s, v) => s + v, 0)).toBe(1000)
  })

  it('falls back to target-percentage split when all baskets are above target', () => {
    // If a deposit is tiny relative to the portfolio all three baskets may
    // end up having no meaningful deficit (all are overweight relative to the
    // post-deposit total), so fall back to plain target percentages.
    const overweight: DepositSleeveInput[] = [
      { ...balanced[0], value: 7000 },
      { ...balanced[1], value: 2000 },
      { ...balanced[2], value: 1000 },
    ]
    const plan = planDeposit(1, overweight)!
    const total = amounts(plan.sleeves).reduce((s, v) => s + v, 0)
    expect(total).toBe(plan.requested)
  })

  it('keeps the parts adding up to the requested amount', () => {
    // 333.33 across three baskets is the classic case where naive rounding loses a cent.
    const plan = planDeposit(1000.01, balanced)!
    const total = plan.sleeves.reduce((sum, sleeve) => sum + sleeve.amount, 0)
    expect(Math.round(total * 100) / 100).toBe(plan.requested)
  })

  it('projected total equals invested plus deposit', () => {
    const plan = planDeposit(2500, balanced)!
    expect(plan.projectedTotal).toBe(12500)
  })

  it('handles sleeves with undefined or zero value', () => {
    const empty: DepositSleeveInput[] = [
      { sleeve: 'USEquity', label: 'US shares', targetPercentage: 60 },
      { sleeve: 'InternationalExUS', label: 'Shares outside the US', targetPercentage: 30 },
      { sleeve: 'Bonds', label: 'Bonds', targetPercentage: 10 },
    ]
    const plan = planDeposit(1000, empty)!
    // All sleeves start at 0, so all are equally underweight proportional to target.
    expect(amounts(plan.sleeves)).toEqual([600, 300, 100])
    expect(plan.projectedTotal).toBe(1000)
  })
})
