// Building the notification "tag" is factored out of the service worker itself so it can be
// unit-tested from a normal Vitest/jsdom environment (the worker file can only be exercised by
// an actual browser/SW runtime). Using the same tag for the same payment+occurrence means a
// re-delivered ('Daily' mode) or duplicate push replaces the prior notification instead of
// stacking a new one in the tray.
export interface RecurringNotificationData {
  recurringPaymentId: string
  occurrenceDate: string
}

export function buildNotificationTag(data: RecurringNotificationData): string {
  return `recurring-reminder-${data.recurringPaymentId}-${data.occurrenceDate}`
}

export function isRecurringNotificationData(value: unknown): value is RecurringNotificationData {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  return typeof data.recurringPaymentId === 'string' && typeof data.occurrenceDate === 'string'
}
