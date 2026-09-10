// Emergency-fund recovery: how much of what left the fund to ask back, and how much of a given
// pay packet can safely provide it.
//
// Mirrors `Services/Stability/StabilityRecoveryPlanner.cs` the same way `savingsGoals.ts` mirrors
// `SavingsGoalPacing.cs`. The server owns the pace (it can see the fund's whole history); this
// module owns only the part that has to answer while the user types an amount, and the server
// re-derives the split authoritatively on save.

import type { StabilityRecovery, Transaction } from '@/types'
import {
  type RecoveryCohortInput,
  computeRecoveryCohortPlan,
  cycleKeyForDate,
  cyclesFromAnchor,
  isDeferredFromAnchor,
} from './stabilityRecoveryPacing'
import {
  type StabilityReloadMovement,
  type StabilityReloadObligation,
  type StabilityReloadPlanPoint,
  describeStabilityReloadMovements,
  isStabilityReloadDrawdown,
  normalizeReloadIntent,
  replayStabilityReload,
} from './stabilityRecoveryReplay'

export * from './stabilityRecoveryPacing'
export * from './stabilityRecoveryReplay'
export * from './stabilityRecoveryOffers'

function allocationFromPlanPoints(
  points: StabilityReloadPlanPoint[] | undefined,
  fallback: number,
  transaction: Transaction,
) {
  if (!points?.some(point => point.stabilityAlloc !== undefined)) return fallback
  const timestamp = Date.parse(transaction.postedAt || `${transaction.date}T00:00:00.000Z`)
  let selected = fallback
  for (const point of [...points].sort((left, right) =>
    Date.parse(left.effectiveAt) - Date.parse(right.effectiveAt))) {
    const pointTimestamp = Date.parse(point.effectiveAt)
    if (Number.isFinite(pointTimestamp) && pointTimestamp > timestamp) break
    if (point.stabilityAlloc !== undefined) selected = point.stabilityAlloc
  }
  return selected
}

/**
 * Rebuilds the opening queue the server replayed from. The carried obligations are authoritative
 * when present; the aggregate is the fallback for a payload from before they were sent, and infers
 * the opening total by backing this cycle's own movements out of the reported shortfall.
 */
function openingStateFor(
  recovery: StabilityRecovery,
  baseMovements: StabilityReloadMovement[],
): { outstanding: number; oldestOutstandingDate?: string; obligations?: StabilityReloadObligation[] } {
  const open = (recovery.openingObligations ?? []).filter(obligation => obligation.remainingAmount > 0)
  const detailedOutstanding = open.reduce((sum, obligation) => sum + obligation.remainingAmount, 0)
  const identitiesAreUnique = new Set(open.map(obligation => obligation.transactionId)).size === open.length
  const detailMatchesAggregate = recovery.openingOutstanding === undefined
    || Math.abs(detailedOutstanding - recovery.openingOutstanding) < 0.005
  if (open.length && identitiesAreUnique && detailMatchesAggregate) {
    return {
      outstanding: detailedOutstanding,
      oldestOutstandingDate: recovery.openingOldestDate ?? open[0]?.date,
      obligations: open,
    }
  }
  const outstanding = recovery.openingOutstanding ?? Math.max(
    0,
    recovery.outstandingShortfall +
      baseMovements.reduce((sum, movement) => sum + movement.repayment, 0) -
      baseMovements.reduce((sum, movement) => sum + (movement.marked ? Math.max(0, -movement.change) : 0), 0),
  )
  return { outstanding, oldestOutstandingDate: recovery.openingOldestDate ?? recovery.recoveryFromDate }
}

/** Applies a projected FIFO replay to each visible drawdown row. */
export function projectStabilityReloadStatuses(input: {
  recovery: StabilityRecovery
  baseTransactions: Transaction[]
  projectedTransactions: Transaction[]
  stabilityAlloc: number
  projectedBalance: number
  planPoints?: StabilityReloadPlanPoint[]
}): Transaction[] {
  const allocation = (transaction: Transaction) => allocationFromPlanPoints(
    input.planPoints,
    input.stabilityAlloc,
    transaction,
  )
  const baseMovements = describeStabilityReloadMovements(input.baseTransactions, allocation)
  const projectedMovements = describeStabilityReloadMovements(input.projectedTransactions, allocation)
  const projectedNetChange = projectedMovements.reduce((sum, movement) => sum + movement.change, 0)
  const replay = replayStabilityReload(
    openingStateFor(input.recovery, baseMovements),
    input.projectedBalance - projectedNetChange,
    input.recovery.target,
    projectedMovements,
    input.planPoints,
  )
  const obligations = new Map(replay.obligations.map(obligation => [obligation.transactionId, obligation]))
  return input.projectedTransactions.map(transaction => {
    if (!isStabilityReloadDrawdown(transaction)) {
      return { ...transaction, stabilityReloadStatus: undefined }
    }
    if (normalizeReloadIntent(transaction.stabilityReloadIntent) === 'NotRequired') {
      return { ...transaction, stabilityReloadStatus: 'NotRequired' }
    }
    const obligation = obligations.get(String(transaction.id))
    if (!obligation) return { ...transaction, stabilityReloadStatus: transaction.stabilityReloadStatus ?? 'Outstanding' }
    const original = Math.max(0, obligation.originalAmount)
    const remaining = Math.max(0, Math.min(original, obligation.remainingAmount))
    return {
      ...transaction,
      stabilityReloadStatus: remaining <= 0
        ? 'Complete'
        : remaining < original
          ? 'PartlyRepaid'
          : 'Outstanding',
    }
  })
}

/**
 * Replays the projected cycle against the same opening state as the server, so every reported figure
 * is derived rather than accumulated. Totals come from the replay's own per-obligation view: adding
 * this cycle's delta onto the previous total instead compounded the server's figure, and both counted
 * drawdowns that had already been put back in full.
 */
export function projectStabilityRecovery(input: {
  recovery: StabilityRecovery
  baseTransactions: Transaction[]
  projectedTransactions: Transaction[]
  stabilityAlloc: number
  projectedBalance: number
  planPoints?: StabilityReloadPlanPoint[]
  currentCycleKey?: string
  /**
   * Needed to place the oldest still-owing drawdown in its cycle, which is what the pace is anchored
   * on. Without it the anchor falls back to "this cycle if this run marked anything", which is only
   * right when nothing older is still owed.
   */
  cycleDay?: number
}): StabilityRecovery {
  const allocation = (transaction: Transaction) => allocationFromPlanPoints(
    input.planPoints,
    input.stabilityAlloc,
    transaction,
  )
  const baseMovements = describeStabilityReloadMovements(input.baseTransactions, allocation)
  const projectedMovements = describeStabilityReloadMovements(input.projectedTransactions, allocation)
  const opening = openingStateFor(input.recovery, baseMovements)
  const baseNetChange = baseMovements.reduce((sum, movement) => sum + movement.change, 0)
  const projectedNetChange = projectedMovements.reduce((sum, movement) => sum + movement.change, 0)
  const baseReplay = replayStabilityReload(
    opening,
    input.recovery.currentBalance - baseNetChange,
    input.recovery.target,
    baseMovements,
    input.planPoints,
  )
  const projectedReplay = replayStabilityReload(
    opening,
    input.projectedBalance - projectedNetChange,
    input.recovery.target,
    projectedMovements,
    input.planPoints,
  )
  const outstandingShortfall = projectedReplay.outstanding
  const markedTotal = projectedReplay.openMarkedTotal
  const repaidTotal = projectedReplay.openRepaidTotal
  const toppedUpThisCycle = Math.max(
    0,
    input.recovery.toppedUpThisCycle + projectedReplay.repaidThisRun - baseReplay.repaidThisRun,
  )
  // Anchored on the oldest drawdown that still owes money, which FIFO order puts at the head of the
  // queue. Anchoring on "did this run mark anything" let a drawdown already put back in full keep
  // driving the deadline, and reported the recovery as overdue on money that was already back.
  const anchorDate = outstandingShortfall > 0 ? projectedReplay.oldestOutstandingDate : undefined
  const anchorCycleKey = anchorDate !== undefined && input.cycleDay !== undefined
    ? cycleKeyForDate(anchorDate, input.cycleDay)
    : undefined
  // Without a date to place (a carried obligation from before identities were sent) or a cycleDay to
  // place it with, the server's anchor stands: it is authoritative, and resetting it here would
  // quietly hand back a full window for money that has been owed for cycles. This cycle only takes
  // the anchor when nothing was carried in for an older drawdown to hold it.
  const lastDrawdownCycleKey = outstandingShortfall <= 0
    ? undefined
    : anchorCycleKey
      ?? (opening.outstanding <= 0 && projectedReplay.markedThisRun > 0 && input.currentCycleKey
        ? input.currentCycleKey
        : input.recovery.lastDrawdownCycleKey)
  const cyclesRemaining = cyclesFromAnchor(
    lastDrawdownCycleKey,
    input.currentCycleKey,
    3,
  )
  const cohortInputs = new Map<string, RecoveryCohortInput>()
  for (const obligation of projectedReplay.obligations) {
    const repaidThisCycle = Math.max(
      0,
      projectedReplay.repaidByObligationThisRun[obligation.transactionId] ?? 0,
    )
    if (obligation.remainingAmount <= 0 && repaidThisCycle <= 0) continue
    if (input.cycleDay === undefined || !obligation.date) continue
    const originCycleKey = cycleKeyForDate(obligation.date, input.cycleDay)
    if (!originCycleKey) continue
    const existing = cohortInputs.get(originCycleKey)
    cohortInputs.set(originCycleKey, {
      originCycleKey,
      fromDate: existing && existing.fromDate < obligation.date ? existing.fromDate : obligation.date,
      transactionCount: (existing?.transactionCount ?? 0) + 1,
      remainingShortfall: (existing?.remainingShortfall ?? 0) + Math.max(0, obligation.remainingAmount),
      repaidThisCycle: (existing?.repaidThisCycle ?? 0) + repaidThisCycle,
    })
  }
  const hasCompleteCohortDetail = input.currentCycleKey !== undefined
    && cohortInputs.size > 0
    && (outstandingShortfall <= 0 || projectedReplay.obligations
      .filter(obligation => obligation.remainingAmount > 0)
      .every(obligation => Boolean(obligation.date)))
  const cohortPlan = hasCompleteCohortDetail
    ? computeRecoveryCohortPlan({
      cohorts: [...cohortInputs.values()],
      currentCycleKey: input.currentCycleKey!,
      outstandingShortfall,
      toppedUpThisCycle,
    })
    : undefined
  const paceAnchor = outstandingShortfall + toppedUpThisCycle
  const fallbackIsDeferred = outstandingShortfall > 0
    && isDeferredFromAnchor(lastDrawdownCycleKey, input.currentCycleKey)
  const fallbackRequiredThisCycle = fallbackIsDeferred
    ? 0
    : cyclesRemaining <= 1
      ? paceAnchor
      : Math.ceil((paceAnchor / cyclesRemaining) * 100) / 100
  const requiredThisCycle = cohortPlan?.requiredThisCycle ?? fallbackRequiredThisCycle

  const effectiveTarget = input.planPoints?.length
    ? input.planPoints[input.planPoints.length - 1].target
    : input.recovery.target

  return {
    ...input.recovery,
    target: effectiveTarget,
    markedTotal,
    repaidTotal,
    currentBalance: input.projectedBalance,
    outstandingShortfall,
    lastDrawdownCycleKey,
    recoveryCohorts: cohortPlan?.cohorts ?? input.recovery.recoveryCohorts,
    cyclesRemaining: cohortPlan?.cyclesRemaining ?? Math.max(1, cyclesRemaining),
    isOverdue: cohortPlan?.isOverdue ?? (cyclesRemaining <= 0 && outstandingShortfall > 0),
    isDeferred: cohortPlan?.isDeferred ?? fallbackIsDeferred,
    toppedUpThisCycle,
    requiredThisCycle,
    outstandingThisCycle: cohortPlan?.outstandingThisCycle ?? Math.max(
      0,
      Math.min(requiredThisCycle - toppedUpThisCycle, outstandingShortfall),
    ),
    isActive: outstandingShortfall > 0,
    // The same obligations the totals were measured over, so "see every movement since then" lands
    // on exactly the rows those figures came from.
    recoveryFromDate: anchorDate ?? (outstandingShortfall > 0 ? input.recovery.recoveryFromDate : undefined),
  }
}
