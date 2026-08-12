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
    const split = applyPayment(value, 'Monthly', '2026-01-01', 1200, 100, 1, 0, '2026-01-01')
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
    const split = applyPayment(loan(), 'Monthly', '2026-01-01', 1000, 10, 1, 0, '2026-01-01')
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

  it('starts monthly forecasts on the bill due day around the tracking date', () => {
    const beforeDueDay = loan({
      trackingStartDate: '2026-01-12',
      scheduleFrequency: 'Monthly',
      scheduleDueDay: 15,
      scheduleStartDate: '2026-01-01',
      scheduleStatus: 'Complete',
    })
    const afterDueDay = { ...beforeDueDay, trackingStartDate: '2026-01-16' }

    expect(replayLoan(beforeDueDay, undefined, []).futureSchedule[0].occurrenceDate).toBe('2026-01-15')
    expect(replayLoan(afterDueDay, undefined, []).futureSchedule[0].occurrenceDate).toBe('2026-02-15')
  })

  it('uses the frozen annual anchor month and recovers the day 31 anchor', () => {
    const annual = loan({
      trackingStartDate: '2026-04-01',
      scheduleFrequency: 'Annually',
      scheduleDueDay: 15,
      scheduleStartDate: '2026-01-01',
      scheduleStatus: 'Complete',
    })
    const annualBeforeAnchor = { ...annual, trackingStartDate: '2026-01-01' }
    const monthEnd = loan({
      trackingStartDate: '2026-01-31',
      scheduleFrequency: 'Monthly',
      scheduleDueDay: 31,
      scheduleStartDate: '2026-01-01',
      scheduleStatus: 'Complete',
    })

    expect(replayLoan(annual, undefined, []).futureSchedule[0].occurrenceDate).toBe('2027-01-15')
    expect(replayLoan(annualBeforeAnchor, undefined, []).futureSchedule[0].occurrenceDate).toBe('2026-01-15')
    const monthEndDates = replayLoan(monthEnd, undefined, [{ occurrenceDate: '2026-01-31', amount: 0, isDiscarded: true }]).futureSchedule.slice(0, 4).map(entry => entry.occurrenceDate)
    expect(monthEndDates).toEqual(['2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31'])
  })

  it('does not invent a schedule for an incomplete loan', () => {
    const replay = replayLoan(loan({ scheduleStatus: 'Incomplete' }), undefined, [])
    expect(replay.futureSchedule).toEqual([])
    expect(replay.nextPayment).toBeNull()
  })

  it('surfaces overpayment surplus instead of making the balance negative', () => {
    const value = loan({ annualRatePercent: 0 })
    const split = applyPayment(value, 'Monthly', '2026-01-01', 1000, 1200, 1, 0, '2026-01-01')
    expect(split).toMatchObject({ principal: 1000, balanceAfter: 0, surplus: 200 })
  })

  it('charges daily rest for the exact occurrence window', () => {
    const value = loan({ interestMethod: 'ReducingBalanceDaily', annualRatePercent: 12 })

    const fourteenDays = applyPayment(value, 'Monthly', '2026-01-15', 1000, 100, 1, 0, '2026-01-01')
    const thirtyOneDays = applyPayment(value, 'Monthly', '2026-02-01', 1000, 100, 1, 0, '2026-01-01')

    expect(fourteenDays.interest).toBe(4.6)
    expect(thirtyOneDays.interest).toBe(10.19)
    expect(fourteenDays.interest).not.toBe(applyPayment(loan(), 'Monthly', '2026-01-15', 1000, 100, 1, 0, '2026-01-01').interest)
  })

  it('charges no daily interest when the accrual window has zero days', () => {
    const split = applyPayment(
      loan({ interestMethod: 'ReducingBalanceDaily' }),
      'Monthly',
      '2026-01-01',
      1000,
      100,
      1,
      0,
      '2026-01-01',
    )

    expect(split.interest).toBe(0)
    expect(split.principal).toBe(100)
  })

  it('uses monthly rest for the daily method quote and scheduled payment', () => {
    const monthly = loan({ annualRatePercent: 12, interestMethod: 'ReducingBalance' })
    const daily = { ...monthly, interestMethod: 'ReducingBalanceDaily' as const }

    expect(scheduledPayment(daily, 'Monthly')).toBe(scheduledPayment(monthly, 'Monthly'))
    expect(totalScheduledInterest(daily, 'Monthly')).toBe(totalScheduledInterest(monthly, 'Monthly'))
  })

  it('keeps an interest-only balance flat but applies an overpayment to it', () => {
    const value = loan({ interestMethod: 'InterestOnly', annualRatePercent: 12 })
    const scheduled = replayLoan({ ...value, trackingStartDate: '2025-12-01' }, 'Monthly', [])
    const overpayment = applyPayment(value, 'Monthly', '2026-01-01', 1000, 25, 1, 0, '2026-01-01')

    expect(scheduled.futureSchedule[0]).toMatchObject({ interest: 10, principal: 0, balanceAfter: 1000 })
    expect(overpayment).toMatchObject({ interest: 10, principal: 15, balanceAfter: 985 })
  })

  it('caps an interest-only forecast at the term and keeps the balloon state honest', () => {
    const value = loan({
      interestMethod: 'InterestOnly',
      termPeriods: 3,
      scheduleFrequency: 'Monthly',
      scheduleDueDay: 1,
      scheduleStartDate: '2026-01-01',
      scheduleStatus: 'Complete',
    })
    const replay = replayLoan(value, undefined, [])

    expect(replay.futureSchedule).toHaveLength(3)
    expect(replay.payoffDate).toBeNull()
    expect(replay.nextPayment).not.toBeNull()
  })

  it('keeps discarded days in the next daily-rest window', () => {
    const value = loan({ interestMethod: 'ReducingBalanceDaily', annualRatePercent: 12 })
    const replay = replayLoan(value, 'Monthly', [
      { occurrenceDate: '2026-02-01', amount: 0, isDiscarded: true },
      { occurrenceDate: '2026-03-01', amount: 100 },
    ], 1)

    expect(replay.payments[0].interest).toBe(19.4)
  })
})
