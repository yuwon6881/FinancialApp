import { describe, expect, it } from 'vitest'
import { computeIncomeLedgerCategory, resolveRedirectTargets, type IncomeSplitInput } from './incomeSplit'

// Base config: 50% essentials, 20% growth, 20% stability, 10% rewards.
const base: IncomeSplitInput = {
  amount: 1000,
  essentialsAlloc: 0.5,
  growthAlloc: 0.2,
  stabilityAlloc: 0.2,
  rewardsAlloc: 0.1,
  stabilityBalance: 0,
  stabilityTarget: 10000,
  stabilityOverflowRedirect: 'Split: Growth 50%, Rewards 50%',
}

describe('resolveRedirectTargets', () => {
  it('maps the three 100% options to a single bucket', () => {
    expect(resolveRedirectTargets('Growth 100%')).toEqual(['Growth'])
    expect(resolveRedirectTargets('Rewards 100%')).toEqual(['Rewards'])
    expect(resolveRedirectTargets('Essentials 100%')).toEqual(['Essentials'])
  })

  it('defaults to a Growth+Rewards split for anything else', () => {
    expect(resolveRedirectTargets('Split: Growth 50%, Rewards 50%')).toEqual(['Growth', 'Rewards'])
    expect(resolveRedirectTargets('anything')).toEqual(['Growth', 'Rewards'])
  })
})

describe('computeIncomeLedgerCategory', () => {
  it('returns plain "Income" when the stability cap is far off', () => {
    expect(computeIncomeLedgerCategory(base)).toBe('Income')
  })

  it('redirects the entire stability share once the cap is already reached', () => {
    // stability full -> its 20% splits evenly to Growth (+10) and Rewards (+10).
    expect(
      computeIncomeLedgerCategory({ ...base, stabilityBalance: 10000 })
    ).toBe('IncomeSplit:50.0000,30.0000,0.0000,20.0000')
  })

  it('splits the stability share when the deposit crosses the cap mid-way', () => {
    // Only $100 of headroom left; $100/$1000 = 10% stays in stability, 10% redirects.
    expect(
      computeIncomeLedgerCategory({ ...base, stabilityBalance: 9900 })
    ).toBe('IncomeSplit:50.0000,25.0000,10.0000,15.0000')
  })

  it('honors a Growth-100% overflow redirect', () => {
    expect(
      computeIncomeLedgerCategory({ ...base, stabilityBalance: 10000, stabilityOverflowRedirect: 'Growth 100%' })
    ).toBe('IncomeSplit:50.0000,40.0000,0.0000,10.0000')
  })

  it('honors a Rewards-100% overflow redirect', () => {
    expect(
      computeIncomeLedgerCategory({ ...base, stabilityBalance: 10000, stabilityOverflowRedirect: 'Rewards 100%' })
    ).toBe('IncomeSplit:50.0000,20.0000,0.0000,30.0000')
  })

  it('honors an Essentials-100% overflow redirect', () => {
    expect(
      computeIncomeLedgerCategory({ ...base, stabilityBalance: 10000, stabilityOverflowRedirect: 'Essentials 100%' })
    ).toBe('IncomeSplit:70.0000,20.0000,0.0000,10.0000')
  })

  it('treats a balance exactly at target as capped', () => {
    const result = computeIncomeLedgerCategory({ ...base, stabilityBalance: 10000, stabilityTarget: 10000 })
    expect(result.startsWith('IncomeSplit:')).toBe(true)
  })
})
