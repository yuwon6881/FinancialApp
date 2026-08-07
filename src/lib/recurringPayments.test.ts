import { describe, expect, it } from 'vitest'
import {
  buildReminderPreview,
  computeNextOccurrenceDate,
  DEFAULT_REMINDER_SETTINGS,
  getEffectiveReminderSettings,
  getReminderEffectiveState,
  hasBillingEnded,
  isEligibleForPayEarly,
  normalizeRecurringFrequency,
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

  it('rolls over into the next year', () => {
    expect(computeNextOccurrenceDate({ nextDueDate: '2024-12-15', frequency: 'Monthly' })).toBe('2025-01-15')
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
