import type { Loan, RecurringPayment } from '../types'
import { expandBulkTransactionProjection, type QueuedOp } from './outbox'
import { replayLoan, type LoanPaymentInput } from './loanMath'

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

  return loans.map(loan => projectLoan(loan, orderedOps, recurringPayments))
}

function projectLoan(loan: Loan, ops: QueuedOp[], recurringPayments: RecurringPayment[]): Loan {
  const projectedLoan = { ...loan }
  const linkedPayment = recurringPayments.find(payment => payment.id === loan.recurringPaymentId)
  const inputs: LoanPaymentInput[] = loan.snapshot.payments.map(payment => ({
    occurrenceDate: payment.occurrenceDate,
    postedAt: '',
    amount: payment.payment,
    transactionId: payment.transactionId,
  }))
  let hadPendingEffect = false
  let firstPendingEffectId: string | undefined

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

    if (op.entity === 'loan' && op.targetId === loan.id) {
      applyLoanOp(projectedLoan, op, linkedPayment)
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

  const snapshot = replayLoan(projectedLoan, undefined, inputs)
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
}

function applyLoanOp(loan: Loan, op: QueuedOp, linkedPayment: RecurringPayment | undefined) {
  if (op.type === 'delete') return
  if (op.type !== 'add' && op.type !== 'update') return
  const payload = op.payload
  if (typeof payload?.name === 'string') loan.name = payload.name
  if (typeof payload?.openingPrincipal === 'number') loan.openingPrincipal = payload.openingPrincipal
  if (typeof payload?.trackingStartDate === 'string') loan.trackingStartDate = payload.trackingStartDate
  if (typeof payload?.annualRatePercent === 'number') loan.annualRatePercent = payload.annualRatePercent
  if (typeof payload?.termPeriods === 'number') loan.termPeriods = payload.termPeriods
  if (payload?.interestMethod === 'ReducingBalance' || payload?.interestMethod === 'Flat') {
    loan.interestMethod = payload.interestMethod
  }
  if (payload?.scheduleFrequency === 'Monthly' || payload?.scheduleFrequency === 'Annually') {
    loan.scheduleFrequency = payload.scheduleFrequency
  }
  if (typeof payload?.scheduleDueDay === 'number') loan.scheduleDueDay = payload.scheduleDueDay
  if (typeof payload?.scheduleStartDate === 'string') loan.scheduleStartDate = payload.scheduleStartDate
  if (payload?.scheduleStatus === 'Complete' || payload?.scheduleStatus === 'NeedsReview' || payload?.scheduleStatus === 'Incomplete') {
    loan.scheduleStatus = payload.scheduleStatus
  }
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
