import {
  buildNotificationTag,
  isCategoryLimitNotificationData,
  isPushNotificationData,
  type CategoryLimitNotificationData,
  type PushNotificationData,
  type RecurringNotificationData,
} from './notificationTag'

// The recurring page route the worker opens/focuses on notification click, with the paid
// subscription id so the client can scroll to and highlight the matching card (mirrors the
// existing `?subscription=` deep link already used from the dashboard subscription card).
export function buildRecurringNotificationUrl(data: RecurringNotificationData): string {
  return `/recurring?subscription=${encodeURIComponent(data.recurringPaymentId)}`
}

export function buildPushNotificationUrl(data: PushNotificationData): string {
  return isCategoryLimitNotificationData(data)
    ? '/reports?focus=category-limits'
    : buildRecurringNotificationUrl(data)
}

export interface BackgroundMessageLike {
  data?: Record<string, string>
  notification?: { title?: string; body?: string }
}

export interface BuiltNotification {
  title: string
  options: NotificationOptions & { data?: PushNotificationData }
}

// Firebase's onBackgroundMessage delivers "data-only" messages here (no `notification` payload)
// so the worker fully controls the notification's shape -- this is what actually lets us stamp a
// stable per-occurrence tag and a click target on it.
export function buildBackgroundNotification(message: BackgroundMessageLike): BuiltNotification | null {
  const raw = message.data || {}
  let notificationData: PushNotificationData
  if (raw.kind === 'category-limit') {
    notificationData = {
      kind: 'category-limit',
      cycleKey: raw.cycleKey,
      ...(raw.categoryName ? { categoryName: raw.categoryName } : {}),
    } satisfies CategoryLimitNotificationData
  } else {
    if (!raw.recurringPaymentId || !raw.occurrenceDate) return null
    notificationData = {
      kind: 'recurring-payment',
      recurringPaymentId: raw.recurringPaymentId,
      occurrenceDate: raw.occurrenceDate,
    }
  }
  if (!isPushNotificationData(notificationData)) return null

  const title = raw.title || message.notification?.title
    || (isCategoryLimitNotificationData(notificationData) ? 'Category spending alert' : 'Payment reminder')
  const body = raw.body || message.notification?.body || ''

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
