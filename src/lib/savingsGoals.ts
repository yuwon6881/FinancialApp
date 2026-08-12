// Deadline-to-contribution math for savings goals, mirroring the backend's
// Services/SavingsGoals/SavingsGoalPacing.cs the same way cycle.ts mirrors CycleBalanceService.
// Any change here needs the matching change (and test) on the backend, or the pace the UI shows
// will disagree with the pace the server actually funds.
//
// The governing idea: a goal is an *earmark* on one eligible budget pool, not a fifth budget
// bucket. One balance, N claims, and whatever is unclaimed is the free-to-spend remainder.

import type { SavingsGoal, SavingsGoalFundingBucket } from '../types'
import { getCycleYearAndMonthForDate } from './cycle'
import { calculateFreeRewardsBalance, isActiveGoal } from './freeRewards'

export { calculateFreeRewardsBalance } from './freeRewards'

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
 * What a goal of this size and deadline would ask for each cycle, for the add/edit form's preview.
 * Deliberately the same `computePace` the cards and the server use rather than a second formula:
 * a preview that rounded differently would quote a figure the goal then never asks for.
 */
export function previewRequiredPerCycle(
  targetAmount: number,
  earmarkedAmount: number,
  targetDate: string,
  today: Date,
  cycleDay: number,
): number {
  if (!(targetAmount > 0) || !targetDate) return 0
  const draft: SavingsGoal = {
    id: 0,
    name: '',
    targetAmount,
    earmarkedAmount: Math.min(Math.max(0, earmarkedAmount), targetAmount),
    targetDate,
    priority: 'Medium',
    status: 'active',
    isRecurring: false,
    recurrenceMonths: 12,
    cycleFundedAmount: 0,
    createdAt: new Date().toISOString(),
  }
  return computePace(draft, today, cycleDay, cycleKeyFor(today, cycleDay)).requiredPerCycle
}

export interface GoalPoolSummary {
  /** The selected bucket balance after pending bills are held aside — one pool, shared by commitments and spending alike. */
  rewardsBalance: number
  /** Sum of every active goal's claim on it. */
  totalEarmarked: number
  /** What is genuinely free to spend on a reward right now. */
  unassigned: number
  /** What every active goal needs this cycle to stay on pace. */
  requiredPerCycleTotal: number
  /**
   * What has actually been credited to goals during this cycle. Paired with
   * `requiredPerCycleTotal` it is what the cycle progress meter reads from; it can exceed the
   * requirement when a goal has been topped up beyond its share.
   */
  fundedThisCycleTotal: number
  /**
   * What every active goal still needs *this* cycle, after money already set aside during it. This
   * — not `requiredPerCycleTotal` vs the budget — is what says whether there is anything to fund
   * right now, so it is what the funding action and its label key off.
   */
  outstandingThisCycleTotal: number
  /**
   * How far this cycle's requirement outruns what can actually meet it — the expected bucket
   * inflow *plus the money already free in the pool*.
   *
   * The free balance has to be in there. Measured against the inflow alone, a user holding 5,000
   * free against a 1,000 goal due in two cycles was told the deadline was unreachable and offered
   * "extend a deadline, lower a target" for money they could set aside in one tap. It also stays
   * self-correcting: setting that money aside shrinks `unassigned` and the goal's remainder
   * together, so the two sides move by the same amount and the verdict does not flip.
   */
  paceShortfall: number
  /** True while at least one active goal is not yet fully funded overall. */
  hasUnfinishedGoals: boolean
  activeGoals: SavingsGoal[]
  paces: Map<number, GoalPace>
  /** Cycle key the tallies above are measured against. */
  currentCycleKey: string
  /** The existing budget bucket represented by this summary; omitted by older callers means Rewards. */
  fundingBucket?: SavingsGoalFundingBucket
}

/**
 * The single source of truth for the numbers the commitments page renders. Derived rather than
 * fetched, so the pool bar, the goal cards and the wishlist progress can never disagree about how
 * the same balance is divided.
 */
export function summarizePool(
  goals: SavingsGoal[],
  rewardsBalance: number,
  expectedInflow: number,
  today: Date,
  cycleDay: number,
  pendingRewards = 0,
  fundingBucket: SavingsGoalFundingBucket = 'Rewards',
): GoalPoolSummary {
  const activeGoals = orderForFunding(goals.filter(goal =>
    isActiveGoal(goal) && (goal.fundingBucket ?? 'Rewards') === fundingBucket))
  const currentCycleKey = cycleKeyFor(today, cycleDay)
  const paces = new Map<number, GoalPace>()
  let totalEarmarked = 0
  let requiredPerCycleTotal = 0
  let outstandingThisCycleTotal = 0
  let fundedThisCycleTotal = 0
  let hasUnfinishedGoals = false

  for (const goal of activeGoals) {
    const pace = computePace(goal, today, cycleDay, currentCycleKey)
    paces.set(goal.id, pace)
    totalEarmarked = toCents(totalEarmarked + Math.max(0, goal.earmarkedAmount))
    requiredPerCycleTotal = toCents(requiredPerCycleTotal + pace.requiredPerCycle)
    outstandingThisCycleTotal = toCents(outstandingThisCycleTotal + pace.outstandingThisCycle)
    fundedThisCycleTotal = toCents(fundedThisCycleTotal + pace.fundedThisCycle)
    if (!pace.isFunded) hasUnfinishedGoals = true
  }

  const availableRewards = toCents(Math.max(0, rewardsBalance - Math.max(0, pendingRewards)))
  const freeRewards = fundingBucket === 'Rewards'
    ? calculateFreeRewardsBalance(rewardsBalance, activeGoals, pendingRewards)
    : toCents(Math.max(0, availableRewards - totalEarmarked))

  return {
    rewardsBalance: availableRewards,
    totalEarmarked,
    unassigned: freeRewards,
    requiredPerCycleTotal,
    fundedThisCycleTotal,
    outstandingThisCycleTotal,
    paceShortfall: toCents(
      Math.max(0, requiredPerCycleTotal - Math.max(0, expectedInflow) - freeRewards),
    ),
    hasUnfinishedGoals,
    activeGoals,
    paces,
    currentCycleKey,
    fundingBucket,
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
