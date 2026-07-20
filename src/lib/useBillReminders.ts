import { useEffect, useMemo } from 'react'
import type { RecurringPayment } from '../types'

// Only the fields that affect scheduling; used to avoid rescheduling on every render
// (the payments array is a fresh reference each render because of optimistic merging).
function schedulingSignature(payments: RecurringPayment[]): string {
  return payments
    .filter(payment => payment.active && !payment.isPendingDelete)
    .map(payment => `${payment.id}:${payment.frequency}:${payment.dueDate}:${payment.startDate}:${payment.endDate ?? ''}`)
    .sort()
    .join('|')
}

/**
 * Keeps OS bill reminders in sync with the user's recurring payments while the
 * feature is enabled. Reschedules only when the schedule-relevant fields change
 * (keyed on `signature`), and cancels everything when disabled. `payments` is read
 * from the effect closure; only scheduling-relevant changes re-run it, and those are
 * exactly what `signature` captures, so a stale non-scheduling field can never matter.
 */
export function useBillReminders(payments: RecurringPayment[], enabled: boolean): void {
  const signature = useMemo(() => schedulingSignature(payments), [payments])

  useEffect(() => {
    // Lazy-load the reminder module so the plugin glue stays out of the main bundle.
    void (async () => {
      const { syncBillReminders, cancelAllBillReminders } = await import('./billReminders')
      if (!enabled) {
        await cancelAllBillReminders()
        return
      }
      await syncBillReminders(payments)
    })()
  }, [enabled, signature])
}
