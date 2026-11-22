import { describe, expect, it } from 'vitest'
import type { StabilityRecovery } from '@/types'
import { describeStabilityRecovery } from './stabilityRecoveryNarrative'

const recovery = (overrides: Partial<StabilityRecovery> = {}): StabilityRecovery => ({
  isActive: true,
  markedTotal: 3000,
  target: 10000,
  currentBalance: 7000,
  outstandingShortfall: 3000,
  cyclesRemaining: 3,
  requiredThisCycle: 1000,
  toppedUpThisCycle: 0,
  outstandingThisCycle: 1000,
  isOverdue: false,
  repaidTotal: 0,
  essentialsCommitted: 0,
  rewardsCommitted: 0,
  suggestedDraws: [],
  ...overrides,
})

describe('describeStabilityRecovery', () => {
  it('leads with the plan when this cycle has a share to put back', () => {
    const narrative = describeStabilityRecovery(recovery())

    expect(narrative.status).toBe('onPlan')
    expect(narrative.askThisCycle).toBe(1000)
    expect(narrative.askIsWholeShortfall).toBe(false)
  })

  it('reports being behind schedule when earlier installments ride along, and lets funding cover them first', () => {
    const behind = describeStabilityRecovery(recovery({
      requiredThisCycle: 160,
      outstandingThisCycle: 160,
      carriedThisCycle: 60,
    }))
    expect(behind.status).toBe('behind')
    expect(behind.carriedStillDue).toBe(60)

    const partlyFunded = describeStabilityRecovery(recovery({
      requiredThisCycle: 160,
      toppedUpThisCycle: 40,
      outstandingThisCycle: 120,
      carriedThisCycle: 60,
    }))
    expect(partlyFunded.carriedStillDue).toBe(20)

    const caughtUp = describeStabilityRecovery(recovery({
      requiredThisCycle: 160,
      toppedUpThisCycle: 70,
      outstandingThisCycle: 90,
      carriedThisCycle: 60,
    }))
    expect(caughtUp.carriedStillDue).toBe(0)
    expect(caughtUp.status).toBe('onPlan')
  })

  it('keeps overdue ahead of behind, and treats a payload without a carried figure as on plan', () => {
    expect(describeStabilityRecovery(recovery({ isOverdue: true, carriedThisCycle: 500 })).status).toBe('overdue')
    expect(describeStabilityRecovery(recovery()).carriedStillDue).toBe(0)
  })

  // The distinction the amounts alone cannot make: nothing due and nothing funded is not the same
  // as a cycle whose share is already back, and telling the user they are "ahead of the plan" in
  // the cycle they just raided the fund reads as praise for spending it.
  it('outranks every other state while the plan has not opened', () => {
    const narrative = describeStabilityRecovery(recovery({
      isDeferred: true,
      requiredThisCycle: 0,
      outstandingThisCycle: 0,
    }))

    expect(narrative.status).toBe('deferred')
    expect(narrative.askThisCycle).toBe(0)
    expect(narrative.shortfall).toBe(3000)
    expect(narrative.cyclesRemaining).toBe(3)
  })

  it.each([290.59, 520])('reports that the cycle is covered after %s is put back', toppedUpThisCycle => {
    const narrative = describeStabilityRecovery(recovery({
      outstandingShortfall: 351.77,
      markedTotal: 871.77,
      repaidTotal: 520,
      toppedUpThisCycle,
      requiredThisCycle: 290.59,
      outstandingThisCycle: 0,
    }))

    expect(narrative.status).toBe('covered')
    expect(narrative.cyclePlanPercent).toBe(100)
    expect(narrative.cyclePlanFunded).toBe(290.59)
  })

  // Past the window cyclesRemaining sits at 1 forever, so reading that as the final cycle announced
  // "the last cycle of the plan" every cycle from then on.
  it('tells an overdue plan apart from its final cycle', () => {
    const overdue = describeStabilityRecovery(recovery({
      isOverdue: true,
      cyclesRemaining: 1,
      requiredThisCycle: 746.8,
      outstandingThisCycle: 746.8,
      outstandingShortfall: 746.8,
    }))
    const final = describeStabilityRecovery(recovery({
      cyclesRemaining: 1,
      requiredThisCycle: 400,
      outstandingThisCycle: 400,
      outstandingShortfall: 400,
    }))

    expect(overdue.status).toBe('overdue')
    expect(overdue.isFinalCycle).toBe(false)
    expect(final.status).toBe('finalCycle')
    expect(final.isFinalCycle).toBe(true)
    // Both ask for everything that is left, so the sentence must name one figure rather than two.
    expect(overdue.askIsWholeShortfall).toBe(true)
    expect(final.askIsWholeShortfall).toBe(true)
  })

  // The aggregate counts down the most urgent cohort, so an older plan on its last cycle used to
  // stamp "final" on a recovery whose newer cohort still had its whole window.
  it('never calls the recovery final while more than one plan is open', () => {
    const narrative = describeStabilityRecovery(recovery({
      cyclesRemaining: 1,
      recoveryCohorts: [
        {
          originCycleKey: '2026-06', fromDate: '2026-06-04', transactionCount: 1,
          remainingShortfall: 600, cyclesRemaining: 1, requiredThisCycle: 600, isOverdue: false,
        },
        {
          originCycleKey: '2026-08', fromDate: '2026-08-04', transactionCount: 1,
          remainingShortfall: 300, cyclesRemaining: 3, requiredThisCycle: 0, isOverdue: false,
          isDeferred: true,
        },
      ],
    }))

    expect(narrative.hasOverlappingPlans).toBe(true)
    expect(narrative.isFinalCycle).toBe(false)
    expect(narrative.status).toBe('onPlan')
  })

  it('uses the fixed current-cycle ask while repayments increase', () => {
    const narrative = describeStabilityRecovery(recovery({
      requiredThisCycle: 1000, toppedUpThisCycle: 250, outstandingThisCycle: 750,
    }))
    expect(narrative.cyclePlanFunded).toBe(250)
    expect(narrative.cyclePlanPercent).toBe(25)
  })

  it('has no progress bar target in the deferred spending cycle', () => {
    expect(describeStabilityRecovery(recovery({
      isDeferred: true, requiredThisCycle: 0, toppedUpThisCycle: 50, outstandingThisCycle: 0,
    })).cyclePlanPercent).toBeNull()
  })
})
