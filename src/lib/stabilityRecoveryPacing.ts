// The per-cycle pace: which cycle a withdrawal belongs to, when its repayment plan opens, and how
// much each open plan asks for now.
//
// Mirrors `Services/Stability/StabilityRecoveryPlanner.cs`. Split out of `stabilityRecovery.ts`,
// which owns the replay-driven projection around it, so the pace the parity fixture pins lives in a
// file of its own.

import type { StabilityRecoveryCohort } from '@/types'
import { getCycleYearAndMonthForDate } from './cycle'

/** The cycle a `yyyy-MM-dd` date belongs to, as the `yyyy-MM` key the pace is measured in. */
export function cycleKeyForDate(date: string, cycleDay: number) {
  const [year, month, day] = date.split('-').map(Number)
  if (![year, month, day].every(Number.isFinite)) return undefined
  const { year: cycleYear, monthIndex } = getCycleYearAndMonthForDate(
    new Date(year, month - 1, day),
    cycleDay,
  )
  return `${cycleYear}-${String(monthIndex).padStart(2, '0')}`
}

/**
 * How long the spending cycle itself waits before its repayment plan opens. One cycle, mirroring
 * `StabilityRecoveryPlanner.GraceCycles`: the money leaves the fund partway through a cycle whose
 * income has already been split and largely spent, so asking for a share of it back in that same
 * cycle asks for money the buckets no longer hold.
 */
export const STABILITY_RECOVERY_GRACE_CYCLES = 1
export const STABILITY_RECOVERY_PLAN_CYCLES = 3
export const MAX_STABILITY_REPAYMENT_CYCLES = 24

/** Cycles between two `yyyy-MM` cycle keys, or undefined when either cannot be read. */
function elapsedCycles(anchor: string | undefined, currentCycleKey: string | undefined) {
  if (!anchor || !currentCycleKey) return undefined
  const from = anchor.split('-').map(Number)
  const to = currentCycleKey.split('-').map(Number)
  if (from.length !== 2 || to.length !== 2 || from.some(value => !Number.isFinite(value)) || to.some(value => !Number.isFinite(value))) {
    return undefined
  }
  return (to[0] - from[0]) * 12 + to[1] - from[1]
}

export function cyclesFromAnchor(anchor: string | undefined, currentCycleKey: string | undefined, horizon: number) {
  const elapsed = elapsedCycles(anchor, currentCycleKey)
  if (elapsed === undefined) return horizon
  return horizon - Math.max(0, elapsed - STABILITY_RECOVERY_GRACE_CYCLES)
}

/**
 * Whether the plan anchored on `anchor` has not opened yet, so nothing is due against it. An
 * unreadable anchor is never deferred: the fallback path has no cycle to defer to, and answering
 * "nothing is due" there would quietly drop a real obligation.
 */
export function isDeferredFromAnchor(anchor: string | undefined, currentCycleKey: string | undefined) {
  const elapsed = elapsedCycles(anchor, currentCycleKey)
  return elapsed !== undefined && elapsed < STABILITY_RECOVERY_GRACE_CYCLES
}

export interface RecoveryCohortInput {
  originCycleKey: string
  repaymentCycles?: number | null
  fromDate: string
  transactionCount: number
  remainingShortfall: number
  repaidThisCycle: number
  /**
   * What the withdrawal was before anything went back. Required: the installment schedule is fixed
   * against it, and leaving it out would quietly restart the schedule from whatever is left.
   */
  originalAmount: number
}

export interface RecoveryCohortPlan {
  cohorts: StabilityRecoveryCohort[]
  cyclesRemaining: number
  requiredThisCycle: number
  outstandingThisCycle: number
  /** The part of `requiredThisCycle` that is earlier installments not yet put back. */
  carriedThisCycle: number
  isOverdue: boolean
  /** Every plan that still owes money opens later, so this cycle asks for nothing. */
  isDeferred: boolean
}

const toCents = (value: number) => Math.round(value * 100)

/**
 * Cumulative amount scheduled once `installments` of `term` have fallen due. Rounded up once, so
 * installments differ by a cent at most and the last one settles the exact original amount.
 */
function scheduledCents(originalCents: number, installments: number, term: number) {
  if (installments <= 0) return 0
  if (installments >= term) return originalCents
  return Math.ceil(originalCents * installments / term)
}

interface CohortGroup {
  repaymentCycles: number
  originCycleKey: string
  fromDate: string
  transactionCount: number
  remainingCents: number
  originalCents: number
  /** Installments fallen due through this cycle, and through the one before it. */
  scheduledCents: number
  previousScheduledCents: number
  /** Put back before this cycle began; this cycle's own repayment is credited separately. */
  paidBeforeCents: number
  cyclesRemaining: number
  isPastTerm: boolean
  isDeferred: boolean
}

/**
 * Mirrors the API's origin-cycle schedule and combined ask.
 *
 * Each withdrawal has fixed cumulative installments over its own term. The ask is *pooled*: what
 * has fallen due across every plan, less everything already put back against any of them. Ledger
 * completion is FIFO, so a payment often lands on an older plan than the one that needed it; judging
 * each plan alone stranded that surplus and left a newer plan overdue while its owner paid every
 * ask in full. Money is fungible across plans here, and the per-plan figures below are the pooled
 * ask allocated oldest first.
 */
export function computeRecoveryCohortPlan(input: {
  cohorts: RecoveryCohortInput[]
  currentCycleKey: string
  horizon?: number
  outstandingShortfall: number
  toppedUpThisCycle: number
}): RecoveryCohortPlan {
  const horizon = Math.max(1, input.horizon ?? STABILITY_RECOVERY_PLAN_CYCLES)
  const grouped = new Map<string, CohortGroup>()
  for (const cohort of input.cohorts) {
    const repaymentCycles = cohort.repaymentCycles ?? horizon
    const key = cohort.originCycleKey + ':' + repaymentCycles
    const rawCyclesRemaining = cyclesFromAnchor(cohort.originCycleKey, input.currentCycleKey, repaymentCycles)
    if (cohort.remainingShortfall <= 0 && cohort.repaidThisCycle <= 0 && rawCyclesRemaining <= 0) continue
    const isDeferred = isDeferredFromAnchor(cohort.originCycleKey, input.currentCycleKey)
    const remainingCents = Math.max(0, toCents(cohort.remainingShortfall))
    const openingCents = remainingCents + Math.max(0, toCents(cohort.repaidThisCycle))
    const originalCents = Math.max(openingCents, toCents(cohort.originalAmount))
    const isPastTerm = rawCyclesRemaining <= 0
    const installments = isDeferred ? 0 : Math.min(repaymentCycles, repaymentCycles - rawCyclesRemaining + 1)
    const previousInstallments = isDeferred ? 0 : isPastTerm ? repaymentCycles : installments - 1
    const existing = grouped.get(key)
    grouped.set(key, {
      repaymentCycles,
      originCycleKey: cohort.originCycleKey,
      fromDate: existing && existing.fromDate < cohort.fromDate ? existing.fromDate : cohort.fromDate,
      transactionCount: (existing?.transactionCount ?? 0) + Math.max(1, cohort.transactionCount),
      remainingCents: (existing?.remainingCents ?? 0) + remainingCents,
      originalCents: (existing?.originalCents ?? 0) + originalCents,
      scheduledCents: (existing?.scheduledCents ?? 0) + scheduledCents(originalCents, installments, repaymentCycles),
      previousScheduledCents: (existing?.previousScheduledCents ?? 0)
        + scheduledCents(originalCents, previousInstallments, repaymentCycles),
      paidBeforeCents: (existing?.paidBeforeCents ?? 0) + originalCents - openingCents,
      cyclesRemaining: Math.max(1, rawCyclesRemaining),
      isPastTerm,
      isDeferred,
    })
  }
  const groups = [...grouped.values()]
    .sort((left, right) =>
      left.originCycleKey.localeCompare(right.originCycleKey) || left.fromDate.localeCompare(right.fromDate)
      || left.repaymentCycles - right.repaymentCycles)

  // Surplus on any plan offsets what another plan is short, oldest plan first.
  let credit = groups.reduce((sum, group) => sum + Math.max(0, group.paidBeforeCents - group.scheduledCents), 0)
  const dueByGroup = groups.map(group => {
    const short = Math.max(0, group.scheduledCents - group.paidBeforeCents)
    const offset = Math.min(short, credit)
    credit -= offset
    return short - offset
  })
  const requiredCents = dueByGroup.reduce((sum, due) => sum + due, 0)
  const previousScheduled = groups.reduce((sum, group) => sum + group.previousScheduledCents, 0)
  const paidBefore = groups.reduce((sum, group) => sum + group.paidBeforeCents, 0)
  const carriedCents = Math.min(requiredCents, Math.max(0, previousScheduled - paidBefore))

  // Past-term originals against everything put back so far, this cycle included: overdue only
  // when the money that has gone back cannot cover what the elapsed plans were meant to settle.
  const pastTermOriginal = groups.filter(group => group.isPastTerm).reduce((sum, group) => sum + group.originalCents, 0)
  const paidSoFar = groups.reduce((sum, group) => sum + group.originalCents - group.remainingCents, 0)
  const isOverdue = pastTermOriginal > paidSoFar

  const cohorts: StabilityRecoveryCohort[] = groups.map((group, index) => ({
    repaymentCycles: group.repaymentCycles,
    originCycleKey: group.originCycleKey,
    fromDate: group.fromDate,
    transactionCount: group.transactionCount,
    remainingShortfall: group.remainingCents / 100,
    cyclesRemaining: group.cyclesRemaining,
    requiredThisCycle: dueByGroup[index] / 100,
    isOverdue: isOverdue && group.isPastTerm && group.remainingCents > 0,
    isDeferred: group.isDeferred,
  }))
  const open = cohorts.filter(cohort => cohort.remainingShortfall > 0)
  const outstandingCents = Math.max(0, toCents(input.outstandingShortfall))
  const fundedCents = Math.max(0, toCents(input.toppedUpThisCycle))
  return {
    cohorts,
    cyclesRemaining: open.length
      ? Math.min(...open.map(cohort => cohort.cyclesRemaining))
      : horizon,
    requiredThisCycle: requiredCents / 100,
    outstandingThisCycle: Math.max(0, Math.min(requiredCents - fundedCents, outstandingCents)) / 100,
    carriedThisCycle: carriedCents / 100,
    isOverdue,
    // Only when *every* plan that still owes money starts later. One older cohort still due keeps a
    // combined ask, and the card should talk about that ask rather than about the newest
    // withdrawal's grace cycle.
    isDeferred: open.length > 0 && open.every(cohort => cohort.isDeferred),
  }
}
