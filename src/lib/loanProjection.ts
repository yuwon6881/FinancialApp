import type { Loan } from '../types'
import { replayLoan, type LoanPaymentInput } from './loanMath'
import type { QueuedOp } from './outbox'

/** Projects settlement operations onto the shared loan replay snapshot. */
export function projectLoanStates(loans: Loan[], ops: QueuedOp[]): Loan[] {
  return loans.map(loan => {
    const relevant = ops.filter(op => isRelevant(op, loan.recurringPaymentId))
    if (relevant.length === 0) return loan
    const inputs: LoanPaymentInput[] = loan.snapshot.payments.map(payment => ({
      occurrenceDate: payment.occurrenceDate,
      postedAt: '',
      amount: payment.payment,
      transactionId: payment.transactionId,
    }))
    const known = new Set(inputs.map(input => input.occurrenceDate))
    let hadPendingSettlement = false

    for (const op of [...relevant].sort((left, right) => left.createdAt - right.createdAt)) {
      const occurrenceDate = getOccurrenceDate(op)
      if (!occurrenceDate) continue
      const deletedSnapshot = getTransactionSnapshot(op)
      if (op.entity === 'transaction' && op.type === 'delete') {
        const transactionId = typeof deletedSnapshot?.id === 'string' ? deletedSnapshot.id : ''
        for (let i = inputs.length - 1; i >= 0; i -= 1) {
          if ((transactionId && inputs[i].transactionId === transactionId)
            || (inputs[i].occurrenceDate === occurrenceDate && deletedSnapshot?.recurringPaymentId === loan.recurringPaymentId)) {
            inputs.splice(i, 1)
          }
        }
        known.delete(occurrenceDate)
        if (!op.isCompleted) hadPendingSettlement = true
        continue
      }
      const status = op.entity === 'recurringOccurrence' && op.payload?.status === 'Discarded'
      const transaction = getTransactionSnapshot(op)
      if (known.has(occurrenceDate)) {
        if (!op.isCompleted) hadPendingSettlement = true
        continue
      }
      inputs.push({
        occurrenceDate,
        postedAt: typeof transaction?.postedAt === 'string' ? transaction.postedAt : new Date(op.createdAt).toISOString(),
        amount: status ? 0 : Math.abs(typeof transaction?.amount === 'number' ? transaction.amount : Number(op.payload?.amount ?? 0)),
        isDiscarded: status,
        transactionId: typeof transaction?.id === 'string' ? transaction.id : undefined,
      })
      known.add(occurrenceDate)
      if (!op.isCompleted) hadPendingSettlement = true
    }

    const snapshot = replayLoan(loan, loan.recurringPaymentFrequency, inputs)
    return {
      ...loan,
      snapshot,
      isPendingSync: hadPendingSettlement || loan.isPendingSync,
      pendingSyncOperationId: hadPendingSettlement
        ? relevant.find(op => !op.isCompleted)?.id
        : loan.pendingSyncOperationId,
    }
  })
}

function isRelevant(op: QueuedOp, recurringPaymentId: string): boolean {
  if (op.entity === 'recurringOccurrence' && op.type === 'settle') {
    return op.payload?.recurringPaymentId === recurringPaymentId
  }
  if (op.entity === 'recurringPayment' && op.type === 'payEarly') {
    return op.targetId === recurringPaymentId
  }
  if (op.entity === 'transaction' && op.type === 'delete') {
    const snapshot = getTransactionSnapshot(op)
    return snapshot?.recurringPaymentId === recurringPaymentId
  }
  return false
}

function getOccurrenceDate(op: QueuedOp): string | undefined {
  if (typeof op.payload?.occurrenceDate === 'string') return op.payload.occurrenceDate
  if (typeof op.payload?.settledOccurrenceDate === 'string') return op.payload.settledOccurrenceDate
  const snapshot = getTransactionSnapshot(op)
  return typeof snapshot?.recurringOccurrenceDate === 'string' ? snapshot.recurringOccurrenceDate : undefined
}

function getTransactionSnapshot(op: QueuedOp): Record<string, unknown> | undefined {
  const candidate = op.isCompleted ? op.payload?.resultTransaction : op.payload?.optimisticTransaction
  const fallback = op.payload?.undoSnapshot
  const value = candidate && typeof candidate === 'object' ? candidate : fallback
  return value && typeof value === 'object' ? value as Record<string, unknown> : undefined
}
