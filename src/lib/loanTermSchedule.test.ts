import { describe, expect, it } from 'vitest'
import { countLoanPaymentsThrough, durationFromTermPeriods, loanEndDate, termPeriodsFromDuration } from './loanTermSchedule'

const cadence = {
  trackingStartDate: '2026-01-01',
  scheduleFrequency: 'Monthly',
  scheduleDueDay: 31,
  scheduleStartDate: '2026-01-31',
  scheduleStatus: 'Complete' as const,
}

describe('loan term schedule', () => {
  it('counts inclusive anchored occurrences through a recurring bill end date', () => {
    expect(countLoanPaymentsThrough(cadence, '2026-06-30')).toBe(6)
  })

  it('derives the recurring bill end date from the serialized payment count', () => {
    expect(loanEndDate({ ...cadence, termPeriods: 18 })).toBe('2027-06-30')
  })

  it('converts the friendlier years and months input without changing serialization', () => {
    expect(durationFromTermPeriods(24, 'Monthly')).toEqual({ value: 2, unit: 'Years' })
    expect(durationFromTermPeriods(18, 'Monthly')).toEqual({ value: 18, unit: 'Months' })
    expect(termPeriodsFromDuration(2, 'Years', 'Monthly')).toBe(24)
    expect(termPeriodsFromDuration(18, 'Months', 'Monthly')).toBe(18)
    expect(termPeriodsFromDuration(24, 'Months', 'Annually')).toBe(2)
  })
})
