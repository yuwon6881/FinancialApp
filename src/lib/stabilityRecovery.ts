// Emergency-fund recovery: how much of what left the fund to ask back, and how much of a given
// pay packet can safely provide it.
//
// Mirrors `Services/Stability/StabilityRecoveryPlanner.cs` the same way `savingsGoals.ts` mirrors
// `SavingsGoalPacing.cs`. The server owns the pace (it can see the fund's whole history); this
// module owns only the part that has to answer while the user types an amount, and the server
// re-derives the split authoritatively on save.

import type { StabilityRecovery, StabilityReloadIntent, StabilityReloadStatus, Transaction } from '@/types'
import { bucketAmount } from './bucketAttribution'

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

export interface StabilityReloadObligation {
  transactionId: string
  originalAmount: number
  remainingAmount: number
}

export interface StabilityReloadSummary {
  markedAmount: number
  repaidAmount: number
}

export interface StabilityReloadReplay {
  outstanding: number
  oldestOutstandingDate?: string
  markedThisRun: number
  repaidThisRun: number
  oldestMarkedThisRunDate?: string
  obligations: StabilityReloadObligation[]
}

const normalizeReloadIntent = (intent: string | null | undefined): StabilityReloadIntent =>
  intent === 'Required' || intent === 'NotRequired' ? intent : 'Unanswered'

const isIncomeLedgerCategory = (ledgerCategory: string | null | undefined) => {
  const normalized = (ledgerCategory ?? '').toLowerCase()
  return normalized === 'income' || normalized.startsWith('incomesplit:')
}

/** Whether an actual ledger row reduced Stability and therefore carries the tri-state answer. */
export function isStabilityReloadDrawdown(transaction: Pick<Transaction, 'amount' | 'ledgerCategory'>) {
  return bucketAmount(transaction, 'Stability') < 0
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

function describeReloadMovement(
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
    repayment: change > 0
      ? isIncomeLedgerCategory(transaction.ledgerCategory) && transaction.stabilityRecoveryTopUpAmount != null
        ? Math.max(0, transaction.stabilityRecoveryTopUpAmount)
        : Math.max(0, change - normalSalaryShare)
      : 0,
    marked: change < 0 && normalizeReloadIntent(transaction.stabilityReloadIntent) !== 'NotRequired',
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
  const ordered = [...transactions].sort((left, right) =>
    left.date.localeCompare(right.date) ||
    (left.postedAt ?? '').localeCompare(right.postedAt ?? '') ||
    String(left.id).localeCompare(String(right.id)))
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

export function summarizeStabilityReload(
  transactions: Transaction[],
  stabilityAlloc: number,
): StabilityReloadSummary {
  return describeStabilityReloadMovements(transactions, stabilityAlloc).reduce(
    (summary, movement) => ({
      markedAmount: summary.markedAmount + (movement.marked ? Math.max(0, -movement.change) : 0),
      repaidAmount: summary.repaidAmount + movement.repayment,
    }),
    { markedAmount: 0, repaidAmount: 0 },
  )
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
  // The obligation is the queue and nothing else -- see the matching comment in
  // StabilityReloadLedger.Replay. Tracking a separate running total let a carried obligation with
  // no carried date leave the queue empty while the total stayed positive, and every repayment
  // after that debited one and not the other.
  const queue: { id?: string; date?: string; amount: number }[] = []
  const obligations = new Map<string, StabilityReloadObligation>()
  if (opening.obligations?.length) {
    for (const obligation of opening.obligations) {
      if (obligation.remainingAmount <= 0) continue
      queue.push({ id: obligation.transactionId, amount: obligation.remainingAmount })
      obligations.set(obligation.transactionId, { ...obligation })
    }
  } else if (opening.outstanding > 0) {
    queue.push({ date: opening.oldestOutstandingDate, amount: opening.outstanding })
  }

  const outstandingNow = () => queue.reduce((sum, entry) => sum + entry.amount, 0)

  let running = openingBalance
  let markedThisRun = 0
  let repaidThisRun = 0
  let oldestMarkedThisRunDate: string | undefined

  const points = [...planPoints].sort((left, right) =>
    Date.parse(left.effectiveAt) - Date.parse(right.effectiveAt))
  let pointIndex = 0
  let activeTarget = points[0]?.target ?? target

  const timestampOf = (movement: StabilityReloadMovement) => {
    const parsed = Date.parse(movement.postedAt || `${movement.date}T00:00:00.000Z`)
    return Number.isFinite(parsed) ? parsed : 0
  }

  const clearAtTarget = () => {
    for (const entry of queue) {
      if (!entry.id) continue
      const obligation = obligations.get(entry.id)
      if (obligation) obligations.set(entry.id, { ...obligation, remainingAmount: 0 })
    }
    queue.length = 0
    // Attainment starts a clean pace window. A later same-cycle drawdown must not inherit the
    // repayment that helped reach the target.
    repaidThisRun = 0
    oldestMarkedThisRunDate = undefined
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

  for (const movement of movements) {
    applyPlanPointsThrough(timestampOf(movement))
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
        })
      }
      if (!oldestMarkedThisRunDate || movement.date < oldestMarkedThisRunDate) {
        oldestMarkedThisRunDate = movement.date
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

  return {
    outstanding: outstandingNow(),
    oldestOutstandingDate: queue[0]?.date,
    markedThisRun,
    repaidThisRun,
    oldestMarkedThisRunDate,
    obligations: [...obligations.values()].sort((left, right) =>
      left.transactionId.localeCompare(right.transactionId)),
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
  // New payloads carry the authoritative opening queue. The arithmetic fallback keeps cached
  // payloads from before that contract readable, but cannot invert a repayment that happened
  // before the first marked drawdown; only the server's opening state makes that case exact.
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

  return {
    ...input.recovery,
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

export interface RecoveryBucketState {
  bucket: string
  /** Share of income this bucket receives, as a fraction of 1. */
  alloc: number
  balance: number
  /** Money this cycle has already promised: bills for Essentials, savings goals for Rewards. */
  committed: number
}

export interface RecoveryDraw {
  bucket: string
  share: number
  amount: number
}

export interface RecoveryOffer {
  /** What the cycle's pace asked for, before any cap. */
  requestedTopUp: number
  /**
   * The amount the offer starts on. The **whole** remaining shortfall when this pay packet can
   * absorb it without touching committed money, otherwise just this cycle's share. Spreading a
   * small dip over three instalments is busywork; spreading a real raid is the point.
   */
  proposedTopUp: number
  /**
   * The most the user may raise the amount to: the whole shortfall, bounded by what the three
   * buckets actually receive. Above `safeCap` but at or below this is a deliberate choice, so it
   * is allowed and warned about rather than blocked.
   */
  maxTopUp: number
  /** The largest amount that still clears every bucket's committed money. */
  safeCap: number
  /** True when committed money held the default below what the pace asked for. */
  isReduced: boolean
  /** Which bucket's committed money bound the default, if any. */
  limitedBy?: string
  draws: RecoveryDraw[]
}

const floorToCent = (value: number) => Math.floor(value * 100) / 100

/**
 * Splits an amount across the contributing buckets by their configured share, pushing the rounding
 * remainder onto the largest draw so the parts sum to the whole exactly.
 */
export function drawsFor(amount: number, buckets: RecoveryBucketState[]): RecoveryDraw[] {
  const contributing = buckets.filter(bucket => bucket.alloc > 0)
  const allocTotal = contributing.reduce((sum, bucket) => sum + bucket.alloc, 0)
  if (allocTotal <= 0 || amount <= 0) return []

  const draws = contributing.map(bucket => ({
    bucket: bucket.bucket,
    share: bucket.alloc / allocTotal,
    amount: floorToCent((amount * bucket.alloc) / allocTotal),
  }))

  const remainder = amount - draws.reduce((sum, draw) => sum + draw.amount, 0)
  if (remainder !== 0) {
    let largest = 0
    for (let i = 1; i < draws.length; i += 1) {
      if (draws[i].amount > draws[largest].amount) largest = i
    }
    draws[largest] = { ...draws[largest], amount: draws[largest].amount + remainder }
  }
  return draws
}

/** Whether there is a live recovery to talk about at all. */
export function isRecoveryActive(recovery: StabilityRecovery | undefined): recovery is StabilityRecovery {
  return Boolean(recovery?.isActive) && (recovery?.outstandingShortfall ?? 0) > 0
}

/**
 * How much of `incomeAmount` can go back into the fund on top of its usual share, and where it
 * comes from.
 *
 * The draw is proportional to the three buckets' configured shares, so no single pot takes the
 * whole hit. It is then held below every bucket's committed money — refilling a buffer with the
 * rent, or with money a savings goal is already pacing toward, just moves the problem.
 */
export function proposeTopUp(
  recovery: StabilityRecovery | undefined,
  incomeAmount: number,
  buckets: RecoveryBucketState[],
  /** The fund's usual share of income, used to judge whether the remainder is worth spreading. */
  stabilityAlloc = 0
): RecoveryOffer | null {
  if (!isRecoveryActive(recovery)) return null
  if (!Number.isFinite(incomeAmount) || incomeAmount <= 0) return null
  if (recovery.outstandingThisCycle <= 0) return null

  const contributing = buckets.filter(bucket => bucket.alloc > 0)
  const allocTotal = contributing.reduce((sum, bucket) => sum + bucket.alloc, 0)
  if (allocTotal <= 0) return null

  // Nothing can come out of money the three buckets never receive, whatever the user asks for.
  const affordable = incomeAmount * allocTotal
  const normalStabilityContribution = incomeAmount * Math.max(0, stabilityAlloc)
  const roomAfterNormal = recovery.target > 0
    ? Math.max(0, recovery.target - recovery.currentBalance - normalStabilityContribution)
    : Number.POSITIVE_INFINITY
  // Ordinary salary clears the queue only through actual target attainment. Below the target it
  // does not reduce the explicit obligation or the amount the opted-in extra may repay.
  if (recovery.target > 0 && roomAfterNormal <= 0) return null
  const reloadCapacity = Math.min(recovery.outstandingShortfall, affordable, roomAfterNormal)
  if (reloadCapacity <= 0) return null
  const requestedTopUp = Math.min(recovery.outstandingThisCycle, reloadCapacity)

  // The largest amount that still leaves every bucket its committed money.
  let safeCap = affordable
  let limitedBy: string | undefined
  for (const bucket of contributing) {
    const headroom = Math.max(0, bucket.balance + incomeAmount * bucket.alloc - bucket.committed)
    const bucketCap = (headroom * allocTotal) / bucket.alloc
    if (bucketCap < safeCap) {
      safeCap = bucketCap
      limitedBy = bucket.bucket
    }
  }

  // Floored, not rounded up: these are ceilings on how much may be moved, and rounding a ceiling
  // up breaks the invariant it exists to protect.
  safeCap = Math.max(0, floorToCent(Math.min(safeCap, reloadCapacity)))
  const maxTopUp = Math.max(0, floorToCent(reloadCapacity))

  // Clear the whole thing in one go when it is small enough that spreading it is busywork: no
  // bigger than the share this pay packet was sending the fund anyway, and still inside the safe
  // cap. Measuring against the usual share rather than against the safe cap matters — with no
  // bills recorded the safe cap is nearly the whole salary, and a 3,000 raid would default to
  // being cleared at once. The spread exists for exactly that case; a 70 dip does not need it.
  const trivialRemainder = incomeAmount * stabilityAlloc
  const wholeShortfallFits =
    reloadCapacity === recovery.outstandingShortfall &&
    reloadCapacity <= safeCap && reloadCapacity <= trivialRemainder
  const proposedTopUp = wholeShortfallFits
    ? Math.max(0, floorToCent(reloadCapacity))
    : Math.min(safeCap, Math.max(0, floorToCent(requestedTopUp)))

  const isReduced = !wholeShortfallFits && proposedTopUp < requestedTopUp
  if (maxTopUp <= 0) {
    return { requestedTopUp, proposedTopUp: 0, maxTopUp: 0, safeCap, isReduced, limitedBy, draws: [] }
  }

  return {
    requestedTopUp,
    proposedTopUp,
    maxTopUp,
    safeCap,
    isReduced,
    limitedBy,
    draws: drawsFor(proposedTopUp, buckets),
  }
}
