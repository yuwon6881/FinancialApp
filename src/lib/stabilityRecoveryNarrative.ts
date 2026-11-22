// What the emergency-fund recovery card is allowed to say, worked out once and tested without React.
//
// The card used to derive all of this inline: five interacting booleans over six recovery fields,
// where "nothing due yet" and "already funded" both reduce to `outstandingThisCycle
// === 0` unless something keeps them apart. Reading them off one narrative keeps the component to a
// lookup, and keeps the one-figure-twice and never-say-final-forever rules in a place a test can
// reach.

import type { StabilityRecovery } from '@/types'

/** Which sentence and badge the card leads with. Ordered by precedence in `describe`. */
type StabilityRecoveryStatus =
  /** The money left this cycle: the plan is known but opens next cycle, so nothing is due. */
  | 'deferred'
  /** This cycle's share is fully funded. */
  | 'covered'
  /** A plan's cycles have run out with money still owed. */
  | 'overdue'
  /** The last cycle of the only open plan. */
  | 'finalCycle'
  /** Earlier installments are still unpaid and ride along with this cycle's own, before any plan has run out. */
  | 'behind'
  | 'onPlan'

export interface StabilityRecoveryNarrative {
  status: StabilityRecoveryStatus
  /** Everything still owed, across every open plan. */
  shortfall: number
  /** What this cycle asks for after credit for money already back. Zero while deferred. */
  askThisCycle: number
  /**
   * The ask covers the whole remaining shortfall, so naming both figures would print one number
   * twice. True on the final cycle and every cycle past the window.
   */
  askIsWholeShortfall: boolean
  /** Part of the still-due ask that is earlier installments rather than this cycle's own. Funding covers it first. */
  carriedStillDue: number
  /** Cycles left in the most urgent open plan, counting this one. Never below 1. */
  cyclesRemaining: number
  /** More than one recovery plan remains open, so the ask is a sum of shares. */
  hasOverlappingPlans: boolean
  /** A plan is past its window. Kept alongside `status`, which can describe the funded cycle. */
  isOverdue: boolean
  /** The only open plan is on its last cycle. Never true for overlapping or overdue plans. */
  isFinalCycle: boolean
  /** Amount credited toward the current cycle's fixed ask, capped at that ask. */
  cyclePlanFunded: number
  /** Null when the plan has not opened and there is no cycle target. */
  cyclePlanPercent: number | null
}

export function describeStabilityRecovery(recovery: StabilityRecovery): StabilityRecoveryNarrative {
  const shortfall = Math.max(0, recovery.outstandingShortfall)
  const askThisCycle = Math.max(0, recovery.outstandingThisCycle)
  const askIsWholeShortfall = askThisCycle >= shortfall - 0.005
  const cohorts = (recovery.recoveryCohorts ?? []).filter(cohort => cohort.remainingShortfall > 0)
  const hasOverlappingPlans = cohorts.length > 1
  // Overdue is checked before the final cycle: past the window `cyclesRemaining` sits at 1 forever,
  // so treating that as the final cycle announced "the last cycle of the plan" every cycle from then
  // on. Overlapping plans are excluded too — the aggregate counts down the *most urgent* cohort, so
  // an older plan on its last cycle called the whole recovery final while the list below it still
  // showed other plans with time remaining.
  const isFinalCycle = !recovery.isOverdue
    && !hasOverlappingPlans
    && askIsWholeShortfall
    && Math.max(1, recovery.cyclesRemaining) <= 1
  const toppedUp = Math.max(0, recovery.toppedUpThisCycle)
  const carriedStillDue = Math.min(askThisCycle, Math.max(0, (recovery.carriedThisCycle ?? 0) - toppedUp))
  // Deferral outranks everything: nothing was funded and nothing was due, which no amount on its own
  // can distinguish from a cycle that has already been paid.
  const status: StabilityRecoveryStatus = recovery.isDeferred
    ? 'deferred'
    : askThisCycle <= 0
      ? 'covered'
      : recovery.isOverdue
        ? 'overdue'
        : isFinalCycle
          ? 'finalCycle'
          : carriedStillDue > 0
            ? 'behind'
            : 'onPlan'

  return {
    status,
    shortfall,
    askThisCycle,
    askIsWholeShortfall,
    carriedStillDue,
    cyclesRemaining: Math.max(1, recovery.cyclesRemaining),
    hasOverlappingPlans,
    isOverdue: recovery.isOverdue,
    isFinalCycle,
    cyclePlanFunded: Math.min(Math.max(0, recovery.toppedUpThisCycle), Math.max(0, recovery.requiredThisCycle)),
    cyclePlanPercent: recovery.isDeferred || recovery.requiredThisCycle <= 0
      ? null
      : Math.round(Math.min(1, Math.max(0, recovery.toppedUpThisCycle / recovery.requiredThisCycle)) * 100),
  }
}
