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
  fromDate: string
  transactionCount: number
  remainingShortfall: number
  repaidThisCycle: number
}

export interface RecoveryCohortPlan {
  cohorts: StabilityRecoveryCohort[]
  cyclesRemaining: number
  requiredThisCycle: number
  outstandingThisCycle: number
  isOverdue: boolean
  /** Every plan that still owes money opens later, so this cycle asks for nothing. */
  isDeferred: boolean
}

/** Mirrors the API's independent origin-cycle schedule and aggregate combined ask. */
export function computeRecoveryCohortPlan(input: {
  cohorts: RecoveryCohortInput[]
  currentCycleKey: string
  horizon?: number
  outstandingShortfall: number
  toppedUpThisCycle: number
}): RecoveryCohortPlan {
  const horizon = Math.max(1, input.horizon ?? 3)
  const grouped = new Map<string, RecoveryCohortInput>()
  for (const cohort of input.cohorts) {
    if (cohort.remainingShortfall <= 0 && cohort.repaidThisCycle <= 0) continue
    const existing = grouped.get(cohort.originCycleKey)
    grouped.set(cohort.originCycleKey, {
      originCycleKey: cohort.originCycleKey,
      fromDate: existing && existing.fromDate < cohort.fromDate ? existing.fromDate : cohort.fromDate,
      transactionCount: (existing?.transactionCount ?? 0) + Math.max(1, cohort.transactionCount),
      remainingShortfall: (existing?.remainingShortfall ?? 0) + Math.max(0, cohort.remainingShortfall),
      repaidThisCycle: (existing?.repaidThisCycle ?? 0) + Math.max(0, cohort.repaidThisCycle),
    })
  }
  const cohorts = [...grouped.values()]
    .map(cohort => {
      const rawCyclesRemaining = cyclesFromAnchor(
        cohort.originCycleKey,
        input.currentCycleKey,
        horizon,
      )
      const cyclesRemaining = Math.max(1, rawCyclesRemaining)
      const isDeferred = isDeferredFromAnchor(cohort.originCycleKey, input.currentCycleKey)
      const anchor = Math.max(0, cohort.remainingShortfall) + Math.max(0, cohort.repaidThisCycle)
      // A deferred plan asks for nothing at all rather than a share of it. Money put back anyway
      // still counts: it shrinks the shortfall the first real instalment divides.
      const requiredThisCycle = isDeferred
        ? 0
        : cyclesRemaining <= 1
          ? anchor
          : Math.ceil((anchor / cyclesRemaining) * 100) / 100
      return {
        originCycleKey: cohort.originCycleKey,
        fromDate: cohort.fromDate,
        transactionCount: Math.max(1, cohort.transactionCount),
        remainingShortfall: Math.max(0, cohort.remainingShortfall),
        cyclesRemaining,
        requiredThisCycle,
        isOverdue: rawCyclesRemaining <= 0 && cohort.remainingShortfall > 0,
        isDeferred,
      }
    })
    .sort((left, right) =>
      left.originCycleKey.localeCompare(right.originCycleKey) || left.fromDate.localeCompare(right.fromDate))
  const open = cohorts.filter(cohort => cohort.remainingShortfall > 0)
  const requiredThisCycle = cohorts.reduce((sum, cohort) => sum + cohort.requiredThisCycle, 0)
  const outstandingShortfall = Math.max(0, input.outstandingShortfall)
  return {
    cohorts,
    cyclesRemaining: open.length
      ? Math.min(...open.map(cohort => cohort.cyclesRemaining))
      : horizon,
    requiredThisCycle,
    outstandingThisCycle: Math.max(
      0,
      Math.min(requiredThisCycle - Math.max(0, input.toppedUpThisCycle), outstandingShortfall),
    ),
    isOverdue: open.some(cohort => cohort.isOverdue),
    // Only when *every* plan that still owes money starts later. One older cohort still due keeps a
    // combined ask, and the card should talk about that ask rather than about the newest
    // withdrawal's grace cycle.
    isDeferred: open.length > 0 && open.every(cohort => cohort.isDeferred),
  }
}
