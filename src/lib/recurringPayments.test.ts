import { describe, expect, it } from 'vitest'
import {
  buildReminderPreview,
  computeOccurrenceOnOrAfter,
  computeNextOccurrenceDate,
  DEFAULT_REMINDER_SETTINGS,
  getEffectiveReminderSettings,
  getReminderEffectiveState,
  hasBillingEnded,
  isEligibleForPayEarly,
  normalizeRecurringFrequency,
  occurrencePaidSoFar,
  occurrenceRemaining,
  REMINDER_LEAD_DAY_OPTIONS,
} from './recurringPayments'

describe('normalizeRecurringFrequency', () => {
  it('coerces a legacy Weekly value to Monthly', () => {
    expect(normalizeRecurringFrequency('Weekly')).toBe('Monthly')
  })

  it('preserves supported frequencies', () => {
    expect(normalizeRecurringFrequency('Monthly')).toBe('Monthly')
    expect(normalizeRecurringFrequency('Annually')).toBe('Annually')
  })
})

describe('computeNextOccurrenceDate', () => {
  it('advances a Monthly payment by one month', () => {
    expect(computeNextOccurrenceDate({ nextDueDate: '2024-03-15', frequency: 'Monthly' })).toBe('2024-04-15')
  })

  it('advances an Annually payment by one year', () => {
    expect(computeNextOccurrenceDate({ nextDueDate: '2024-03-15', frequency: 'Annually' })).toBe('2025-03-15')
  })

  it('clamps Jan 31 to Feb 28 in a non-leap year', () => {
    expect(computeNextOccurrenceDate({ nextDueDate: '2023-01-31', frequency: 'Monthly' })).toBe('2023-02-28')
  })

  it('clamps Jan 31 to Feb 29 in a leap year', () => {
    expect(computeNextOccurrenceDate({ nextDueDate: '2024-01-31', frequency: 'Monthly' })).toBe('2024-02-29')
  })

  it('recovers the anchored day after a short month', () => {
    expect(computeNextOccurrenceDate({
      nextDueDate: '2026-02-28', frequency: 'Monthly', dueDate: 31, startDate: '2026-01-31',
    })).toBe('2026-03-31')
  })

  it('returns null when the server reports no remaining occurrence', () => {
    expect(computeNextOccurrenceDate({ nextDueDate: null, frequency: 'Monthly' })).toBeNull()
  })

  it('rolls over into the next year', () => {
    expect(computeNextOccurrenceDate({ nextDueDate: '2024-12-15', frequency: 'Monthly' })).toBe('2025-01-15')
  })

  it('stops at the configured billing end date', () => {
    expect(computeNextOccurrenceDate({
      nextDueDate: '2026-08-31', frequency: 'Monthly', dueDate: 31, endDate: '2026-09-15',
    })).toBeNull()
  })
})

describe('computeOccurrenceOnOrAfter', () => {
  it('matches the server monthly anchor when a past schedule is created', () => {
    expect(computeOccurrenceOnOrAfter({
      startDate: '2026-01-31', dueDate: 31, frequency: 'Monthly', endDate: undefined,
    }, '2026-08-09')).toBe('2026-08-31')
  })

  it('uses the start month as the annual anchor', () => {
    expect(computeOccurrenceOnOrAfter({
      startDate: '2024-03-31', dueDate: 31, frequency: 'Annually', endDate: undefined,
    }, '2026-04-01')).toBe('2027-03-31')
  })

  it('returns null when the next anchored date is after the end date', () => {
    expect(computeOccurrenceOnOrAfter({
      startDate: '2026-01-15', dueDate: 15, frequency: 'Monthly', endDate: '2026-08-10',
    }, '2026-08-09')).toBeNull()
  })

  // A bill that starts in a later year than the date being searched from. The month used to come
  // from Math.max(start.month, target.month) whenever the resolved year equalled the start year --
  // which is also true when the target sits in an earlier year -- so the card's optimistic next due
  // date jumped months and then silently corrected itself once the server answered.
  it('answers the first scheduled date when the schedule starts in a later year', () => {
    expect(computeOccurrenceOnOrAfter({
      startDate: '2027-01-10', dueDate: 10, frequency: 'Monthly', endDate: undefined,
    }, '2026-09-06')).toBe('2027-01-10')
  })

  it('clamps the due day inside a later-year start month', () => {
    expect(computeOccurrenceOnOrAfter({
      startDate: '2027-02-28', dueDate: 31, frequency: 'Monthly', endDate: undefined,
    }, '2026-12-31')).toBe('2027-02-28')
  })

  it('answers the first scheduled date for an annual schedule starting in a later year', () => {
    expect(computeOccurrenceOnOrAfter({
      startDate: '2027-03-15', dueDate: 15, frequency: 'Annually', endDate: undefined,
    }, '2026-11-01')).toBe('2027-03-15')
  })
})

describe('occurrencePaidSoFar', () => {
  const rows = [
    { amount: -40, ledgerCategory: 'Essentials', recurringPaymentId: 'rp-1', recurringOccurrenceDate: '2026-12-10' },
    { amount: -20, ledgerCategory: 'Essentials', recurringPaymentId: 'rp-1', recurringOccurrenceDate: '2026-12-10' },
    { amount: -99, ledgerCategory: 'Essentials', recurringPaymentId: 'rp-1', recurringOccurrenceDate: '2027-01-10' },
    { amount: -99, ledgerCategory: 'Essentials', recurringPaymentId: 'rp-2', recurringOccurrenceDate: '2026-12-10' },
  ]

  it('sums only the rows tagged to that bill and occurrence', () => {
    expect(occurrencePaidSoFar(rows, 'rp-1', '2026-12-10')).toBe(60)
  })

  it('ignores a discarded marker, which carries no money', () => {
    expect(occurrencePaidSoFar(
      [...rows, { amount: 0, ledgerCategory: 'Discarded', recurringPaymentId: 'rp-1', recurringOccurrenceDate: '2026-12-10' }],
      'rp-1',
      '2026-12-10',
    )).toBe(60)
  })

  it('compares magnitudes, because the stored sign is not a contract', () => {
    expect(occurrencePaidSoFar(
      [{ amount: 40, ledgerCategory: 'Essentials', recurringPaymentId: 'rp-1', recurringOccurrenceDate: '2026-12-10' }],
      'rp-1',
      '2026-12-10',
    )).toBe(40)
  })

  it('never reports a negative remainder once the occurrence is covered', () => {
    expect(occurrenceRemaining(-100, 60)).toBe(40)
    expect(occurrenceRemaining(100, 140)).toBe(0)
  })
})

describe('hasBillingEnded', () => {
  const today = new Date(2024, 5, 15)

  it('treats an open-ended subscription as still billing', () => {
    expect(hasBillingEnded({ endDate: undefined }, today)).toBe(false)
  })

  it('treats a future end date as still billing', () => {
    expect(hasBillingEnded({ endDate: '2024-06-16' }, today)).toBe(false)
  })

  it('is inclusive of the end date itself', () => {
    expect(hasBillingEnded({ endDate: '2024-06-15' }, today)).toBe(false)
  })

  it('reports a past end date as ended', () => {
    expect(hasBillingEnded({ endDate: '2024-06-14' }, today)).toBe(true)
  })
})

describe('isEligibleForPayEarly', () => {
  const today = new Date(2024, 5, 15)

  it('is eligible for an active manual payment strictly due in the future', () => {
    expect(isEligibleForPayEarly({ active: true, nextDueDate: '2024-06-20', paymentMode: 'Manual' }, today)).toBe(true)
  })

  it('is not eligible for an inactive payment', () => {
    expect(isEligibleForPayEarly({ active: false, nextDueDate: '2024-06-20', paymentMode: 'Manual' }, today)).toBe(false)
  })

  it('is not eligible when due today', () => {
    expect(isEligibleForPayEarly({ active: true, nextDueDate: '2024-06-15', paymentMode: 'Manual' }, today)).toBe(false)
  })

  it('is not eligible when overdue', () => {
    expect(isEligibleForPayEarly({ active: true, nextDueDate: '2024-06-01', paymentMode: 'Manual' }, today)).toBe(false)
  })

  // The bank moves an auto-deducted bill on its own schedule, so there is nothing to bring forward
  // even when the occurrence is otherwise perfectly payable.
  it('is not eligible for an auto deducted payment due in the future', () => {
    expect(isEligibleForPayEarly({ active: true, nextDueDate: '2024-06-20', paymentMode: 'AutoDeduct' }, today)).toBe(false)
  })
})

describe('getEffectiveReminderSettings', () => {
  it('falls back to defaults when unset', () => {
    expect(getEffectiveReminderSettings({})).toEqual(DEFAULT_REMINDER_SETTINGS)
  })

  it('uses the stored values when present', () => {
    expect(getEffectiveReminderSettings({ reminderEnabled: true, reminderMode: 'Daily', reminderLeadDays: 7 })).toEqual({
      enabled: true,
      mode: 'Daily',
      leadDays: 7,
    })
  })
})

describe('getReminderEffectiveState', () => {
  it('is off when the per-subscription reminder is disabled', () => {
    expect(getReminderEffectiveState({ reminderEnabled: false }, true)).toBe('off')
  })

  it('is paused when enabled but the global push toggle is off', () => {
    expect(getReminderEffectiveState({ reminderEnabled: true }, false)).toBe('paused')
  })

  it('is active when enabled and the global push toggle is on', () => {
    expect(getReminderEffectiveState({ reminderEnabled: true }, true)).toBe('active')
  })
})

describe('buildReminderPreview', () => {
  it('describes a single reminder for Once mode', () => {
    expect(buildReminderPreview('Once', 3)).toBe("One reminder 3 days before it's due.")
  })

  it('uses singular "day" for a 1-day lead', () => {
    expect(buildReminderPreview('Once', 1)).toBe("One reminder 1 day before it's due.")
  })

  it('describes a daily countdown for Daily mode', () => {
    expect(buildReminderPreview('Daily', 7)).toBe("Daily reminders from 7 days before until it's due.")
  })
})

describe('REMINDER_LEAD_DAY_OPTIONS', () => {
  it('exposes the exact 7/3/2/1 chip set', () => {
    expect(REMINDER_LEAD_DAY_OPTIONS).toEqual([7, 3, 2, 1])
  })
})
