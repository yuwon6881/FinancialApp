import type { Loan, RecurringPayment } from '../types'
import { expandBulkTransactionProjection, type QueuedOp } from './outbox'
import { replayLoan, type LoanPaymentInput } from './loanMath'
import { countLoanPaymentsThrough } from './loanTermSchedule'

/**
 * Replays every queued operation that can change a loan's linked history. The server snapshot
 * contains only recorded payments, so transaction edits/restores and discarded occurrences must
 * be converted back into the same pure inputs before the shared replay runs.
 */
export function projectLoanStates(
  loans: Loan[],
  ops: QueuedOp[],
  recurringPayments: RecurringPayment[] = [],
): Loan[] {
  const orderedOps = expandBulkTransactionProjection(ops)
    .sort((left, right) => left.createdAt - right.createdAt)
  const recurringPaymentsById = new Map(recurringPayments.map(payment => [payment.id, payment]))
  const opsByLoanId = new Map<string, QueuedOp[]>()
  const opsByPaymentId = new Map<string, QueuedOp[]>()
  const addIndexed = (index: Map<string, QueuedOp[]>, key: string | undefined, op: QueuedOp) => {
    if (!key) return
    const entries = index.get(key)
    if (entries) entries.push(op)
    else index.set(key, [op])
  }

  for (const op of orderedOps) {
    if (op.entity === 'loan') {
      // undoRepayment's targetId is a repayment-action id, so it is indexed by the loan id its
      // payload carries; every other loan op targets the loan directly.
      addIndexed(
        opsByLoanId,
        op.type === 'undoRepayment' && typeof op.payload?.loanId === 'string' ? op.payload.loanId : op.targetId,
        op,
      )
      continue
    }
    if (op.entity === 'recurringPayment') {
      addIndexed(opsByPaymentId, op.targetId, op)
      continue
    }
    if (op.entity === 'recurringOccurrence' && op.type === 'settle') {
      addIndexed(
        opsByPaymentId,
        typeof op.payload?.recurringPaymentId === 'string' ? op.payload.recurringPaymentId : undefined,
        op,
      )
      continue
    }
    if (op.entity !== 'transaction' || !['add', 'update', 'delete'].includes(op.type)) continue
    const before = getTransactionBefore(op)
    const after = getTransactionAfter(op, before)
    const paymentIds = new Set<string>()
    if (typeof before?.recurringPaymentId === 'string') paymentIds.add(before.recurringPaymentId)
    if (typeof after?.recurringPaymentId === 'string') paymentIds.add(after.recurringPaymentId)
    for (const paymentId of paymentIds) addIndexed(opsByPaymentId, paymentId, op)
  }

  return loans.map(loan => projectLoan(
    loan,
    opsByLoanId.get(loan.id) ?? [],
    opsByPaymentId,
    recurringPaymentsById,
  ))
}

function projectLoan(
  loan: Loan,
  loanOps: QueuedOp[],
  opsByPaymentId: ReadonlyMap<string, QueuedOp[]>,
  recurringPaymentsById: ReadonlyMap<string, RecurringPayment>,
): Loan {
  const projectedLoan = { ...loan }
  const paymentIds = new Set<string>()
  if (loan.recurringPaymentId) paymentIds.add(loan.recurringPaymentId)
  for (const op of loanOps) {
    if (typeof op.payload?.recurringPaymentId === 'string') paymentIds.add(op.payload.recurringPaymentId)
  }
  const ops = [
    ...loanOps,
    ...[...paymentIds].flatMap(paymentId => opsByPaymentId.get(paymentId) ?? []),
  ].sort((left, right) => left.createdAt - right.createdAt)
  const linkedPayment = loan.recurringPaymentId
    ? recurringPaymentsById.get(loan.recurringPaymentId)
    : undefined
  const inputs: LoanPaymentInput[] = loan.snapshot.payments.map(payment => ({
    occurrenceDate: payment.occurrenceDate,
    postedAt: '',
    amount: payment.payment,
    transactionId: payment.transactionId,
  }))
  let hadPendingEffect = false
  let firstPendingEffectId: string | undefined
  let settledByPayoff = false

  applyPaymentMetadata(projectedLoan, linkedPayment)

  for (const op of ops) {
    if (op.entity === 'recurringPayment' && op.targetId === loan.recurringPaymentId) {
      applyRecurringPaymentOp(projectedLoan, op)
      if (!op.isCompleted) {
        hadPendingEffect = true
        firstPendingEffectId ??= op.id
      }
      continue
    }

    if (op.entity === 'loan' && op.type === 'undoRepayment') {
      // The server re-derives the whole schedule, which no client replay can anticipate, so this only
      // reports that the loan is mid-change until the post-sync refresh lands.
      if (!op.isCompleted) {
        hadPendingEffect = true
        firstPendingEffectId ??= op.id
      }
      continue
    }

    if (op.entity === 'loan' && op.targetId === loan.id) {
      if (op.type === 'fullSettlement') {
        settledByPayoff = true
      } else if (op.type === 'advanceRepayment') {
        // The server writes one transaction per cycle at the scheduled amount, tagged to that
        // instalment's occurrence date. Adding those as replay inputs means the shared engine works
        // out the split and the resulting balance exactly as the server's replay will.
        const cycles = typeof op.payload?.cycles === 'number' ? op.payload.cycles : 0
        for (const entry of loan.snapshot.futureSchedule.slice(0, Math.max(0, cycles))) {
          if (hasInput(inputs, entry.occurrenceDate, undefined)) continue
          inputs.push({
            occurrenceDate: entry.occurrenceDate,
            postedAt: new Date(op.createdAt).toISOString(),
            amount: entry.payment,
            transactionId: `${op.id}-advance-${entry.occurrenceDate}`,
          })
        }
      } else {
        applyLoanOp(projectedLoan, op, recurringPaymentsById)
      }
      if (!op.isCompleted) {
        hadPendingEffect = true
        firstPendingEffectId ??= op.id
      }
      continue
    }

    if (op.entity === 'recurringOccurrence' && op.type === 'settle'
      && op.payload?.recurringPaymentId === loan.recurringPaymentId) {
      const occurrenceDate = getOccurrenceDate(op)
      if (!occurrenceDate) continue
      const transaction = getTransactionSnapshot(op)
      const snapshot = op.payload?.status === 'Discarded'
        ? { ...(transaction ?? {}), ledgerCategory: 'Discarded', amount: 0 }
        : transaction
      if (!hasInput(inputs, occurrenceDate, snapshot)) {
        addInput(inputs, occurrenceDate, snapshot, op)
      }
      if (!op.isCompleted) {
        hadPendingEffect = true
        firstPendingEffectId ??= op.id
      }
      continue
    }

    if (op.entity !== 'transaction' || !['add', 'update', 'delete'].includes(op.type)) continue
    const before = getTransactionBefore(op)
    const after = getTransactionAfter(op, before)
    if (!belongsToLoan(before, loan.recurringPaymentId) && !belongsToLoan(after, loan.recurringPaymentId)) continue

    if (op.type === 'delete' || op.type === 'update') {
      if (belongsToLoan(before, loan.recurringPaymentId)) removeInput(inputs, before)
    }
    if (op.type === 'add' || op.type === 'update') {
      if (belongsToLoan(after, loan.recurringPaymentId)) addInputFromSnapshot(inputs, after, op)
    }
    if (!op.isCompleted) {
      hadPendingEffect = true
      firstPendingEffectId ??= op.id
    }
  }

  const replayed = replayLoan(projectedLoan, undefined, inputs)
  // Applied after the replay: a payoff is not a scheduled payment, so no replay of recorded
  // instalments can produce it. The bill stops with the loan, so the card must also stop advertising
  // a next due date.
  const snapshot = settledByPayoff
    ? { ...replayed, outstandingBalance: 0, nextPayment: null, futureSchedule: [] }
    : replayed
  if (settledByPayoff) projectedLoan.recurringPaymentExists = false
  return {
    ...projectedLoan,
    snapshot,
    isPendingSync: hadPendingEffect || loan.isPendingSync,
    pendingSyncOperationId: firstPendingEffectId ?? loan.pendingSyncOperationId,
  }
}

function applyPaymentMetadata(loan: Loan, payment: RecurringPayment | undefined) {
  if (!payment || payment.isPendingDelete) return
  loan.recurringPaymentExists = true
  loan.recurringPaymentName = payment.name
  loan.recurringPaymentFrequency = payment.frequency
  loan.recurringPaymentDueDate = payment.dueDate
  loan.recurringPaymentLedgerCategory = payment.ledgerCategory
}

function applyRecurringPaymentOp(loan: Loan, op: QueuedOp) {
  if (op.type === 'delete') {
    loan.recurringPaymentExists = false
    loan.scheduleStatus = 'Incomplete'
    return
  }
  if (op.type !== 'add' && op.type !== 'update') return
  loan.recurringPaymentExists = true
  if (typeof op.payload?.name === 'string') loan.recurringPaymentName = op.payload.name
  if (op.payload?.frequency === 'Monthly' || op.payload?.frequency === 'Annually') {
    loan.recurringPaymentFrequency = op.payload.frequency
  }
  if (typeof op.payload?.dueDate === 'number') loan.recurringPaymentDueDate = op.payload.dueDate
  if (typeof op.payload?.endDate === 'string') {
    const count = countLoanPaymentsThrough(loan, op.payload.endDate)
    if (count != null) loan.termPeriods = count
  }
}

function applyLoanOp(
  loan: Loan,
  op: QueuedOp,
  recurringPaymentsById: ReadonlyMap<string, RecurringPayment>,
) {
  if (op.type === 'delete') return
  // Repayments are handled in projectLoan: they need the replay inputs, or to run after the replay.
  // undoRepayment targets a repayment action id rather than a loan id, so it never matches here at
  // all; its effect arrives with the post-sync refresh.
  if (op.type !== 'add' && op.type !== 'update') return
  const payload = op.payload
  const previousPaymentId = loan.recurringPaymentId
  if (typeof payload?.name === 'string') loan.name = payload.name
  if (typeof payload?.openingPrincipal === 'number') loan.openingPrincipal = payload.openingPrincipal
  if (typeof payload?.trackingStartDate === 'string') loan.trackingStartDate = payload.trackingStartDate
  if (typeof payload?.annualRatePercent === 'number') loan.annualRatePercent = payload.annualRatePercent
  if (typeof payload?.termPeriods === 'number') loan.termPeriods = payload.termPeriods
  if (payload?.interestMethod === 'ReducingBalance'
    || payload?.interestMethod === 'ReducingBalanceDaily'
    || payload?.interestMethod === 'Flat'
    || payload?.interestMethod === 'InterestOnly') {
    loan.interestMethod = payload.interestMethod
  }
  if (payload?.rateBasis === 'Yearly' || payload?.rateBasis === 'Monthly') {
    loan.rateBasis = payload.rateBasis
  }
  if (payload?.scheduleFrequency === 'Monthly' || payload?.scheduleFrequency === 'Annually') {
    loan.scheduleFrequency = payload.scheduleFrequency
  }
  if (typeof payload?.scheduleDueDay === 'number') loan.scheduleDueDay = payload.scheduleDueDay
  if (typeof payload?.scheduleStartDate === 'string') loan.scheduleStartDate = payload.scheduleStartDate
  if (typeof payload?.recurringPaymentId === 'string') loan.recurringPaymentId = payload.recurringPaymentId
  if (payload?.scheduleStatus === 'Complete' || payload?.scheduleStatus === 'Incomplete') {
    loan.scheduleStatus = payload.scheduleStatus
  }
  const linkedPayment = loan.recurringPaymentId
    ? recurringPaymentsById.get(loan.recurringPaymentId)
    : undefined
  if (linkedPayment && loan.recurringPaymentId !== previousPaymentId) {
    loan.recurringPaymentExists = true
    loan.recurringPaymentName = linkedPayment.name
    loan.recurringPaymentFrequency = linkedPayment.frequency
    loan.recurringPaymentDueDate = linkedPayment.dueDate
    loan.recurringPaymentLedgerCategory = linkedPayment.ledgerCategory
    loan.isRecalculating = true
  }
  if (payload?.isRecalculating === true) loan.isRecalculating = true
  if (op.type === 'add' && !loan.scheduleFrequency && linkedPayment) {
    loan.scheduleFrequency = linkedPayment.frequency
    loan.scheduleDueDay = linkedPayment.dueDate
    loan.scheduleStartDate = linkedPayment.startDate
    loan.scheduleStatus = 'Complete'
  }
}

function belongsToLoan(snapshot: Record<string, unknown> | undefined, recurringPaymentId: string) {
  return snapshot?.recurringPaymentId === recurringPaymentId
}

function getOccurrenceDate(op: QueuedOp) {
  if (typeof op.payload?.occurrenceDate === 'string') return op.payload.occurrenceDate
  if (typeof op.payload?.settledOccurrenceDate === 'string') return op.payload.settledOccurrenceDate
  const snapshot = getTransactionSnapshot(op)
  return typeof snapshot?.recurringOccurrenceDate === 'string' ? snapshot.recurringOccurrenceDate : undefined
}

function getTransactionBefore(op: QueuedOp): Record<string, unknown> | undefined {
  if (op.payload?.undoSnapshot && typeof op.payload.undoSnapshot === 'object') {
    return op.payload.undoSnapshot as Record<string, unknown>
  }
  if (op.type === 'delete' && op.payload && typeof op.payload.id === 'string') {
    return op.payload as Record<string, unknown>
  }
  return undefined
}

function getTransactionAfter(
  op: QueuedOp,
  before: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (op.type === 'add') return op.payload as Record<string, unknown> | undefined
  if (op.type !== 'update') return undefined
  const payload = { ...(op.payload ?? {}) }
  delete payload.undoSnapshot
  return { ...(before ?? {}), ...payload }
}

function getTransactionSnapshot(op: QueuedOp): Record<string, unknown> | undefined {
  const candidate = op.isCompleted ? op.payload?.resultTransaction : op.payload?.optimisticTransaction
  const fallback = candidate && typeof candidate === 'object' ? candidate : op.payload?.undoSnapshot
  return fallback && typeof fallback === 'object' ? fallback as Record<string, unknown> : undefined
}

function hasInput(
  inputs: LoanPaymentInput[],
  occurrenceDate: string,
  snapshot: Record<string, unknown> | undefined,
) {
  const transactionId = typeof snapshot?.id === 'string' ? snapshot.id : undefined
  return inputs.some(input => (transactionId && input.transactionId === transactionId) || input.occurrenceDate === occurrenceDate)
}

function removeInput(inputs: LoanPaymentInput[], snapshot: Record<string, unknown> | undefined) {
  if (!snapshot) return
  const transactionId = typeof snapshot.id === 'string' ? snapshot.id : ''
  const occurrenceDate = typeof snapshot.recurringOccurrenceDate === 'string' ? snapshot.recurringOccurrenceDate : ''
  for (let i = inputs.length - 1; i >= 0; i -= 1) {
    if ((transactionId && inputs[i].transactionId === transactionId)
      || (occurrenceDate && inputs[i].occurrenceDate === occurrenceDate)) {
      inputs.splice(i, 1)
    }
  }
}

function addInputFromSnapshot(inputs: LoanPaymentInput[], snapshot: Record<string, unknown> | undefined, op: QueuedOp) {
  const occurrenceDate = typeof snapshot?.recurringOccurrenceDate === 'string' ? snapshot.recurringOccurrenceDate : undefined
  if (!occurrenceDate || hasInput(inputs, occurrenceDate, snapshot)) return
  addInput(inputs, occurrenceDate, snapshot, op)
}

function addInput(
  inputs: LoanPaymentInput[],
  occurrenceDate: string,
  snapshot: Record<string, unknown> | undefined,
  op: QueuedOp,
) {
  const ledgerCategory = typeof snapshot?.ledgerCategory === 'string' ? snapshot.ledgerCategory : ''
  const isDiscarded = ledgerCategory.toLowerCase() === 'discarded'
  const rawAmount = typeof snapshot?.amount === 'number' ? snapshot.amount : Number(snapshot?.amount ?? 0)
  inputs.push({
    occurrenceDate,
    postedAt: typeof snapshot?.postedAt === 'string' ? snapshot.postedAt : new Date(op.createdAt).toISOString(),
    amount: isDiscarded ? 0 : Math.abs(Number.isFinite(rawAmount) ? rawAmount : 0),
    isDiscarded,
    transactionId: typeof snapshot?.id === 'string' ? snapshot.id : undefined,
  })
}
