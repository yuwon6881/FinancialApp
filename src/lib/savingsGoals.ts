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
  /**
   * What this goal needs each cycle to land on its target date, measured from where it stood at the
   * START of the current cycle so it holds still as money goes in.
   */
  requiredPerCycle: number
  /** Net amount credited during this cycle: automatic funding and manual top-ups, less releases. */
  fundedThisCycle: number
  /**
   * What is still owed this cycle. The funding action operates on exactly this, so a goal already
   * topped up by hand is skipped and releasing money reopens precisely the released amount.
   */
  outstandingThisCycle: number
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

export function computePace(
  goal: SavingsGoal,
  today: Date,
  cycleDay: number,
  currentCycleKey: string,
): GoalPace {
  const fundedThisCycle = goal.cycleFundedKey === currentCycleKey
    ? toCents(Math.max(0, goal.cycleFundedAmount ?? 0))
    : 0

  const remaining = toCents(Math.max(0, goal.targetAmount - goal.earmarkedAmount))
  const cycles = cyclesRemaining(today, parseGoalDate(goal.targetDate), cycleDay)

  // Measured from where the goal stood at the START of this cycle, i.e. excluding what has already
  // gone in during it. Using the live remainder would make the requirement shrink the moment you
  // funded it, so a goal could never be "done for this cycle" and the number on screen would move
  // every time money went in.
  const remainingAtCycleStart = toCents(
    Math.max(0, goal.targetAmount - Math.max(0, goal.earmarkedAmount - fundedThisCycle)),
  )

  // Deadline reached or passed: there are no future cycles to spread the balance over, so the whole
  // remainder is due now. Spreading it anyway would hide the missed deadline.
  const requiredPerCycle = cycles <= 1
    ? remainingAtCycleStart
    : roundUpToCent(remainingAtCycleStart / cycles)

  // Capped by remaining as well: the final cycle of a goal only needs the remainder, however much
  // its nominal per-cycle pace says.
  const outstandingThisCycle = toCents(
    Math.min(Math.max(0, requiredPerCycle - fundedThisCycle), remaining),
  )

  return {
    goalId: goal.id,
    remaining,
    cyclesRemaining: cycles,
    requiredPerCycle,
    fundedThisCycle,
    outstandingThisCycle,
    isOverdue: cycles <= 0 && remaining > 0,
    isFunded: remaining <= 0,
  }
}

/** Cycle key ("yyyy-MM") for a date, matching the backend's key format exactly. */
export function cycleKeyFor(date: Date, cycleDay: number): string {
  const { year, monthIndex } = getCycleYearAndMonthForDate(date, cycleDay)
  return `${String(year).padStart(4, '0')}-${String(monthIndex).padStart(2, '0')}`
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
  currentCycleKey: string,
): GoalWaterfall {
  let remainingPool = toCents(Math.max(0, available))
  const grants: GoalGrant[] = []
  let totalRequired = 0
  let totalGranted = 0

  for (const goal of orderForFunding(goals)) {
    // Only what the goal still needs *this* cycle, so anything already topped up by hand is skipped.
    const wanted = computePace(goal, today, cycleDay, currentCycleKey).outstandingThisCycle
    totalRequired = toCents(totalRequired + wanted)

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
   * What every active goal still needs *this* cycle, after money already set aside during it. This
   * — not `requiredPerCycleTotal` vs the budget — is what says whether there is anything to fund
   * right now, so it is what the funding action and its label key off.
   */
  outstandingThisCycleTotal: number
  /**
   * How far the expected per-cycle Rewards inflow falls short of the requirement. Positive means at
   * least one deadline is unreachable at the current allocation — a budget-level warning, separate
   * from whether this cycle's contributions have been made.
   */
  paceShortfall: number
  /** True while at least one active goal is not yet fully funded overall. */
  hasUnfinishedGoals: boolean
  activeGoals: SavingsGoal[]
  paces: Map<number, GoalPace>
  /** Cycle key the tallies above are measured against. */
  currentCycleKey: string
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
  const currentCycleKey = cycleKeyFor(today, cycleDay)
  const paces = new Map<number, GoalPace>()
  let totalEarmarked = 0
  let requiredPerCycleTotal = 0
  let outstandingThisCycleTotal = 0
  let hasUnfinishedGoals = false

  for (const goal of activeGoals) {
    const pace = computePace(goal, today, cycleDay, currentCycleKey)
    paces.set(goal.id, pace)
    totalEarmarked = toCents(totalEarmarked + goal.earmarkedAmount)
    requiredPerCycleTotal = toCents(requiredPerCycleTotal + pace.requiredPerCycle)
    outstandingThisCycleTotal = toCents(outstandingThisCycleTotal + pace.outstandingThisCycle)
    if (!pace.isFunded) hasUnfinishedGoals = true
  }

  return {
    rewardsBalance,
    totalEarmarked,
    unassigned: unassigned(rewardsBalance, totalEarmarked),
    requiredPerCycleTotal,
    outstandingThisCycleTotal,
    paceShortfall: toCents(Math.max(0, requiredPerCycleTotal - Math.max(0, expectedInflow))),
    hasUnfinishedGoals,
    activeGoals,
    paces,
    currentCycleKey,
  }
}

/**
 * Human-readable pace verdict for a goal card. Percent funded alone cannot distinguish "3% of a
 * six-year house fund" (fine) from "33% of a three-month car service" (a problem); pace can.
 */
export type GoalPaceStatus = 'funded' | 'overdue' | 'needsFunding' | 'onPace'

/**
 * Derived purely from what this cycle actually owes, so a goal reads "on pace" only once its share
 * has genuinely been set aside — never because the budget happens to be large enough.
 */
export function getPaceStatus(pace: GoalPace): GoalPaceStatus {
  if (pace.isFunded) return 'funded'
  if (pace.isOverdue) return 'overdue'
  return pace.outstandingThisCycle > 0 ? 'needsFunding' : 'onPace'
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
