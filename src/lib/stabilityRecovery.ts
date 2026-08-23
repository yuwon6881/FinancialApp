// Emergency-fund recovery: how much of what left the fund to ask back, and how much of a given
// pay packet can safely provide it.
//
// Mirrors `Services/Stability/StabilityRecoveryPlanner.cs` the same way `savingsGoals.ts` mirrors
// `SavingsGoalPacing.cs`. The server owns the pace (it can see the fund's whole history); this
// module owns only the part that has to answer while the user types an amount, and the server
// re-derives the split authoritatively on save.

import type { StabilityRecovery, Transaction } from '@/types'
import {
  type StabilityReloadPlanPoint,
  type StabilityReloadReplay,
  describeStabilityReloadMovements,
  isStabilityReloadDrawdown,
  normalizeReloadIntent,
  replayStabilityReload,
} from './stabilityRecoveryReplay'

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

function recoveryWindowStart(replay: StabilityReloadReplay) {
  if (!replay.oldestMarkedThisRunDate) return replay.oldestOutstandingDate
  if (!replay.oldestOutstandingDate) return replay.oldestMarkedThisRunDate
  return replay.oldestMarkedThisRunDate < replay.oldestOutstandingDate
    ? replay.oldestMarkedThisRunDate
    : replay.oldestOutstandingDate
}

function cyclesFromAnchor(anchor: string | undefined, currentCycleKey: string | undefined, horizon: number) {
  if (!anchor || !currentCycleKey) return horizon
  const from = anchor.split('-').map(Number)
  const to = currentCycleKey.split('-').map(Number)
  if (from.length !== 2 || to.length !== 2 || from.some(value => !Number.isFinite(value)) || to.some(value => !Number.isFinite(value))) {
    return horizon
  }
  const elapsed = (to[0] - from[0]) * 12 + to[1] - from[1]
  return horizon - Math.max(0, elapsed)
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
  const openingOutstanding = input.recovery.openingOutstanding ?? Math.max(
    0,
    input.recovery.outstandingShortfall +
      baseMovements.reduce((sum, movement) => sum + movement.repayment, 0) -
      baseMovements.reduce((sum, movement) => sum + (movement.marked ? Math.max(0, -movement.change) : 0), 0),
  )
  const openingDate = input.recovery.openingOldestDate ?? input.recovery.recoveryFromDate
  const replay = replayStabilityReload(
    { outstanding: openingOutstanding, oldestOutstandingDate: openingDate },
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
 * Replays the projected cycle against the same inferred opening state as the server. The API only
 * returns the end-of-cycle obligation, so the opening total is recovered from the base cycle's
 * marked and repayment amounts; replaying both lists preserves repayment clamping and mid-cycle
 * attainment instead of subtracting raw deltas.
 */
export function projectStabilityRecovery(input: {
  recovery: StabilityRecovery
  baseTransactions: Transaction[]
  projectedTransactions: Transaction[]
  stabilityAlloc: number
  projectedBalance: number
  planPoints?: StabilityReloadPlanPoint[]
  currentCycleKey?: string
}): StabilityRecovery {
  const allocation = (transaction: Transaction) => allocationFromPlanPoints(
    input.planPoints,
    input.stabilityAlloc,
    transaction,
  )
  const baseMovements = describeStabilityReloadMovements(input.baseTransactions, allocation)
  const projectedMovements = describeStabilityReloadMovements(input.projectedTransactions, allocation)
  const baseMarked = baseMovements.reduce(
    (sum, movement) => sum + (movement.marked ? Math.max(0, -movement.change) : 0), 0)
  const baseRepaid = baseMovements.reduce((sum, movement) => sum + movement.repayment, 0)
  const openingOutstanding = input.recovery.openingOutstanding ?? Math.max(
    0,
    input.recovery.outstandingShortfall + baseRepaid - baseMarked,
  )
  const openingDate = input.recovery.openingOldestDate ?? input.recovery.recoveryFromDate ??
    baseMovements[0]?.date ?? projectedMovements[0]?.date
  const opening = { outstanding: openingOutstanding, oldestOutstandingDate: openingDate }
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
  const markedDelta = projectedReplay.markedThisRun - baseReplay.markedThisRun
  const outstandingShortfall = projectedReplay.outstanding
  const markedSinceFreshAttainment = projectedReplay.oldestMarkedThisRunDate
    ? projectedMovements
      .filter(movement => movement.marked && movement.date >= projectedReplay.oldestMarkedThisRunDate!)
      .reduce((sum, movement) => sum + Math.max(0, -movement.change), 0)
    : 0
  const markedTotal = outstandingShortfall <= 0
    ? 0
    : baseReplay.outstanding <= 0 && markedSinceFreshAttainment > 0
      ? markedSinceFreshAttainment
      : Math.max(0, input.recovery.markedTotal + markedDelta)
  const repaidTotal = outstandingShortfall > 0
    ? Math.max(0, markedTotal - outstandingShortfall)
    : 0
  const toppedUpThisCycle = Math.max(
    0,
    input.recovery.toppedUpThisCycle + projectedReplay.repaidThisRun - baseReplay.repaidThisRun,
  )
  const paceAnchor = outstandingShortfall + toppedUpThisCycle
  const lastDrawdownCycleKey = projectedReplay.markedThisRun > 0 && input.currentCycleKey
    ? input.currentCycleKey
    : input.recovery.lastDrawdownCycleKey
  const cyclesRemaining = cyclesFromAnchor(
    lastDrawdownCycleKey,
    input.currentCycleKey,
    3,
  )
  const requiredThisCycle = cyclesRemaining <= 1
    ? paceAnchor
    : Math.ceil((paceAnchor / cyclesRemaining) * 100) / 100

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
    cyclesRemaining,
    isOverdue: cyclesRemaining <= 0 && outstandingShortfall > 0,
    toppedUpThisCycle,
    requiredThisCycle,
    outstandingThisCycle: Math.max(
      0,
      Math.min(requiredThisCycle - toppedUpThisCycle, outstandingShortfall),
    ),
    isActive: outstandingShortfall > 0,
    recoveryFromDate: outstandingShortfall > 0 ? recoveryWindowStart(projectedReplay) : undefined,
  }
}
