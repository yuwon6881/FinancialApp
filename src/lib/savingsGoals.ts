// Deadline-to-contribution math for savings goals, mirroring the backend's
// Services/SavingsGoals/SavingsGoalPacing.cs the same way cycle.ts mirrors CycleBalanceService.
// Any change here needs the matching change (and test) on the backend, or the pace the UI shows
// will disagree with the pace the server actually funds.
//
// The governing idea: a goal is an *earmark* on the shared Rewards pool, not a fifth budget
// bucket. One balance, N claims, and whatever is unclaimed is the free-to-spend remainder.

import type { SavingsGoal } from '../types'
import { getCycleYearAndMonthForDate } from './cycle'

export interface GoalPace {
  goalId: number
  /** Target minus what is already earmarked, floored at zero. */
  remaining: number
  /** Whole cycles left including the current one. 1 = due this cycle, <= 0 = deadline passed. */
  cyclesRemaining: number
  /** What this goal needs each cycle to land on its target date. */
  requiredPerCycle: number
  isOverdue: boolean
  isFunded: boolean
}

export interface GoalGrant {
  goalId: number
  amount: number
  shortfall: number
}

export interface GoalWaterfall {
  grants: GoalGrant[]
  totalGranted: number
  /** What survived the waterfall — the money a wishlist reward can actually be claimed against. */
  freeToSpend: number
  totalRequired: number
  shortfall: number
}

const PRIORITY_RANK: Record<string, number> = { High: 0, Medium: 1, Low: 2 }

export function priorityRank(priority: string | undefined): number {
  return priority !== undefined && priority in PRIORITY_RANK ? PRIORITY_RANK[priority] : 1
}

// Contributions round UP to the cent so N cycles of the required amount actually clears the
// target; rounding down leaves it a few cents short on the deadline cycle.
function roundUpToCent(value: number): number {
  return Math.ceil(value * 100) / 100
}

// Money is compared and summed at cent precision throughout. Without this, accumulated binary
// float error makes "earmarks exactly consume the pool" read as a fraction of a cent left over.
function toCents(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Funding order when a cycle cannot cover every goal: priority first (that is what marking a goal
 * High is *for* — protecting it when money is short), then the nearest deadline, then the oldest
 * goal, with id as a final tie-break so the order is total and stable.
 */
export function orderForFunding(goals: SavingsGoal[]): SavingsGoal[] {
  return [...goals].sort((left, right) => {
    const byPriority = priorityRank(left.priority) - priorityRank(right.priority)
    if (byPriority !== 0) return byPriority
    const byDate = left.targetDate.localeCompare(right.targetDate)
    if (byDate !== 0) return byDate
    const byCreated = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
    if (byCreated !== 0) return byCreated
    return left.id - right.id
  })
}

/** Parses the 'YYYY-MM-DD' wire date as a *local* calendar date, avoiding the UTC-midnight shift. */
export function parseGoalDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed
}

/**
 * Whole cycles between now and the deadline, counting the current one. A goal due inside the
 * current cycle has exactly this cycle left, so it returns 1 rather than 0 — otherwise the last
 * cycle before a deadline would report an infinite required contribution.
 */
export function cyclesRemaining(
  today: Date,
  targetDate: Date,
  cycleDay: number,
): number {
  const current = getCycleYearAndMonthForDate(today, cycleDay)
  const target = getCycleYearAndMonthForDate(targetDate, cycleDay)
  return (target.year - current.year) * 12 + (target.monthIndex - current.monthIndex) + 1
}

export function computePace(goal: SavingsGoal, today: Date, cycleDay: number): GoalPace {
  const remaining = toCents(Math.max(0, goal.targetAmount - goal.earmarkedAmount))
  const cycles = cyclesRemaining(today, parseGoalDate(goal.targetDate), cycleDay)

  // Deadline reached or passed: there are no future cycles to spread the balance over, so the whole
  // remainder is due now. Spreading it anyway would hide the missed deadline.
  const requiredPerCycle = cycles <= 1 ? remaining : roundUpToCent(remaining / cycles)

  return {
    goalId: goal.id,
    remaining,
    cyclesRemaining: cycles,
    requiredPerCycle,
    isOverdue: cycles <= 0 && remaining > 0,
    isFunded: remaining <= 0,
  }
}

/**
 * Distributes `available` across the goals in funding order, capping each at its required pace.
 * Commitments fill before fun: the leftover is the free-to-spend remainder, never an implicit
 * extra contribution to whichever goal happens to sort first.
 */
export function distribute(
  goals: SavingsGoal[],
  available: number,
  today: Date,
  cycleDay: number,
): GoalWaterfall {
  let remainingPool = toCents(Math.max(0, available))
  const grants: GoalGrant[] = []
  let totalRequired = 0
  let totalGranted = 0

  for (const goal of orderForFunding(goals)) {
    const pace = computePace(goal, today, cycleDay)
    totalRequired = toCents(totalRequired + pace.requiredPerCycle)

    // Never earmark past the target: the final cycle of a goal only needs the remainder.
    const wanted = Math.min(pace.requiredPerCycle, pace.remaining)
    const granted = toCents(Math.min(wanted, remainingPool))
    remainingPool = toCents(remainingPool - granted)
    totalGranted = toCents(totalGranted + granted)

    grants.push({ goalId: goal.id, amount: granted, shortfall: toCents(Math.max(0, wanted - granted)) })
  }

  return {
    grants,
    totalGranted,
    freeToSpend: remainingPool,
    totalRequired,
    shortfall: toCents(Math.max(0, totalRequired - totalGranted)),
  }
}

export const isActiveGoal = (goal: SavingsGoal): boolean =>
  goal.status === 'active' && !goal.isPendingDelete

/**
 * Money in the Rewards pool no goal has claimed. Floored at zero so a balance that has dropped
 * below the outstanding earmarks (a correction, a refund reversal) reports "nothing free" rather
 * than a negative amount.
 */
export function unassigned(rewardsBalance: number, totalEarmarked: number): number {
  return toCents(Math.max(0, rewardsBalance - totalEarmarked))
}

export interface GoalPoolSummary {
  /** The whole Rewards balance — one pool, shared by commitments and rewards alike. */
  rewardsBalance: number
  /** Sum of every active goal's claim on it. */
  totalEarmarked: number
  /** What is genuinely free to spend on a reward right now. */
  unassigned: number
  /** What every active goal needs this cycle to stay on pace. */
  requiredPerCycleTotal: number
  /**
   * How far the expected per-cycle Rewards inflow falls short of that. Positive means at least one
   * deadline is unreachable at the current allocation — the signal the whole feature exists to give.
   */
  paceShortfall: number
  activeGoals: SavingsGoal[]
  paces: Map<number, GoalPace>
}

/**
 * The single source of truth for the numbers the Rewards page renders. Derived rather than
 * fetched, so the pool bar, the goal cards and the wishlist progress can never disagree about how
 * the same balance is divided.
 */
export function summarizePool(
  goals: SavingsGoal[],
  rewardsBalance: number,
  expectedInflow: number,
  today: Date,
  cycleDay: number,
): GoalPoolSummary {
  const activeGoals = orderForFunding(goals.filter(isActiveGoal))
  const paces = new Map<number, GoalPace>()
  let totalEarmarked = 0
  let requiredPerCycleTotal = 0

  for (const goal of activeGoals) {
    const pace = computePace(goal, today, cycleDay)
    paces.set(goal.id, pace)
    totalEarmarked = toCents(totalEarmarked + goal.earmarkedAmount)
    requiredPerCycleTotal = toCents(requiredPerCycleTotal + pace.requiredPerCycle)
  }

  return {
    rewardsBalance,
    totalEarmarked,
    unassigned: unassigned(rewardsBalance, totalEarmarked),
    requiredPerCycleTotal,
    paceShortfall: toCents(Math.max(0, requiredPerCycleTotal - Math.max(0, expectedInflow))),
    activeGoals,
    paces,
  }
}

/**
 * Human-readable pace verdict for a goal card. Percent funded alone cannot distinguish "3% of a
 * six-year house fund" (fine) from "33% of a three-month car service" (a problem); pace can.
 */
export type GoalPaceStatus = 'funded' | 'overdue' | 'behind' | 'onPace'

export function getPaceStatus(pace: GoalPace, grantedThisCycle: number): GoalPaceStatus {
  if (pace.isFunded) return 'funded'
  if (pace.isOverdue) return 'overdue'
  return grantedThisCycle + 0.005 < pace.requiredPerCycle ? 'behind' : 'onPace'
}

/**
 * When a goal will actually be funded at a given contribution rate, as a cycle count. Returns null
 * when the rate cannot get there at all, so callers show "not at this rate" instead of Infinity.
 */
export function cyclesToFund(pace: GoalPace, ratePerCycle: number): number | null {
  if (pace.remaining <= 0) return 0
  if (ratePerCycle <= 0) return null
  return Math.ceil(pace.remaining / ratePerCycle)
}
