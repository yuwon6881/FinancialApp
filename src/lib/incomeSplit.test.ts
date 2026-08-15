import { describe, expect, it } from 'vitest'
import {
  computeIncomeLedgerCategory,
  resolveRedirectTargets,
  resolveRedirectWeights,
  type IncomeSplitInput,
} from './incomeSplit'

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

  // The regression that motivated the parser: matching only the three 'X 100%' strings sent both
  // Essentials splits to Growth+Rewards, so two of the six settings options ignored the bucket
  // they were labelled for.
  it('honours the Essentials splits instead of silently dropping them', () => {
    expect(resolveRedirectTargets('Split: Essentials 50%, Growth 50%')).toEqual(['Essentials', 'Growth'])
    expect(resolveRedirectTargets('Split: Essentials 50%, Rewards 50%')).toEqual(['Essentials', 'Rewards'])
  })

  it('weights uneven splits by the percentages given', () => {
    expect(resolveRedirectWeights('Split: Growth 75%, Rewards 25%')).toEqual([
      { bucket: 'Growth', weight: 0.75 },
      { bucket: 'Rewards', weight: 0.25 },
    ])
  })
})

describe('computeIncomeLedgerCategory with a recovery top-up', () => {
  it('adds the top-up on top of the usual stability share', () => {
    // 40 on top of the usual 200 -> 24% of a 1,000 salary; the 40 comes out of the 800 the other
    // three were due, so each gives up a twentieth of its share.
    expect(computeIncomeLedgerCategory({ ...base, recoveryTopUp: 40 }))
      .toBe('IncomeSplit:47.5,19,24,9.5')
  })

  it('draws the top-up from the other three in proportion', () => {
    const result = computeIncomeLedgerCategory({ ...base, recoveryTopUp: 80 })
    const [ess, gro, sta, rew] = result.slice('IncomeSplit:'.length).split(',').map(Number)

    // 80 out of the 800 the other three were due: each gives up a tenth of its share.
    expect(ess).toBeCloseTo(45, 4)
    expect(gro).toBeCloseTo(18, 4)
    expect(rew).toBeCloseTo(9, 4)
    expect(sta).toBeCloseTo(28, 4)
    expect(ess + gro + sta + rew).toBeCloseTo(100, 4)
  })

  it('clamps a top-up that would overshoot the target', () => {
    // Only 200 of headroom, but the usual 200 plus a 400 top-up was asked for.
    const result = computeIncomeLedgerCategory({ ...base, stabilityBalance: 9800, recoveryTopUp: 400 })
    const shares = result.slice('IncomeSplit:'.length).split(',').map(Number)

    expect(shares[2]).toBeCloseTo(20, 4)
    expect(shares.reduce((sum, share) => sum + share, 0)).toBeCloseTo(100, 4)
  })

  it('is unchanged by a zero or absent top-up', () => {
    expect(computeIncomeLedgerCategory({ ...base, recoveryTopUp: 0 })).toBe('Income')
    expect(computeIncomeLedgerCategory({ ...base, stabilityBalance: 10000, recoveryTopUp: 0 }))
      .toBe(computeIncomeLedgerCategory({ ...base, stabilityBalance: 10000 }))
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
    ).toBe('IncomeSplit:50,30,0,20')
  })

  it('splits the stability share when the deposit crosses the cap mid-way', () => {
    // Only $100 of headroom left; $100/$1000 = 10% stays in stability, 10% redirects.
    expect(
      computeIncomeLedgerCategory({ ...base, stabilityBalance: 9900 })
    ).toBe('IncomeSplit:50,25,10,15')
  })

  it('honors a Growth-100% overflow redirect', () => {
    expect(
      computeIncomeLedgerCategory({ ...base, stabilityBalance: 10000, stabilityOverflowRedirect: 'Growth 100%' })
    ).toBe('IncomeSplit:50,40,0,10')
  })

  it('honors a Rewards-100% overflow redirect', () => {
    expect(
      computeIncomeLedgerCategory({ ...base, stabilityBalance: 10000, stabilityOverflowRedirect: 'Rewards 100%' })
    ).toBe('IncomeSplit:50,20,0,30')
  })

  it('honors an Essentials-100% overflow redirect', () => {
    expect(
      computeIncomeLedgerCategory({ ...base, stabilityBalance: 10000, stabilityOverflowRedirect: 'Essentials 100%' })
    ).toBe('IncomeSplit:70,20,0,10')
  })

  it('treats a balance exactly at target as capped', () => {
    const result = computeIncomeLedgerCategory({ ...base, stabilityBalance: 10000, stabilityTarget: 10000 })
    expect(result.startsWith('IncomeSplit:')).toBe(true)
  })

  it('treats a zero Stability target as no cap', () => {
    expect(computeIncomeLedgerCategory({ ...base, stabilityTarget: 0 })).toBe('Income')
  })

  it('keeps an explicitly accepted recovery top-up when the Stability target is zero', () => {
    const result = computeIncomeLedgerCategory({ ...base, stabilityTarget: 0, recoveryTopUp: 40 })
    const shares = result.slice('IncomeSplit:'.length).split(',').map(Number)

    expect(result.startsWith('IncomeSplit:')).toBe(true)
    expect(shares[2]).toBeCloseTo(24, 4)
    expect(shares.reduce((sum, share) => sum + share, 0)).toBeCloseTo(100, 4)
  })
})
