import { buildNotificationTag, isRecurringNotificationData, type RecurringNotificationData } from './notificationTag'

// The recurring page route the worker opens/focuses on notification click, with the paid
// subscription id so the client can scroll to and highlight the matching card (mirrors the
// existing `?subscription=` deep link already used from the dashboard subscription card).
export function buildRecurringNotificationUrl(data: RecurringNotificationData): string {
  return `/recurring?subscription=${encodeURIComponent(data.recurringPaymentId)}`
}

export interface BackgroundMessageLike {
  data?: Record<string, string>
  notification?: { title?: string; body?: string }
}

export interface BuiltNotification {
  title: string
  options: NotificationOptions & { data?: RecurringNotificationData }
}

// Firebase's onBackgroundMessage delivers "data-only" messages here (no `notification` payload)
// so the worker fully controls the notification's shape -- this is what actually lets us stamp a
// stable per-occurrence tag and a click target on it.
export function buildBackgroundNotification(message: BackgroundMessageLike): BuiltNotification | null {
  const raw = message.data || {}
  if (!raw.recurringPaymentId || !raw.occurrenceDate) return null
  const title = raw.title || message.notification?.title || 'Payment reminder'
  const body = raw.body || message.notification?.body || ''
  const notificationData: RecurringNotificationData = {
    recurringPaymentId: raw.recurringPaymentId,
    occurrenceDate: raw.occurrenceDate,
  }
  if (!isRecurringNotificationData(notificationData)) return null

  return {
    title,
    options: {
      body,
      tag: buildNotificationTag(notificationData),
      data: notificationData,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
    },
  }
}
