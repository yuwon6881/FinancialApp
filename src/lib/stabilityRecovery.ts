// Emergency-fund recovery: how much of what left the fund to ask back, and how much of a given
// pay packet can safely provide it.
//
// Mirrors `Services/Stability/StabilityRecoveryPlanner.cs` the same way `savingsGoals.ts` mirrors
// `SavingsGoalPacing.cs`. The server owns the pace (it can see the fund's whole history); this
// module owns only the part that has to answer while the user types an amount, and the server
// re-derives the split authoritatively on save.

import type { StabilityRecovery, StabilityReloadIntent, Transaction } from '@/types'
import { bucketAmount } from './bucketAttribution'

export interface StabilityReloadMovement {
  date: string
  change: number
  repayment: number
  marked: boolean
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
    date: transaction.date,
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
  stabilityAlloc: number,
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
    const movement = child
      ? describeReloadMovement(transaction, stabilityAlloc, bucketAmount(child, 'Stability'))
      : describeReloadMovement(transaction, stabilityAlloc)
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
  opening: { outstanding: number; oldestOutstandingDate?: string },
  openingBalance: number,
  target: number,
  movements: StabilityReloadMovement[],
): StabilityReloadReplay {
  const queue: { date: string; amount: number }[] = []
  let outstanding = Math.max(0, opening.outstanding)
  if (outstanding > 0 && opening.oldestOutstandingDate) {
    queue.push({ date: opening.oldestOutstandingDate, amount: outstanding })
  }

  let running = openingBalance
  let markedThisRun = 0
  let repaidThisRun = 0

  const clearAtTarget = () => {
    queue.length = 0
    outstanding = 0
    // Attainment starts a clean pace window. A later same-cycle drawdown must not inherit the
    // repayment that helped reach the target.
    repaidThisRun = 0
  }

  if (target > 0 && running >= target) {
    clearAtTarget()
  }

  for (const movement of movements) {
    running += movement.change

    if (movement.marked && movement.change < 0) {
      const marked = -movement.change
      markedThisRun += marked
      outstanding += marked
      queue.push({ date: movement.date, amount: marked })
    }

    const repayment = Math.min(outstanding, Math.max(0, movement.repayment))
    if (repayment > 0) {
      let remaining = repayment
      while (remaining > 0 && queue.length > 0) {
        const oldest = queue.shift()!
        const discharged = Math.min(oldest.amount, remaining)
        remaining -= discharged
        const left = oldest.amount - discharged
        if (left > 0) queue.unshift({ date: oldest.date, amount: left })
      }
      outstanding -= repayment
      repaidThisRun += repayment
    }

    if (target > 0 && running >= target) {
      clearAtTarget()
    }
  }

  return {
    outstanding: Math.max(0, outstanding),
    oldestOutstandingDate: queue[0]?.date,
    markedThisRun,
    repaidThisRun,
  }
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
}): StabilityRecovery {
  const baseMovements = describeStabilityReloadMovements(input.baseTransactions, input.stabilityAlloc)
  const projectedMovements = describeStabilityReloadMovements(input.projectedTransactions, input.stabilityAlloc)
  const baseMarked = baseMovements.reduce(
    (sum, movement) => sum + (movement.marked ? Math.max(0, -movement.change) : 0), 0)
  const baseRepaid = baseMovements.reduce((sum, movement) => sum + movement.repayment, 0)
  const openingOutstanding = Math.max(
    0,
    input.recovery.outstandingShortfall + baseRepaid - baseMarked,
  )
  const openingDate = input.recovery.recoveryFromDate ??
    baseMovements[0]?.date ?? projectedMovements[0]?.date
  const opening = { outstanding: openingOutstanding, oldestOutstandingDate: openingDate }
  const baseNetChange = baseMovements.reduce((sum, movement) => sum + movement.change, 0)
  const projectedNetChange = projectedMovements.reduce((sum, movement) => sum + movement.change, 0)
  const baseReplay = replayStabilityReload(
    opening,
    input.recovery.currentBalance - baseNetChange,
    input.recovery.target,
    baseMovements,
  )
  const projectedReplay = replayStabilityReload(
    opening,
    input.projectedBalance - projectedNetChange,
    input.recovery.target,
    projectedMovements,
  )
  const markedDelta = projectedReplay.markedThisRun - baseReplay.markedThisRun
  const outstandingShortfall = projectedReplay.outstanding
  const markedTotal = outstandingShortfall > 0
    ? Math.max(0, input.recovery.markedTotal + markedDelta)
    : 0
  const repaidTotal = outstandingShortfall > 0
    ? Math.max(0, markedTotal - outstandingShortfall)
    : 0
  const toppedUpThisCycle = Math.max(
    0,
    input.recovery.toppedUpThisCycle + projectedReplay.repaidThisRun - baseReplay.repaidThisRun,
  )
  const paceAnchor = outstandingShortfall + toppedUpThisCycle
  const requiredThisCycle = input.recovery.cyclesRemaining <= 1
    ? paceAnchor
    : Math.ceil((paceAnchor / input.recovery.cyclesRemaining) * 100) / 100

  return {
    ...input.recovery,
    markedTotal,
    repaidTotal,
    currentBalance: input.projectedBalance,
    outstandingShortfall,
    toppedUpThisCycle,
    requiredThisCycle,
    outstandingThisCycle: Math.max(
      0,
      Math.min(requiredThisCycle - toppedUpThisCycle, outstandingShortfall),
    ),
    isActive: outstandingShortfall > 0,
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
  const remainingAfterNormal = Math.max(
    0,
    recovery.outstandingShortfall - normalStabilityContribution
  )
  if (remainingAfterNormal <= 0) return null
  const requestedTopUp = Math.min(recovery.outstandingThisCycle, remainingAfterNormal, affordable)

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
  safeCap = Math.max(0, floorToCent(Math.min(safeCap, remainingAfterNormal)))
  const maxTopUp = Math.max(0, floorToCent(Math.min(remainingAfterNormal, affordable)))

  // Clear the whole thing in one go when it is small enough that spreading it is busywork: no
  // bigger than the share this pay packet was sending the fund anyway, and still inside the safe
  // cap. Measuring against the usual share rather than against the safe cap matters — with no
  // bills recorded the safe cap is nearly the whole salary, and a 3,000 raid would default to
  // being cleared at once. The spread exists for exactly that case; a 70 dip does not need it.
  const trivialRemainder = incomeAmount * stabilityAlloc
  const wholeShortfallFits =
    remainingAfterNormal <= safeCap && remainingAfterNormal <= trivialRemainder
  const proposedTopUp = wholeShortfallFits
    ? Math.max(0, floorToCent(remainingAfterNormal))
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
