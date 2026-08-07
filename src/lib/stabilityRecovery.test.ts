import { describe, expect, it } from 'vitest'
import { isRecoveryActive, proposeTopUp, type RecoveryBucketState } from './stabilityRecovery'
import type { StabilityRecovery } from '@/types'

// Mirrors StabilityRecoveryPlannerTests.cs case for case, so drift between the two
// implementations shows up as a failing pair rather than a quiet disagreement.

const recovery = (overrides: Partial<StabilityRecovery> = {}): StabilityRecovery => ({
  isActive: true,
  highWaterMark: 10000,
  target: 10000,
  recoverableCeiling: 10000,
  currentBalance: 7000,
  outstandingShortfall: 3000,
  cyclesRemaining: 3,
  requiredThisCycle: 1000,
  toppedUpThisCycle: 0,
  outstandingThisCycle: 1000,
  isOverdue: false,
  lastDrawdownCycleKey: '2026-06',
  lastDrawdownAmount: 3000,
  essentialsCommitted: 0,
  rewardsCommitted: 0,
  suggestedDraws: [
    { bucket: 'Essentials', share: 0.588235 },
    { bucket: 'Growth', share: 0.294118 },
    { bucket: 'Rewards', share: 0.117647 },
  ],
  ...overrides,
})

const buckets = (overrides: Partial<Record<string, Partial<RecoveryBucketState>>> = {}): RecoveryBucketState[] => [
  { bucket: 'Essentials', alloc: 0.5, balance: 5000, committed: 0, ...overrides.Essentials },
  { bucket: 'Growth', alloc: 0.25, balance: 5000, committed: 0, ...overrides.Growth },
  { bucket: 'Rewards', alloc: 0.1, balance: 5000, committed: 0, ...overrides.Rewards },
]

const drawFor = (draws: { bucket: string; amount: number }[], bucket: string) =>
  draws.find(draw => draw.bucket === bucket)!.amount

describe('isRecoveryActive', () => {
  it('is false when there is nothing to put back', () => {
    expect(isRecoveryActive(undefined)).toBe(false)
    expect(isRecoveryActive(recovery({ isActive: false }))).toBe(false)
    expect(isRecoveryActive(recovery({ outstandingShortfall: 0 }))).toBe(false)
  })

  it('is true for a fund below the point it once reached', () => {
    expect(isRecoveryActive(recovery())).toBe(true)
  })
})

describe('proposeTopUp', () => {
  it('splits the draw across the three buckets in proportion', () => {
    const offer = proposeTopUp(
      recovery({ outstandingShortfall: 3000, outstandingThisCycle: 170 }), 1000, buckets()
    )!

    expect(offer.proposedTopUp).toBe(170)
    expect(offer.isReduced).toBe(false)
    expect(drawFor(offer.draws, 'Essentials')).toBe(100)
    expect(drawFor(offer.draws, 'Growth')).toBe(50)
    expect(drawFor(offer.draws, 'Rewards')).toBe(20)
  })

  // A small dip should not need three instalments; the spread exists for real raids.
  it('offers the whole shortfall when it is no bigger than the usual share', () => {
    // 70 against the 150 this pay packet was sending the fund anyway.
    const offer = proposeTopUp(
      recovery({ outstandingShortfall: 70, outstandingThisCycle: 23.34 }), 1000, buckets(), 0.15
    )!

    expect(offer.proposedTopUp).toBe(70)
    expect(offer.maxTopUp).toBe(70)
    expect(offer.isReduced).toBe(false)
  })

  // The spread exists for real raids, so a big one must not default to being cleared at once just
  // because no bills happen to be recorded this cycle.
  it('keeps the paced default on a big raid but lets the user raise it', () => {
    const offer = proposeTopUp(
      recovery({ outstandingShortfall: 3000, outstandingThisCycle: 1000 }), 10000, buckets(), 0.15
    )!

    expect(offer.proposedTopUp).toBe(1000)
    expect(offer.maxTopUp).toBe(3000)
  })

  it('never lets the ceiling exceed what the three buckets receive', () => {
    const offer = proposeTopUp(
      recovery({ outstandingShortfall: 3000, outstandingThisCycle: 1000 }), 100, buckets()
    )!

    expect(offer.maxTopUp).toBe(85)
  })

  it('reports a safe cap below the ceiling when money is already committed', () => {
    const offer = proposeTopUp(
      recovery({ outstandingShortfall: 3000, outstandingThisCycle: 1000 }),
      1000,
      buckets({ Essentials: { balance: 200, committed: 600 } })
    )!

    expect(offer.safeCap).toBe(170)
    expect(offer.maxTopUp).toBe(850)
    expect(offer.limitedBy).toBe('Essentials')
  })

  it('never draws more than the three buckets actually receive', () => {
    // 100 of income only sends 85 their way, however much the pace wants.
    const offer = proposeTopUp(recovery({ outstandingThisCycle: 1000 }), 100, buckets())!

    expect(offer.proposedTopUp).toBe(85)
  })

  it('holds the draw back so Essentials still covers its bills', () => {
    const offer = proposeTopUp(
      recovery({ outstandingThisCycle: 500 }),
      1000,
      buckets({ Essentials: { balance: 200, committed: 600 } })
    )!

    // 100 spare in Essentials at a 10/17 weight caps the whole draw at 170.
    expect(offer.proposedTopUp).toBe(170)
    expect(offer.isReduced).toBe(true)
    expect(offer.limitedBy).toBe('Essentials')
  })

  it('holds the draw back so savings goals still get their cycle', () => {
    const offer = proposeTopUp(
      recovery({ outstandingThisCycle: 500 }),
      1000,
      buckets({ Rewards: { balance: 0, committed: 90 } })
    )!

    expect(offer.proposedTopUp).toBe(85)
    expect(offer.limitedBy).toBe('Rewards')
  })

  it('offers nothing when every penny is already promised', () => {
    const offer = proposeTopUp(
      recovery({ outstandingThisCycle: 500 }),
      1000,
      buckets({ Essentials: { balance: 0, committed: 500 } })
    )!

    expect(offer.proposedTopUp).toBe(0)
    expect(offer.isReduced).toBe(true)
    expect(offer.draws).toEqual([])
  })

  it('rounds the offer down so a cap is never exceeded', () => {
    const offer = proposeTopUp(
      recovery({ outstandingThisCycle: 500 }),
      1000,
      buckets({ Essentials: { balance: 0, committed: 499.995 } })
    )!

    expect(offer.proposedTopUp).toBe(0)
  })

  it('ignores a bucket set to zero percent without dividing by zero', () => {
    const offer = proposeTopUp(recovery({ outstandingThisCycle: 200 }), 1000, [
      { bucket: 'Essentials', alloc: 0.6, balance: 1000, committed: 0 },
      { bucket: 'Growth', alloc: 0, balance: 1000, committed: 0 },
      { bucket: 'Rewards', alloc: 0.25, balance: 1000, committed: 0 },
    ])!

    expect(offer.proposedTopUp).toBe(200)
    expect(offer.draws.some(draw => draw.bucket === 'Growth')).toBe(false)
  })

  it('keeps the draws summing to the offer through rounding', () => {
    const offer = proposeTopUp(recovery({ outstandingThisCycle: 100.03 }), 1000, buckets())!

    const total = offer.draws.reduce((sum, draw) => sum + draw.amount, 0)
    expect(Math.abs(total - offer.proposedTopUp)).toBeLessThan(0.005)
  })

  it('offers nothing when there is no recovery, no income, or the cycle is settled', () => {
    expect(proposeTopUp(undefined, 1000, buckets())).toBeNull()
    expect(proposeTopUp(recovery({ isActive: false }), 1000, buckets())).toBeNull()
    expect(proposeTopUp(recovery(), 0, buckets())).toBeNull()
    expect(proposeTopUp(recovery({ outstandingThisCycle: 0 }), 1000, buckets())).toBeNull()
  })
})
