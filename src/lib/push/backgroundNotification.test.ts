import { describe, expect, it } from 'vitest'
import { buildBackgroundNotification, buildPushNotificationUrl, buildRecurringNotificationUrl } from './backgroundNotification'

describe('buildBackgroundNotification', () => {
  it('builds a notification from a data-only background message', () => {
    const result = buildBackgroundNotification({
      data: {
        title: 'Netflix due soon',
        body: '$15.99 due in 3 days',
        recurringPaymentId: 'sub-1',
        occurrenceDate: '2024-06-15',
      },
    })
    expect(result).not.toBeNull()
    expect(result?.title).toBe('Netflix due soon')
    expect(result?.options.body).toBe('$15.99 due in 3 days')
    expect(result?.options.tag).toBe('recurring-reminder-sub-1-2024-06-15')
    expect(result?.options.data).toEqual({
      kind: 'recurring-payment',
      recurringPaymentId: 'sub-1',
      occurrenceDate: '2024-06-15',
    })
  })

  it('falls back to the legacy notification title/body when data ones are absent', () => {
    const result = buildBackgroundNotification({
      data: { recurringPaymentId: 'sub-1', occurrenceDate: '2024-06-15' },
      notification: { title: 'Fallback title', body: 'Fallback body' },
    })
    expect(result?.title).toBe('Fallback title')
    expect(result?.options.body).toBe('Fallback body')
  })

  it('returns null when the payload has no data payload at all', () => {
    expect(buildBackgroundNotification({})).toBeNull()
  })

  it('returns null when the payment id or occurrence date is missing', () => {
    expect(buildBackgroundNotification({ data: { recurringPaymentId: 'sub-1' } })).toBeNull()
    expect(buildBackgroundNotification({ data: { occurrenceDate: '2024-06-15' } })).toBeNull()
  })

  it('uses two identical tags for two deliveries of the same occurrence (Daily mode re-delivery)', () => {
    const message = { data: { recurringPaymentId: 'sub-1', occurrenceDate: '2024-06-15' } }
    const first = buildBackgroundNotification(message)
    const second = buildBackgroundNotification(message)
    expect(first?.options.tag).toBe(second?.options.tag)
  })

  it('builds a category-limit notification without recurring-payment fields', () => {
    const result = buildBackgroundNotification({
      data: {
        kind: 'category-limit',
        title: 'Category spending alert',
        body: 'Dining is close to its cycle spending guide.',
        cycleKey: '2026-08',
        categoryName: 'Dining',
      },
    })

    expect(result?.options.tag).toBe('category-limit-2026-08-Dining')
    expect(result?.options.data).toEqual({
      kind: 'category-limit',
      cycleKey: '2026-08',
      categoryName: 'Dining',
    })
  })

  it('rejects a malformed category-limit cycle key', () => {
    expect(buildBackgroundNotification({
      data: { kind: 'category-limit', cycleKey: 'August 2026' },
    })).toBeNull()
  })
})

describe('buildPushNotificationUrl', () => {
  it('opens the category-limit section for category alerts', () => {
    expect(buildPushNotificationUrl({ kind: 'category-limit', cycleKey: '2026-08', categoryName: 'Dining' }))
      .toBe('/reports?focus=category-limits')
  })
})

describe('buildRecurringNotificationUrl', () => {
  it('builds the recurring page deep link with the subscription id', () => {
    expect(buildRecurringNotificationUrl({ recurringPaymentId: 'sub-1', occurrenceDate: '2024-06-15' })).toBe(
      '/recurring?subscription=sub-1'
    )
  })

  it('URL-encodes the subscription id', () => {
    expect(buildRecurringNotificationUrl({ recurringPaymentId: 'sub 1/2', occurrenceDate: '2024-06-15' })).toBe(
      '/recurring?subscription=sub%201%2F2'
    )
  })
})
