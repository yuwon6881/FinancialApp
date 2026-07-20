import { describe, expect, it } from 'vitest'
import { computeUpcomingReminders } from './billReminders'
import type { RecurringPayment } from '../types'

function payment(overrides: Partial<RecurringPayment> = {}): RecurringPayment {
  return {
    id: 'rp-1',
    name: 'Streaming',
    amount: -15,
    frequency: 'Monthly',
    category: 'Entertainment',
    ledgerCategory: 'Rewards',
    nextDueDate: '2026-07-28',
    dueDate: 28,
    startDate: '2026-01-01',
    active: true,
    ...overrides,
  }
}

const NOW = new Date(2026, 6, 20, 8, 0, 0) // Jul 20 2026, 08:00 local
const OPTS = { now: NOW, horizonDays: 62, leadDays: 2, hour: 9 }

describe('computeUpcomingReminders', () => {
  it('schedules upcoming monthly occurrences within the horizon, two days ahead', () => {
    const reminders = computeUpcomingReminders([payment()], OPTS)

    expect(reminders.map(r => r.dueDate)).toEqual([
      new Date(2026, 6, 28, 9, 0, 0),
      new Date(2026, 7, 28, 9, 0, 0),
    ])
    // Fires two days before the due date at the configured hour.
    expect(reminders[0].fireAt).toEqual(new Date(2026, 6, 26, 9, 0, 0))
    expect(reminders[0].paymentId).toBe('rp-1')
  })

  it('rolls past an already-elapsed due day in the current month', () => {
    const reminders = computeUpcomingReminders([payment({ dueDate: 10 })], OPTS)
    // Jul 10 already passed; Aug 10 and Sep 10 fall inside the 62-day horizon.
    expect(reminders.map(r => r.dueDate)).toEqual([
      new Date(2026, 7, 10, 9, 0, 0),
      new Date(2026, 8, 10, 9, 0, 0),
    ])
  })

  it('excludes inactive and pending-delete payments', () => {
    const reminders = computeUpcomingReminders(
      [payment({ id: 'a', active: false }), payment({ id: 'b', isPendingDelete: true })],
      OPTS,
    )
    expect(reminders).toEqual([])
  })

  it('does not schedule past the payment end date', () => {
    const reminders = computeUpcomingReminders([payment({ endDate: '2026-07-25' })], OPTS)
    expect(reminders).toEqual([])
  })

  it('only schedules an annual payment in its anniversary month', () => {
    const marchNow = new Date(2026, 2, 1, 8, 0, 0)
    const reminders = computeUpcomingReminders(
      [payment({ frequency: 'Annually', startDate: '2025-03-15', dueDate: 15 })],
      { ...OPTS, now: marchNow },
    )
    expect(reminders).toHaveLength(1)
    expect(reminders[0].dueDate).toEqual(new Date(2026, 2, 15, 9, 0, 0))
  })

  it('derives a stable, unique notification id per payment occurrence', () => {
    const first = computeUpcomingReminders([payment()], OPTS)
    const second = computeUpcomingReminders([payment()], OPTS)
    expect(first[0].notificationId).toBe(second[0].notificationId)
    expect(first[0].notificationId).not.toBe(first[1].notificationId)
    expect(first[0].notificationId).toBeGreaterThan(0)
  })
})
