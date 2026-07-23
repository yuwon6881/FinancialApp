import { describe, expect, it } from 'vitest'
import { buildNotificationTag, isRecurringNotificationData } from './notificationTag'

describe('buildNotificationTag', () => {
  it('builds a stable tag from the payment id and occurrence date', () => {
    expect(buildNotificationTag({ recurringPaymentId: 'sub-1', occurrenceDate: '2024-06-15' })).toBe(
      'recurring-reminder-sub-1-2024-06-15'
    )
  })

  it('produces the same tag for repeated calls with the same data', () => {
    const data = { recurringPaymentId: 'sub-2', occurrenceDate: '2024-07-01' }
    expect(buildNotificationTag(data)).toBe(buildNotificationTag({ ...data }))
  })

  it('produces different tags for different occurrences of the same payment', () => {
    const first = buildNotificationTag({ recurringPaymentId: 'sub-1', occurrenceDate: '2024-06-15' })
    const second = buildNotificationTag({ recurringPaymentId: 'sub-1', occurrenceDate: '2024-07-15' })
    expect(first).not.toBe(second)
  })
})

describe('isRecurringNotificationData', () => {
  it('accepts a well-formed payload', () => {
    expect(isRecurringNotificationData({ recurringPaymentId: 'sub-1', occurrenceDate: '2024-06-15' })).toBe(true)
  })

  it('rejects null/undefined/non-object values', () => {
    expect(isRecurringNotificationData(null)).toBe(false)
    expect(isRecurringNotificationData(undefined)).toBe(false)
    expect(isRecurringNotificationData('not-an-object')).toBe(false)
  })

  it('rejects a payload missing required fields', () => {
    expect(isRecurringNotificationData({ recurringPaymentId: 'sub-1' })).toBe(false)
    expect(isRecurringNotificationData({ occurrenceDate: '2024-06-15' })).toBe(false)
  })
})
