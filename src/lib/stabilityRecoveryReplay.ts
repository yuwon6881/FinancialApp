import type {
  StabilityReloadIntent,
  StabilityReloadObligation,
  StabilityReloadStatus,
  Transaction,
} from '@/types'
import { bucketAmount } from './bucketAttribution'
import { compareIdsOrdinal } from './ordinalCompare'

// Re-exported so the replay's own consumers keep a single import path for the queue's shape.
export type { StabilityReloadObligation }

export interface StabilityReloadMovement {
  id?: string
  date: string
  postedAt?: string
  change: number
  repayment: number
  marked: boolean
}

export interface StabilityReloadPlanPoint {
  effectiveAt: string
  target: number
  stabilityAlloc?: number
}

export interface StabilityReloadReplay {
  outstanding: number
  oldestOutstandingDate?: string
  markedThisRun: number
  repaidThisRun: number
  /** FIFO attribution used only to hold each origin-cycle cohort's current requirement stable. */
  repaidByObligationThisRun: Record<string, number>
  /**
   * Retained after they are fully discharged so per-row status can still say "complete"; only the
   * two totals below drop them.
   */
  obligations: StabilityReloadObligation[]
  /**
   * What is still owed, counted per obligation rather than per movement. `openMarkedTotal` sums the
   * original amount of every obligation with money still owing and `openRepaidTotal` sums what has
   * gone back against those same obligations, so a drawdown put back in full leaves both figures
   * entirely. By construction `openMarkedTotal - openRepaidTotal === outstanding`: summing movements
   * instead let a settled drawdown keep inflating the reported total for as long as anything else
   * was owed.
   */
  openMarkedTotal: number
  openRepaidTotal: number
}

export const normalizeReloadIntent = (intent: string | null | undefined): StabilityReloadIntent =>
  intent === 'Required' || intent === 'NotRequired' ? intent : 'Unanswered'

export const isIncomeLedgerCategory = (ledgerCategory: string | null | undefined) => {
  const normalized = (ledgerCategory ?? '').toLowerCase()
  return normalized === 'income' || normalized.startsWith('incomesplit:')
}

/** Whether an actual ledger row reduced Stability and therefore carries the tri-state answer. */
export function isStabilityReloadDrawdown(transaction: Pick<Transaction, 'amount' | 'ledgerCategory' | 'isAccountBalanceAdjustment'>) {
  return transaction.isAccountBalanceAdjustment !== true && bucketAmount(transaction, 'Stability') < 0
}

/** Whether the form's current shape is a Stability drawdown that still needs an answer. */
export function isStabilityReloadFormDrawdown(input: {
  transactionType: string
  ledgerCategory: string
  transferSource: string
}) {
  return (input.transactionType === 'outflow' && input.ledgerCategory.toLowerCase() === 'stability') ||
    (input.transactionType === 'transfer' && input.transferSource.toLowerCase() === 'stability')
}

export function stabilityReloadIntentLabel(intent: string | null | undefined) {
  return normalizeReloadIntent(intent) === 'NotRequired' ? 'Spent for good' : 'Put back'
}

export function stabilityReloadStatusLabel(
  status: StabilityReloadStatus | null | undefined,
  intent: StabilityReloadIntent | null | undefined,
) {
  switch (status) {
    case 'PartlyRepaid':
      return 'Partly put back'
    case 'Complete':
      return 'Put back complete'
    case 'NotRequired':
      return 'Spent for good'
    case 'Outstanding':
      return 'Put back'
    default:
      return stabilityReloadIntentLabel(intent)
  }
}

export function describeReloadMovement(
  transaction: Transaction,
  stabilityAlloc: number,
  change = bucketAmount(transaction, 'Stability'),
): StabilityReloadMovement | null {
  if (change === 0) return null
  const normalSalaryShare = isIncomeLedgerCategory(transaction.ledgerCategory) && transaction.amount > 0
    ? Math.max(0, transaction.amount * stabilityAlloc)
    : 0
  return {
    id: String(transaction.id),
    date: transaction.date,
    postedAt: transaction.postedAt,
    change,
    repayment: transaction.isAccountBalanceAdjustment
      ? 0
      : change > 0
      ? isIncomeLedgerCategory(transaction.ledgerCategory) && transaction.stabilityRecoveryTopUpAmount != null
        ? Math.max(0, transaction.stabilityRecoveryTopUpAmount)
        : Math.max(0, change - normalSalaryShare)
      : 0,
    marked: transaction.isAccountBalanceAdjustment !== true
      && change < 0 && normalizeReloadIntent(transaction.stabilityReloadIntent) !== 'NotRequired',
  }
}

/**
 * Describes logical Stability movements in the same order as the server replay. Generated salary
 * children are grouped with their parent so ordinary salary allocation is not counted as a reload.
 */
export function describeStabilityReloadMovements(
  transactions: Transaction[],
  stabilityAlloc: number | ((transaction: Transaction) => number),
): StabilityReloadMovement[] {
  // Ordinal on the id tie-break, matching the server's StringComparer.Ordinal. This is FIFO
  // posting order, so a disagreement repays a different obligation first.
  const ordered = [...transactions].sort((left, right) =>
    compareIdsOrdinal(left.date, right.date) ||
    compareIdsOrdinal(left.postedAt ?? '', right.postedAt ?? '') ||
    compareIdsOrdinal(String(left.id), String(right.id)))
  const stabilityChildren = new Map(
    ordered
      .filter(transaction => String(transaction.id).endsWith('-split-Stability'))
      .map(transaction => [String(transaction.id).slice(0, -'-split-Stability'.length), transaction]),
  )
  const movements: StabilityReloadMovement[] = []
  for (const transaction of ordered) {
    if (String(transaction.id).includes('-split-')) continue
    const child = isIncomeLedgerCategory(transaction.ledgerCategory)
      ? stabilityChildren.get(String(transaction.id))
      : undefined
    const allocation = typeof stabilityAlloc === 'function'
      ? stabilityAlloc(transaction)
      : stabilityAlloc
    const movement = child
      ? describeReloadMovement(transaction, allocation, bucketAmount(child, 'Stability'))
      : describeReloadMovement(transaction, allocation)
    if (movement) movements.push(movement)
  }
  return movements
}

/** The ordered FIFO replay shared by the optimistic projection and the API ledger replay. */
export function replayStabilityReload(
  opening: {
    outstanding: number
    oldestOutstandingDate?: string
    obligations?: StabilityReloadObligation[]
  },
  openingBalance: number,
  target: number,
  movements: StabilityReloadMovement[],
  planPoints: StabilityReloadPlanPoint[] = [{
    effectiveAt: '1970-01-01T00:00:00.000Z',
    target,
  }],
): StabilityReloadReplay {
  const queue: { id?: string; date?: string; amount: number }[] = []
  const obligations = new Map<string, StabilityReloadObligation>()
  if (opening.obligations?.length) {
    for (const obligation of opening.obligations) {
      if (obligation.remainingAmount <= 0) continue
      queue.push({ id: obligation.transactionId, date: obligation.date, amount: obligation.remainingAmount })
      obligations.set(obligation.transactionId, { ...obligation })
    }
  } else if (opening.outstanding > 0) {
    queue.push({ date: opening.oldestOutstandingDate, amount: opening.outstanding })
  }

  const outstandingNow = () => queue.reduce((sum, entry) => sum + entry.amount, 0)

  let running = openingBalance
  let markedThisRun = 0
  let repaidThisRun = 0
  const repaidByObligationThisRun = new Map<string, number>()

  const points = (planPoints?.length ? [...planPoints] : [{
    effectiveAt: '1970-01-01T00:00:00.000Z',
    target,
  }]).sort((left, right) =>
    Date.parse(left.effectiveAt) - Date.parse(right.effectiveAt))
  let pointIndex = 0
  let activeTarget = points[0]?.target ?? target

  const timestampOf = (movement: StabilityReloadMovement) => {
    const parsed = Date.parse(movement.postedAt || `${movement.date}T00:00:00.000Z`)
    return Number.isFinite(parsed) ? parsed : 0
  }

  const sortedMovements = movements
    .map((movement, index) => ({ movement, timestamp: timestampOf(movement), index }))
    .sort((a, b) => a.timestamp !== b.timestamp ? a.timestamp - b.timestamp : a.index - b.index)

  const clearAtTarget = () => {
    for (const entry of queue) {
      if (!entry.id) continue
      const obligation = obligations.get(entry.id)
      if (obligation) obligations.set(entry.id, { ...obligation, remainingAmount: 0 })
    }
    queue.length = 0
    // Attainment settles everything: nothing is owed, so nothing is reported as owed. Only
    // markedThisRun survives, as an audit total of what left the fund during this run.
    repaidThisRun = 0
    repaidByObligationThisRun.clear()
  }

  const applyPlanPoint = (point: StabilityReloadPlanPoint) => {
    activeTarget = point.target
    if (activeTarget > 0 && running >= activeTarget) clearAtTarget()
  }

  const applyPlanPointsThrough = (timestamp: number) => {
    while (pointIndex < points.length) {
      const pointTimestamp = Date.parse(points[pointIndex].effectiveAt)
      if (Number.isFinite(pointTimestamp) && pointTimestamp > timestamp) break
      applyPlanPoint(points[pointIndex])
      pointIndex += 1
    }
  }

  if (sortedMovements.length === 0) {
    while (pointIndex < points.length) {
      applyPlanPoint(points[pointIndex])
      pointIndex += 1
    }
  } else {
    for (const { movement, timestamp } of sortedMovements) {
      applyPlanPointsThrough(timestamp)
      running += movement.change

      if (movement.marked && movement.change < 0) {
        const marked = -movement.change
        markedThisRun += marked
        queue.push({ id: movement.id, date: movement.date, amount: marked })
        if (movement.id) {
          obligations.set(movement.id, {
            transactionId: movement.id,
            originalAmount: marked,
            remainingAmount: marked,
            date: movement.date,
          })
        }
      }

      const repayment = Math.min(outstandingNow(), Math.max(0, movement.repayment))
      if (repayment > 0) {
        let remaining = repayment
        while (remaining > 0 && queue.length > 0) {
          const oldest = queue.shift()!
          const discharged = Math.min(oldest.amount, remaining)
          remaining -= discharged
          const left = oldest.amount - discharged
          if (oldest.id) {
            const obligation = obligations.get(oldest.id)
            if (obligation) obligations.set(oldest.id, {
              ...obligation,
              remainingAmount: Math.max(0, obligation.remainingAmount - discharged),
            })
            repaidByObligationThisRun.set(
              oldest.id,
              (repaidByObligationThisRun.get(oldest.id) ?? 0) + discharged,
            )
          }
          if (left > 0) queue.unshift({ ...oldest, amount: left })
        }
        repaidThisRun += repayment
      }

      if (activeTarget > 0 && running >= activeTarget) {
        clearAtTarget()
      }
    }

    while (pointIndex < points.length) {
      applyPlanPoint(points[pointIndex])
      pointIndex += 1
    }
  }

  // Only obligations that still owe money are reported. An anonymous carried entry has no original
  // amount to compare against, so its remaining amount is all it can contribute -- that entry
  // shrinks as it is discharged, which keeps the difference equal to what is outstanding.
  let openMarkedTotal = 0
  let openRepaidTotal = 0
  for (const obligation of obligations.values()) {
    if (obligation.remainingAmount <= 0) continue
    // Taking the larger of the two as the original keeps the difference equal to what is still owed
    // even for a malformed carried entry claiming more remaining than original.
    const original = Math.max(obligation.originalAmount, obligation.remainingAmount)
    openMarkedTotal += original
    openRepaidTotal += original - obligation.remainingAmount
  }
  for (const entry of queue) {
    if (!entry.id) openMarkedTotal += entry.amount
  }

  return {
    outstanding: outstandingNow(),
    oldestOutstandingDate: queue[0]?.date,
    markedThisRun,
    repaidThisRun,
    repaidByObligationThisRun: Object.fromEntries(repaidByObligationThisRun),
    // Map iteration is insertion/FIFO order. The server's cycle cache carries open entries in this
    // exact order; sorting by id swaps same-day withdrawals and completes the wrong Ledger row.
    obligations: [...obligations.values()],
    openMarkedTotal,
    openRepaidTotal,
  }
}

export function buildStabilityPlanPoints(
  baseTarget: number,
  baseStabilityAlloc: number,
  operations: Array<{
    createdAt: number
    payload?: {
      targetStabilityFund?: unknown
      stabilityAlloc?: unknown
    }
  }>,
): StabilityReloadPlanPoint[] {
  const points: StabilityReloadPlanPoint[] = [{
    effectiveAt: '1970-01-01T00:00:00.000Z',
    target: baseTarget,
    stabilityAlloc: baseStabilityAlloc,
  }]
  let target = baseTarget
  let stabilityAlloc = baseStabilityAlloc
  for (const operation of [...operations].sort((left, right) => left.createdAt - right.createdAt)) {
    const nextTarget = typeof operation.payload?.targetStabilityFund === 'number'
      ? operation.payload.targetStabilityFund
      : target
    const nextAlloc = typeof operation.payload?.stabilityAlloc === 'number'
      ? operation.payload.stabilityAlloc
      : stabilityAlloc
    if (nextTarget === target && nextAlloc === stabilityAlloc) continue
    target = nextTarget
    stabilityAlloc = nextAlloc
    points.push({
      effectiveAt: new Date(operation.createdAt).toISOString(),
      target,
      stabilityAlloc,
    })
  }
  return points
}
