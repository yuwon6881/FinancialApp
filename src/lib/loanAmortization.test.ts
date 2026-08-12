import { describe, expect, it } from 'vitest'
import type { Loan } from '../types'
import { addPeriod, applyPayment, replayLoan, scheduledPayment, totalScheduledInterest } from './loanMath'

function loan(overrides: Partial<Loan> = {}): Loan {
  return {
    id: 'loan-test',
    name: 'Test loan',
    recurringPaymentId: 'bill-test',
    openingPrincipal: 1000,
    trackingStartDate: '2026-01-01',
    annualRatePercent: 12,
    termPeriods: 12,
    interestMethod: 'ReducingBalance',
    snapshot: {
      outstandingBalance: 1000,
      scheduledPayment: 88.85,
      totalScheduledInterest: 66.2,
      totalInterestPaid: 0,
      payments: [],
      futureSchedule: [],
    },
    ...overrides,
  }
}

describe('loanAmortization', () => {
  it('matches the zero-rate reducing-balance case', () => {
    const value = loan({ openingPrincipal: 1200, annualRatePercent: 0 })
    expect(scheduledPayment(value, 'Monthly')).toBe(100)
    const split = applyPayment(value, 'Monthly', '2026-01-01', 1200, 100, 1, 0)
    expect(split).toMatchObject({ interest: 0, principal: 100, balanceAfter: 1100 })
  })

  it('uses the final flat-interest residual cent', () => {
    const value = loan({ interestMethod: 'Flat', annualRatePercent: 11, termPeriods: 3 })
    expect(totalScheduledInterest(value, 'Monthly')).toBe(27.5)
    const replay = replayLoan(value, 'Monthly', [
      { occurrenceDate: '2026-01-01', amount: 342.5 },
      { occurrenceDate: '2026-02-01', amount: 342.5 },
      { occurrenceDate: '2026-03-01', amount: 342.5 },
    ])
    expect(replay.payments.map(payment => payment.interest)).toEqual([9.17, 9.17, 9.16])
    expect(replay.outstandingBalance).toBe(0)
  })

  it('keeps an underpayment on the same balance but still finds a later payoff', () => {
    const replay = replayLoan(loan(), 'Monthly', [
      { occurrenceDate: '2026-01-01', amount: 5 },
    ])
    expect(replay.payments[0]).toMatchObject({ interest: 5, principal: 0, balanceAfter: 1000, paymentDidNotCoverInterest: true })
    expect(replay.payoffDate).toBeTruthy()
    expect(replay.futureSchedule.at(-1)?.balanceAfter).toBe(0)
  })

  it('treats exact interest payment as covered', () => {
    const split = applyPayment(loan(), 'Monthly', '2026-01-01', 1000, 10, 1, 0)
    expect(split.paymentDidNotCoverInterest).toBe(false)
    expect(split.principal).toBe(0)
  })

  it('clamps month-end periods to the recurring bill anchor day', () => {
    expect(addPeriod('2026-01-31', 'Monthly', 31)).toBe('2026-02-28')
    expect(addPeriod('2026-01-31', 'Monthly', 31)).toBe('2026-02-28')
    let date = '2026-01-31'
    for (let i = 0; i < 4; i += 1) date = addPeriod(date, 'Monthly', 31)
    expect(date).toBe('2026-05-31')
  })

  it('surfaces overpayment surplus instead of making the balance negative', () => {
    const value = loan({ annualRatePercent: 0 })
    const split = applyPayment(value, 'Monthly', '2026-01-01', 1000, 1200, 1, 0)
    expect(split).toMatchObject({ principal: 1000, balanceAfter: 0, surplus: 200 })
  })
})
