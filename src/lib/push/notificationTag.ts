// Building the notification "tag" is factored out of the service worker itself so it can be
// unit-tested from a normal Vitest/jsdom environment (the worker file can only be exercised by
// an actual browser/SW runtime). Using the same tag for the same payment+occurrence means a
// re-delivered ('Daily' mode) or duplicate push replaces the prior notification instead of
// stacking a new one in the tray.
export interface RecurringNotificationData {
  kind?: 'recurring-payment'
  recurringPaymentId: string
  occurrenceDate: string
  shortfall?: string
  accountName?: string
}

export interface CategoryLimitNotificationData {
  kind: 'category-limit'
  cycleKey: string
  categoryName?: string
}

export type PushNotificationData = RecurringNotificationData | CategoryLimitNotificationData

export function buildNotificationTag(data: PushNotificationData): string {
  if (isCategoryLimitNotificationData(data)) {
    // Deliberately keyed on the cycle alone and NOT on the category: a cycle can produce an
    // alert per category and two per category, and tagging them apart stacked a growing pile of
    // notifications that all open the same Reports section. One replaceable line per cycle
    // matches how the recurring reminders collapse per occurrence.
    return `category-limit-${data.cycleKey}`
  }
  return `recurring-reminder-${data.recurringPaymentId}-${data.occurrenceDate}`
}

export function isRecurringNotificationData(value: unknown): value is RecurringNotificationData {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  return typeof data.recurringPaymentId === 'string' && typeof data.occurrenceDate === 'string'
}

export function isCategoryLimitNotificationData(value: unknown): value is CategoryLimitNotificationData {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  return data.kind === 'category-limit'
    && typeof data.cycleKey === 'string'
    && /^\d{4}-\d{2}$/.test(data.cycleKey)
    && (data.categoryName === undefined || typeof data.categoryName === 'string')
}

export function isPushNotificationData(value: unknown): value is PushNotificationData {
  return isRecurringNotificationData(value) || isCategoryLimitNotificationData(value)
}
