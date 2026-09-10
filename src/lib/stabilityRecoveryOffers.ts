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
  /**
   * The amount the offer starts on. The **whole** remaining shortfall when this pay packet can
   * absorb it without touching committed money, otherwise just this cycle's share. Spreading a
   * small dip over three instalments is busywork; spreading a real raid is the point.
   */
  proposedTopUp: number
  /**
   * The most the user may raise the amount to: the whole shortfall, bounded by what the three
   * buckets actually receive. Above `safeCap` but at or below this is a deliberate choice, so it
   * is allowed and warned about rather than blocked.
   */
  maxTopUp: number
  /** The largest amount that still clears every bucket's committed money. */
  safeCap: number
  /** True when committed money held the default below what the pace asked for. */
  isReduced: boolean
  /**
   * The plan has not opened yet — the money left the fund this cycle — so nothing is asked for and
   * `proposedTopUp` is zero by design. Anything put back now is still accepted and still counts.
   */
  isDeferred: boolean
  /** Which bucket's committed money bound the default, if any. */
  limitedBy?: string
  draws: RecoveryDraw[]
}

const floorToCent = (value: number) => Math.floor(value * 100) / 100

/**
 * Splits an amount across the contributing buckets by their configured share, pushing the rounding
 * remainder onto the largest draw so the parts sum to the whole exactly.
 */
export function drawsFor(amount: number, buckets: RecoveryBucketState[]): RecoveryDraw[] {
  const contributing = buckets.filter(bucket => bucket.alloc > 0)
  const allocTotal = contributing.reduce((sum, bucket) => sum + bucket.alloc, 0)
  if (allocTotal <= 0 || amount <= 0) return []

  const draws = contributing.map(bucket => ({
    bucket: bucket.bucket,
    share: bucket.alloc / allocTotal,
    amount: floorToCent((amount * bucket.alloc) / allocTotal),
  }))

  const remainder = amount - draws.reduce((sum, draw) => sum + draw.amount, 0)
  if (remainder !== 0) {
    let largest = 0
    for (let i = 1; i < draws.length; i += 1) {
      if (draws[i].amount > draws[largest].amount) largest = i
    }
    draws[largest] = { ...draws[largest], amount: draws[largest].amount + remainder }
  }
  return draws
}

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
  buckets: RecoveryBucketState[],
  /** The fund's usual share of income, used to judge whether the remainder is worth spreading. */
  stabilityAlloc = 0
): RecoveryOffer | null {
  if (!isRecoveryActive(recovery)) return null
  if (!Number.isFinite(incomeAmount) || incomeAmount <= 0) return null
  const contributing = buckets.filter(bucket => bucket.alloc > 0)
  const allocTotal = contributing.reduce((sum, bucket) => sum + bucket.alloc, 0)
  if (allocTotal <= 0) return null

  // Nothing can come out of money the three buckets never receive, whatever the user asks for.
  const affordable = incomeAmount * allocTotal
  const normalStabilityContribution = incomeAmount * Math.max(0, stabilityAlloc)
  const roomAfterNormal = recovery.target > 0
    ? Math.max(0, recovery.target - recovery.currentBalance - normalStabilityContribution)
    : Number.POSITIVE_INFINITY
  // Ordinary salary clears the queue only through actual target attainment. Below the target it
  // does not reduce the explicit obligation or the amount the opted-in extra may repay.
  if (recovery.target > 0 && roomAfterNormal <= 0) return null
  const reloadCapacity = Math.min(recovery.outstandingShortfall, affordable, roomAfterNormal)
  if (reloadCapacity <= 0) return null
  const requestedTopUp = Math.min(Math.max(0, recovery.outstandingThisCycle), reloadCapacity)

  // The largest amount that still leaves every bucket its committed money.
  let safeCap = affordable
  let limitedBy: string | undefined
  for (const bucket of contributing) {
    const headroom = Math.max(0, bucket.balance + incomeAmount * bucket.alloc - bucket.committed)
    const bucketCap = (headroom * allocTotal) / bucket.alloc
    if (bucketCap < safeCap) {
      safeCap = bucketCap
      limitedBy = bucket.bucket
    }
  }

  // Floored, not rounded up: these are ceilings on how much may be moved, and rounding a ceiling
  // up breaks the invariant it exists to protect.
  safeCap = Math.max(0, floorToCent(Math.min(safeCap, reloadCapacity)))
  const maxTopUp = Math.max(0, floorToCent(reloadCapacity))

  // Clear the whole thing in one go when it is small enough that spreading it is busywork: no
  // bigger than the share this pay packet was sending the fund anyway, and still inside the safe
  // cap. Measuring against the usual share rather than against the safe cap matters — with no
  // bills recorded the safe cap is nearly the whole salary, and a 3,000 raid would default to
  // being cleared at once. The spread exists for exactly that case; a 70 dip does not need it.
  const trivialRemainder = incomeAmount * stabilityAlloc
  const wholeShortfallFits =
    requestedTopUp > 0 &&
    reloadCapacity === recovery.outstandingShortfall &&
    reloadCapacity <= safeCap && reloadCapacity <= trivialRemainder
  const proposedTopUp = wholeShortfallFits
    ? Math.max(0, floorToCent(reloadCapacity))
    : Math.min(safeCap, Math.max(0, floorToCent(requestedTopUp)))

  const isReduced = !wholeShortfallFits && proposedTopUp < requestedTopUp
  const isDeferred = Boolean(recovery.isDeferred)
  if (maxTopUp <= 0) {
    return { requestedTopUp, proposedTopUp: 0, maxTopUp: 0, safeCap, isReduced, isDeferred, limitedBy, draws: [] }
  }

  return {
    requestedTopUp,
    proposedTopUp,
    maxTopUp,
    safeCap,
    isReduced,
    isDeferred,
    limitedBy,
    draws: drawsFor(proposedTopUp, buckets),
  }
}
