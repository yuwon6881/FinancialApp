// Emergency-fund recovery: how much of what left the fund to ask back, and how much of a given
// pay packet can safely provide it.
//
// Mirrors `Services/Stability/StabilityRecoveryPlanner.cs` the same way `savingsGoals.ts` mirrors
// `SavingsGoalPacing.cs`. The server owns the pace (it can see the fund's whole history); this
// module owns only the part that has to answer while the user types an amount, and the server
// re-derives the split authoritatively on save.

import type { StabilityRecovery } from '@/types'

export interface RecoveryBucketState {
  bucket: string
  /** Share of income this bucket receives, as a fraction of 1. */
  alloc: number
  balance: number
  /** Money this cycle has already promised: bills for Essentials, savings goals for Rewards. */
  committed: number
}

export interface RecoveryDraw {
  bucket: string
  share: number
  amount: number
}

export interface RecoveryOffer {
  /** What the cycle's pace asked for, before any cap. */
  requestedTopUp: number
  /** What is actually offered, after every cap. */
  proposedTopUp: number
  /** True when committed money cut the offer below what was asked. */
  isReduced: boolean
  /** Which bucket's committed money bound the offer, if any. */
  limitedBy?: string
  draws: RecoveryDraw[]
}

const floorToCent = (value: number) => Math.floor(value * 100) / 100

/** Whether there is a live recovery to talk about at all. */
export function isRecoveryActive(recovery: StabilityRecovery | undefined): recovery is StabilityRecovery {
  return Boolean(recovery?.isActive) && (recovery?.outstandingShortfall ?? 0) > 0
}

/**
 * How much of `incomeAmount` can go back into the fund on top of its usual share, and where it
 * comes from.
 *
 * The draw is proportional to the three buckets' configured shares, so no single pot takes the
 * whole hit. It is then held below every bucket's committed money — refilling a buffer with the
 * rent, or with money a savings goal is already pacing toward, just moves the problem.
 */
export function proposeTopUp(
  recovery: StabilityRecovery | undefined,
  incomeAmount: number,
  buckets: RecoveryBucketState[]
): RecoveryOffer | null {
  if (!isRecoveryActive(recovery)) return null
  if (!Number.isFinite(incomeAmount) || incomeAmount <= 0) return null
  if (recovery.outstandingThisCycle <= 0) return null

  const contributing = buckets.filter(bucket => bucket.alloc > 0)
  const allocTotal = contributing.reduce((sum, bucket) => sum + bucket.alloc, 0)
  if (allocTotal <= 0) return null

  // Cannot draw more than the three buckets are actually going to receive.
  const requestedTopUp = Math.min(recovery.outstandingThisCycle, incomeAmount * allocTotal)

  let cap = requestedTopUp
  let limitedBy: string | undefined
  for (const bucket of contributing) {
    const headroom = Math.max(0, bucket.balance + incomeAmount * bucket.alloc - bucket.committed)
    const bucketCap = (headroom * allocTotal) / bucket.alloc
    if (bucketCap < cap) {
      cap = bucketCap
      limitedBy = bucket.bucket
    }
  }

  // Floored, not rounded up: this is a ceiling on how much may be moved, and rounding a ceiling
  // up breaks the invariant it exists to protect.
  const proposedTopUp = Math.max(0, floorToCent(cap))
  const isReduced = proposedTopUp < requestedTopUp
  if (proposedTopUp <= 0) {
    return { requestedTopUp, proposedTopUp: 0, isReduced, limitedBy, draws: [] }
  }

  const draws = contributing.map(bucket => ({
    bucket: bucket.bucket,
    share: bucket.alloc / allocTotal,
    amount: floorToCent((proposedTopUp * bucket.alloc) / allocTotal),
  }))

  // The rounding remainder rides on the largest draw so the parts sum to the whole exactly.
  const remainder = proposedTopUp - draws.reduce((sum, draw) => sum + draw.amount, 0)
  if (remainder !== 0 && draws.length > 0) {
    let largest = 0
    for (let i = 1; i < draws.length; i += 1) {
      if (draws[i].amount > draws[largest].amount) largest = i
    }
    draws[largest] = { ...draws[largest], amount: draws[largest].amount + remainder }
  }

  return { requestedTopUp, proposedTopUp, isReduced, limitedBy, draws }
}
