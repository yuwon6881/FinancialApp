import { useEffect, useMemo, useRef } from 'react'
import type { RecurringPayment } from '../types'
import { cancelAllBillReminders, syncBillReminders } from './billReminders'

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
 * feature is enabled. Reschedules only when the schedule-relevant fields change,
 * and cancels everything when disabled.
 */
export function useBillReminders(payments: RecurringPayment[], enabled: boolean): void {
  const paymentsRef = useRef(payments)
  paymentsRef.current = payments

  const signature = useMemo(() => schedulingSignature(payments), [payments])

  useEffect(() => {
    if (!enabled) {
      void cancelAllBillReminders()
      return
    }
    void syncBillReminders(paymentsRef.current)
  }, [enabled, signature])
}
