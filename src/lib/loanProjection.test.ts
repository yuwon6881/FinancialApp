import { describe, expect, it } from 'vitest'
import type { Loan, RecurringPayment } from '../types'
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
    scheduleFrequency: 'Monthly',
    scheduleDueDay: 1,
    scheduleStartDate: '2026-01-01',
    scheduleStatus: 'Complete',
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

const settlement = {
  id: 'tx-1',
  recurringPaymentId: 'bill-test',
  recurringOccurrenceDate: '2026-01-01',
  amount: -100,
}

const linkedPayment: RecurringPayment = {
  id: 'bill-test',
  name: 'Original bill',
  amount: -100,
  frequency: 'Monthly',
  category: 'Bills',
  ledgerCategory: 'Essentials',
  accountId: 'acct-essentials',
  nextDueDate: '2026-01-01',
  dueDate: 1,
  startDate: '2026-01-01',
  active: true,
  paymentMode: 'Manual',
}

describe('loan repayment projection', () => {
  const withSchedule = (): Loan => {
    const base = loan()
    return {
      ...base,
      snapshot: {
        ...base.snapshot,
        futureSchedule: [
          { occurrenceDate: '2026-01-01', payment: 100, interest: 0, principal: 100, balanceAfter: 900 },
          { occurrenceDate: '2026-02-01', payment: 100, interest: 0, principal: 100, balanceAfter: 800 },
          { occurrenceDate: '2026-03-01', payment: 100, interest: 0, principal: 100, balanceAfter: 700 },
        ],
      },
    }
  }

  it('consumes the paid instalments for a queued advance repayment', () => {
    const [projected] = projectLoanStates(
      [withSchedule()],
      [op({ id: 'op-adv', entity: 'loan', type: 'advanceRepayment', targetId: 'loan-test', payload: { cycles: 2 } })],
    )

    expect(projected.snapshot.outstandingBalance).toBe(800)
    expect(projected.snapshot.futureSchedule[0]?.occurrenceDate).toBe('2026-03-01')
    expect(projected.isPendingSync).toBe(true)
  })

  it('shows a queued full settlement as paid off with no instalments left', () => {
    const [projected] = projectLoanStates(
      [withSchedule()],
      [op({ id: 'op-settle', entity: 'loan', type: 'fullSettlement', targetId: 'loan-test', payload: { amount: 950 } })],
    )

    expect(projected.snapshot.outstandingBalance).toBe(0)
    expect(projected.snapshot.futureSchedule).toHaveLength(0)
    expect(projected.snapshot.nextPayment).toBeNull()
    // The bill stops with the payoff, so the card must not keep advertising a next due date.
    expect(projected.recurringPaymentExists).toBe(false)
    expect(projected.isPendingSync).toBe(true)
  })

  it('marks the loan syncing for a queued undo, which targets the action id not the loan', () => {
    const [projected] = projectLoanStates(
      [withSchedule()],
      [op({
        id: 'op-undo',
        entity: 'loan',
        type: 'undoRepayment',
        targetId: 'repay-abc',
        payload: { loanId: 'loan-test' },
      })],
    )

    expect(projected.isPendingSync).toBe(true)
    expect(projected.pendingSyncOperationId).toBe('op-undo')
  })
})

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

  it('replays a queued transaction edit instead of keeping the old amount', () => {
    const server = loan()
    server.snapshot.payments = [{ occurrenceDate: '2026-01-01', payment: 100, interest: 0, principal: 100, balanceBefore: 1000, balanceAfter: 900, surplus: 0, paymentDidNotCoverInterest: false, transactionId: 'tx-1' }]
    const projected = projectLoanStates([server], [op({ entity: 'transaction', type: 'update', targetId: 'tx-1', payload: {
      ...settlement, amount: -200, undoSnapshot: settlement,
    } })])[0]

    expect(projected.snapshot.outstandingBalance).toBe(800)
    expect(projected.snapshot.payments[0].payment).toBe(200)
  })

  it('projects bulk transaction delete and restore through the same replay path', () => {
    const server = loan()
    server.snapshot.payments = [{ occurrenceDate: '2026-01-01', payment: 100, interest: 0, principal: 100, balanceBefore: 1000, balanceAfter: 900, surplus: 0, paymentDidNotCoverInterest: false, transactionId: 'tx-1' }]
    const deleted = projectLoanStates([server], [op({ entity: 'transaction', type: 'bulkDelete', targetId: 'bulk-1', payload: {
      transactionIds: ['tx-1'], transactions: [settlement],
    } })])[0]
    const restored = projectLoanStates([loan()], [op({ entity: 'transaction', type: 'bulkRestore', targetId: 'bulk-2', payload: {
      transactions: [settlement],
    } })])[0]

    expect(deleted.snapshot.outstandingBalance).toBe(1000)
    expect(restored.snapshot.outstandingBalance).toBe(900)
  })

  it('keeps frozen cadence when queued bill metadata changes', () => {
    const projected = projectLoanStates([loan()], [op({ entity: 'recurringPayment', type: 'update', targetId: 'bill-test', payload: {
      name: 'Edited bill', frequency: 'Annually', dueDate: 20,
    } })], [linkedPayment])[0]

    expect(projected.recurringPaymentName).toBe('Edited bill')
    expect(projected.recurringPaymentFrequency).toBe('Annually')
    expect(projected.scheduleFrequency).toBe('Monthly')
    expect(projected.scheduleDueDay).toBe(1)
    expect(projected.snapshot.futureSchedule[0].occurrenceDate).toBe('2026-01-01')
  })

  it('projects a linked bill end-date edit into the loan payment count', () => {
    const projected = projectLoanStates([loan()], [op({
      entity: 'recurringPayment',
      type: 'update',
      targetId: 'bill-test',
      payload: { endDate: '2027-12-01' },
    })], [linkedPayment])[0]

    expect(projected.termPeriods).toBe(24)
    expect(projected.snapshot.scheduledPayment).toBe(41.67)
  })

  it('marks the schedule unavailable when the linked bill is queued for deletion', () => {
    const projected = projectLoanStates([loan()], [op({ entity: 'recurringPayment', type: 'delete', targetId: 'bill-test', payload: {
      undoSnapshot: linkedPayment,
    } })], [linkedPayment])[0]

    expect(projected.scheduleStatus).toBe('Incomplete')
    expect(projected.snapshot.futureSchedule).toEqual([])
    expect(projected.isPendingSync).toBe(true)
  })

  it('replays queued loan term edits immediately', () => {
    const projected = projectLoanStates([loan()], [op({ entity: 'loan', type: 'update', targetId: 'loan-test', payload: {
      annualRatePercent: 12, termPeriods: 12, interestMethod: 'ReducingBalance',
    } })])[0]

    expect(projected.annualRatePercent).toBe(12)
    expect(projected.snapshot.scheduledPayment).toBe(88.85)
    expect(projected.isPendingSync).toBe(true)
  })

  it('keeps the rate basis through before, syncing, completed, and refreshed projections', () => {
    const payload = {
      annualRatePercent: 17.04,
      rateBasis: 'Monthly' as const,
      interestMethod: 'InterestOnly' as const,
    }
    const loanOp = (overrides: Partial<QueuedOp> = {}): QueuedOp => op({
      entity: 'loan',
      type: 'update',
      targetId: 'loan-test',
      payload,
      ...overrides,
    })
    const before = projectLoanStates([loan()], [loanOp()])[0]
    const syncing = projectLoanStates([before], [loanOp()])[0]
    const completed = projectLoanStates([before], [loanOp({ isCompleted: true })])[0]
    const refreshed = projectLoanStates([{ ...completed, isPendingSync: false }], [])[0]

    for (const projected of [before, syncing, completed, refreshed]) {
      expect(projected.rateBasis).toBe('Monthly')
      expect(projected.annualRatePercent).toBe(17.04)
      expect(projected.interestMethod).toBe('InterestOnly')
    }
  })

  it('moves recurring link protection immediately while a relink is syncing', () => {
    const replacement = {
      ...linkedPayment,
      id: 'bill-replacement',
      name: 'Replacement bill',
      dueDate: 15,
      startDate: '2026-01-15',
    }
    const projectedLoan = projectLoanStates([loan()], [op({
      entity: 'loan',
      type: 'update',
      targetId: 'loan-test',
      payload: {
        recurringPaymentId: replacement.id,
        recurringPaymentName: replacement.name,
        scheduleFrequency: replacement.frequency,
        scheduleDueDay: replacement.dueDate,
        scheduleStartDate: replacement.startDate,
      },
    })], [linkedPayment, replacement])[0]

    expect(projectedLoan.recurringPaymentId).toBe('bill-replacement')
    expect(projectedLoan.isRecalculating).toBe(true)
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
