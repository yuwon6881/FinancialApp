import { describe, expect, it } from 'vitest'
import { buildNotificationTag, isCategoryLimitNotificationData, isRecurringNotificationData } from './notificationTag'

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

  it('builds a stable category and cycle tag', () => {
    expect(buildNotificationTag({ kind: 'category-limit', cycleKey: '2026-08', categoryName: 'Dining' }))
      .toBe('category-limit-2026-08-Dining')
  })
})

describe('isCategoryLimitNotificationData', () => {
  it('accepts category and summary payloads with a valid cycle key', () => {
    expect(isCategoryLimitNotificationData({ kind: 'category-limit', cycleKey: '2026-08', categoryName: 'Dining' })).toBe(true)
    expect(isCategoryLimitNotificationData({ kind: 'category-limit', cycleKey: '2026-08' })).toBe(true)
  })

  it('rejects malformed cycle keys and unrelated notification kinds', () => {
    expect(isCategoryLimitNotificationData({ kind: 'category-limit', cycleKey: 'Aug-2026' })).toBe(false)
    expect(isCategoryLimitNotificationData({ kind: 'recurring-payment', cycleKey: '2026-08' })).toBe(false)
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
