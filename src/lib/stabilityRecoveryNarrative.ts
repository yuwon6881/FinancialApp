// What the emergency-fund recovery card is allowed to say, worked out once and tested without React.
//
// The card used to derive all of this inline: five interacting booleans over six recovery fields,
// where "ahead of plan", "nothing due yet" and "already funded" all reduce to `outstandingThisCycle
// === 0` unless something keeps them apart. Reading them off one narrative keeps the component to a
// lookup, and keeps the one-figure-twice and never-say-final-forever rules in a place a test can
// reach.

import type { StabilityRecovery } from '@/types'

/** Which sentence and badge the card leads with. Ordered by precedence in `describe`. */
export type StabilityRecoveryStatus =
  /** The money left this cycle: the plan is known but opens next cycle, so nothing is due. */
  | 'deferred'
  /** More has gone back this cycle than the plan asked for. */
  | 'aheadOfPace'
  /** A plan's cycles have run out with money still owed. */
  | 'overdue'
  /** The last cycle of the only open plan. */
  | 'finalCycle'
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
  /** Cycles left in the most urgent open plan, counting this one. Never below 1. */
  cyclesRemaining: number
  /** More than one spending cycle still has its own plan, so the ask is a sum of shares. */
  hasOverlappingPlans: boolean
  /** A plan is past its window. Kept alongside `status`, which an ahead-of-plan cycle outranks. */
  isOverdue: boolean
  /** The only open plan is on its last cycle. Never true for overlapping or overdue plans. */
  isFinalCycle: boolean
  /** How much of what is still being put back has gone back, 0-100. */
  percentRepaid: number
}

export function describeStabilityRecovery(recovery: StabilityRecovery): StabilityRecoveryNarrative {
  const shortfall = Math.max(0, recovery.outstandingShortfall)
  const askThisCycle = Math.max(0, recovery.outstandingThisCycle)
  const cohorts = recovery.recoveryCohorts ?? []
  const hasOverlappingPlans = cohorts.length > 1
  // Overdue is checked before the final cycle: past the window `cyclesRemaining` sits at 1 forever,
  // so treating that as the final cycle announced "the last cycle of the plan" every cycle from then
  // on. Overlapping plans are excluded too — the aggregate counts down the *most urgent* cohort, so
  // an older plan on its last cycle called the whole recovery final while the list below it still
  // offered a newer cohort three more cycles.
  const isFinalCycle = !recovery.isOverdue
    && !hasOverlappingPlans
    && Math.max(1, recovery.cyclesRemaining) <= 1
  // Deferral outranks everything: nothing was funded and nothing was due, which no amount on its own
  // can distinguish from a cycle that has already been paid.
  const status: StabilityRecoveryStatus = recovery.isDeferred
    ? 'deferred'
    : askThisCycle <= 0
      ? 'aheadOfPace'
      : recovery.isOverdue
        ? 'overdue'
        : isFinalCycle
          ? 'finalCycle'
          : 'onPlan'

  return {
    status,
    shortfall,
    askThisCycle,
    askIsWholeShortfall: askThisCycle >= shortfall - 0.005,
    cyclesRemaining: Math.max(1, recovery.cyclesRemaining),
    hasOverlappingPlans,
    isOverdue: recovery.isOverdue,
    isFinalCycle,
    percentRepaid: recovery.markedTotal > 0
      ? Math.round(Math.min(1, Math.max(0, recovery.repaidTotal / recovery.markedTotal)) * 100)
      : 0,
  }
}
