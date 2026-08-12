import { describe, expect, it } from 'vitest'
import type { Loan } from '../types'
import type { QueuedOp } from './outbox'
import { projectLoanStates } from './loanProjection'

function loan(): Loan {
  return {
    id: 'loan-test',
    name: 'Test loan',
    recurringPaymentId: 'bill-test',
    openingPrincipal: 1000,
    trackingStartDate: '2026-01-01',
    annualRatePercent: 0,
    termPeriods: 10,
    interestMethod: 'ReducingBalance',
    recurringPaymentFrequency: 'Monthly',
    snapshot: {
      outstandingBalance: 1000,
      scheduledPayment: 100,
      totalScheduledInterest: 0,
      totalInterestPaid: 0,
      payments: [],
      futureSchedule: [],
    },
  }
}

function op(overrides: Partial<QueuedOp>): QueuedOp {
  return { id: 'op-1', entity: 'recurringOccurrence', type: 'settle', targetId: 'bill-test:2026-01-01', createdAt: 1, retryCount: 0, ...overrides }
}

describe('projectLoanStates', () => {
  it('projects a pending settle immediately', () => {
    const projected = projectLoanStates([loan()], [op({ payload: {
      recurringPaymentId: 'bill-test', occurrenceDate: '2026-01-01', status: 'Paid', optimisticTransaction: { id: 'tx-1', amount: -100, postedAt: '2026-01-01T12:00:00Z' },
    } })])[0]

    expect(projected.snapshot.outstandingBalance).toBe(900)
    expect(projected.isPendingSync).toBe(true)
  })

  it('projects a discarded occurrence without creating a payment', () => {
    const projected = projectLoanStates([loan()], [op({ payload: {
      recurringPaymentId: 'bill-test', occurrenceDate: '2026-01-01', status: 'Discarded',
    } })])[0]

    expect(projected.snapshot.payments).toHaveLength(0)
    expect(projected.snapshot.futureSchedule[0].occurrenceDate).toBe('2026-02-01')
  })

  it('does not double-apply a completed op already present in the refreshed snapshot', () => {
    const server = loan()
    server.snapshot.payments = [{ occurrenceDate: '2026-01-01', payment: 100, interest: 0, principal: 100, balanceBefore: 1000, balanceAfter: 900, surplus: 0, paymentDidNotCoverInterest: false, transactionId: 'tx-1' }]
    const projected = projectLoanStates([server], [op({ isCompleted: true, payload: {
      recurringPaymentId: 'bill-test', occurrenceDate: '2026-01-01', status: 'Paid', resultTransaction: { id: 'tx-1', amount: -100, postedAt: '2026-01-01T12:00:00Z' },
    } })])[0]

    expect(projected.snapshot.outstandingBalance).toBe(900)
    expect(projected.snapshot.payments).toHaveLength(1)
  })

  it('restores a deleted settlement from its undo snapshot', () => {
    const server = loan()
    server.snapshot.payments = [{ occurrenceDate: '2026-01-01', payment: 100, interest: 0, principal: 100, balanceBefore: 1000, balanceAfter: 900, surplus: 0, paymentDidNotCoverInterest: false, transactionId: 'tx-1' }]
    const projected = projectLoanStates([server], [op({ entity: 'transaction', type: 'delete', targetId: 'tx-1', payload: {
      undoSnapshot: { id: 'tx-1', recurringPaymentId: 'bill-test', recurringOccurrenceDate: '2026-01-01', amount: -100 },
    } })])[0]

    expect(projected.snapshot.outstandingBalance).toBe(1000)
    expect(projected.snapshot.payments).toHaveLength(0)
  })

  it('keeps the first debt-free occurrence when later history has surplus payments', () => {
    const projected = projectLoanStates([loan()], [
      op({ id: 'op-payoff', createdAt: 1, payload: {
        recurringPaymentId: 'bill-test', occurrenceDate: '2026-01-01', status: 'Paid', optimisticTransaction: { id: 'tx-payoff', amount: -1000 },
      } }),
      op({ id: 'op-surplus', createdAt: 2, targetId: 'bill-test:2026-02-01', payload: {
        recurringPaymentId: 'bill-test', occurrenceDate: '2026-02-01', status: 'Paid', optimisticTransaction: { id: 'tx-surplus', amount: -50 },
      } }),
    ])[0]

    expect(projected.snapshot.payoffDate).toBe('2026-01-01')
    expect(projected.snapshot.outstandingBalance).toBe(0)
  })

  it('deduplicates a pay-early op by occurrence date without a transaction snapshot', () => {
    const server = loan()
    server.snapshot.payments = [{ occurrenceDate: '2026-01-01', payment: 100, interest: 0, principal: 100, balanceBefore: 1000, balanceAfter: 900, surplus: 0, paymentDidNotCoverInterest: false, transactionId: 'tx-1' }]
    const projected = projectLoanStates([server], [op({
      entity: 'recurringPayment',
      type: 'payEarly',
      targetId: 'bill-test',
      isCompleted: true,
      payload: { settledOccurrenceDate: '2026-01-01' },
    })])[0]

    expect(projected.snapshot.outstandingBalance).toBe(900)
    expect(projected.snapshot.payments).toHaveLength(1)
  })
})
