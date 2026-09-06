import type { CycleProgress } from './cycle'

/**
 * The Today tab's Essentials challenge: one rank, one score, and one set of badges, all derived
 * from how the cycle's Essentials money is being spent against the clock.
 *
 * Kept pure and free of React so the thresholds can be tested directly, and so the card's wording
 * — which is presentation, and changes far more often than the arithmetic — never leaks in here.
 *
 * The rank is set by *projected usage*: the committed share of the Essentials money extended over
 * the whole cycle at the rate it is going. Raw remaining balance is not the measure, because it
 * falls all cycle long even for someone spending perfectly, and a rank that decays with the
 * calendar teaches nothing. Nor is the plain gap between the two shares, which cannot reward the
 * opening days at all: being "18% ahead of the clock" is arithmetically impossible on day two,
 * when only 6% of the clock has run. A projection reads the same on day two as on day twenty.
 */

export type EssentialsChallengeTier =
  /** No Essentials money is allocated to this cycle, so there is nothing to rank. */
  | 'unfunded'
  /** The selected cycle has not begun. */
  | 'not-started'
  | 'far-ahead'
  | 'ahead'
  | 'on-track'
  /** Inside the budget, but spending faster than the clock. */
  | 'near-limit'
  /** Inside the budget today, projected to end the cycle short. */
  | 'off-track'
  | 'over-a-little'
  | 'over-a-lot'

export type EssentialsChallengeBadgeId = 'bills-clear' | 'under-pace' | 'buffer-held' | 'limits-clean'

export interface EssentialsChallengeBadge {
  id: EssentialsChallengeBadgeId
  earned: boolean
}

export interface EssentialsChallengeInput {
  /** Essentials money available for the whole cycle: balance carried in plus income credited to it. */
  totalAvailable: number
  /** Essentials money left once every pending bill in the bucket has been paid. */
  projectedRemaining: number
  /** Server projection of the bucket at cycle close; already counts unpaid bills and the current pace. */
  projectedEndingBalance: number
  /** Non-recurring Essentials spend per elapsed day so far. */
  currentDailyPace: number
  unpaidRecurringCount: number
  /** How many tracked category limits are already exceeded. */
  exceededCategoryLimits: number
  cycle: Pick<CycleProgress, 'phase' | 'dayNumber' | 'totalDays' | 'daysLeft'>
}

export interface EssentialsChallenge {
  tier: EssentialsChallengeTier
  /** 0-100, or null when there is no funded, started cycle to score. */
  score: number | null
  /** Share of the cycle's Essentials money committed so far. Uncapped: above 1 means over. */
  usedRatio: number
  /** Share of the cycle already elapsed — where the plan says `usedRatio` should be today. */
  paceRatio: number
  /**
   * `usedRatio` carried at the current rate to the end of the cycle: 1 finishes exactly on the
   * budget, 0.8 finishes a fifth under, 1.2 a fifth over. This is what sets the rank.
   */
  projectedUsage: number
  /** `usedRatio - paceRatio`. Negative means the money is currently outlasting the clock. */
  drift: number
  totalAvailable: number
  projectedRemaining: number
  /** Where the bucket is projected to close; passed through so the card can quote the shortfall. */
  projectedEndingBalance: number
  /** How far past its money the bucket is, as a positive amount; 0 while inside the budget. */
  overspend: number
  /** Money ahead of (+) or behind (-) the pace line. */
  paceGap: number
  /** Days the remaining money has to cover. */
  spendDays: number
  /** What is left to spend per remaining day, floored at 0. */
  dailyAllowance: number
  currentDailyPace: number
  /** Current pace against `dailyAllowance`, as a share: 0.25 is spending 25% too fast. */
  paceDifference: number
  badges: EssentialsChallengeBadge[]
  earnedBadgeCount: number
}

/** Projected to finish this far under the budget or better. */
const USAGE_FAR_AHEAD = 0.82
const USAGE_AHEAD = 0.94
/** A cycle never lands exactly on its budget, so on plan is a band rather than a point. */
const USAGE_ON_TRACK = 1.05
/** Over by more than this share of the cycle's Essentials money is over by a lot. */
const OVERSPEND_HEAVY_RATIO = 0.1


/**
 * Two bands that never overlap, because being inside the budget must always outrank being outside
 * it: 41-100 while the money holds, 0-40 once it does not. Inside the upper band the score follows
 * the projection — finishing exactly on the budget scores `ON_PLAN_SCORE`, and finishing about 15%
 * under reaches 100.
 */
const ON_PLAN_SCORE = 70
const USAGE_SCORE_SLOPE = 200
const IN_BUDGET_FLOOR = 41
const OVER_BUDGET_CEILING = 40
const OVER_BUDGET_SLOPE = 200

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

export function isOverBudgetTier(tier: EssentialsChallengeTier): boolean {
  return tier === 'over-a-little' || tier === 'over-a-lot'
}

/** True for the two states that carry no rank, so callers can show an explanation instead. */
export function isUnrankedTier(tier: EssentialsChallengeTier): boolean {
  return tier === 'unfunded' || tier === 'not-started'
}

export function evaluateEssentialsChallenge(input: EssentialsChallengeInput): EssentialsChallenge {
  const {
    totalAvailable,
    projectedRemaining,
    projectedEndingBalance,
    currentDailyPace,
    unpaidRecurringCount,
    exceededCategoryLimits,
    cycle,
  } = input

  // When a cycle ends, use the server's final closing balance rather than re-subtracting unpaid bills.
  const effectiveRemaining = cycle.phase === 'ended' ? projectedEndingBalance : projectedRemaining
  const overspend = Math.max(0, -effectiveRemaining)

  // Mirrors the plan snapshot's daily figures so Today states one allowance, not two: an upcoming
  // cycle spreads across every day it has, and an ended one is a single closing figure.
  const spendDays = Math.max(1, cycle.phase === 'active'
    ? cycle.daysLeft
    : cycle.phase === 'upcoming' ? cycle.totalDays : 1)
  const dailyAllowance = Math.max(0, effectiveRemaining) / spendDays
  const paceDifference = dailyAllowance > 0
    ? (currentDailyPace - dailyAllowance) / dailyAllowance
    : currentDailyPace > 0 ? 1 : 0

  const funded = totalAvailable > 0
  const paceRatio = cycle.phase === 'upcoming'
    ? 0
    : cycle.phase === 'ended'
      ? 1
      : clamp(cycle.dayNumber / Math.max(1, cycle.totalDays), 0, 1)
  const usedRatio = funded ? 1 - effectiveRemaining / totalAvailable : 0
  // Derived from the server's forecast (projectedEndingBalance), which treats committed bills and
  // non-recurring daily pace distinctly rather than extrapolating bills at a daily rate.
  const projectedUsage = funded ? (totalAvailable - projectedEndingBalance) / totalAvailable : 0
  const drift = projectedUsage - 1
  const paceGap = funded ? projectedEndingBalance : 0

  let tier: EssentialsChallengeTier
  if (!funded) tier = 'unfunded'
  else if (cycle.phase === 'upcoming') tier = 'not-started'
  else if (overspend > 0) tier = overspend / totalAvailable > OVERSPEND_HEAVY_RATIO ? 'over-a-lot' : 'over-a-little'
  else if (projectedEndingBalance < 0) tier = 'off-track'
  else if (projectedUsage <= USAGE_FAR_AHEAD) tier = 'far-ahead'
  else if (projectedUsage <= USAGE_AHEAD) tier = 'ahead'
  else if (projectedUsage <= USAGE_ON_TRACK && paceDifference <= 0.05) tier = 'on-track'
  else tier = 'near-limit'

  const score = isUnrankedTier(tier)
    ? null
    : overspend > 0
      ? Math.round(clamp(OVER_BUDGET_CEILING - (overspend / totalAvailable) * OVER_BUDGET_SLOPE, 0, OVER_BUDGET_CEILING))
      : Math.round(clamp(ON_PLAN_SCORE + (1 - projectedUsage) * USAGE_SCORE_SLOPE, IN_BUDGET_FLOOR, 100))

  const isStarted = funded && cycle.phase !== 'upcoming'
  const badges: EssentialsChallengeBadge[] = [
    { id: 'under-pace', earned: isStarted && drift <= 0 },
    { id: 'buffer-held', earned: isStarted && projectedEndingBalance > 0 },
    { id: 'bills-clear', earned: isStarted && unpaidRecurringCount === 0 },
    { id: 'limits-clean', earned: isStarted && exceededCategoryLimits === 0 },
  ]

  return {
    tier,
    score,
    usedRatio,
    paceRatio,
    projectedUsage,
    drift,
    totalAvailable,
    projectedRemaining: effectiveRemaining,
    projectedEndingBalance,
    overspend,
    paceGap,
    spendDays,
    dailyAllowance,
    currentDailyPace,
    paceDifference,
    badges,
    earnedBadgeCount: badges.filter(badge => badge.earned).length,
  }
}
