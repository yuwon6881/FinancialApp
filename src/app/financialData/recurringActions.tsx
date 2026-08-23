import type { PendingNotification, RecurringPayment, RecurringReminderSettings, Transaction } from '../../types'
import { createFinalId, enqueue, type OutboxPayload } from '../../lib/outbox'
import { triggerHaptic } from '../../lib/haptics'
import { financialDate } from '../../lib/financialDate'
import { computeNextOccurrenceDate, computeOccurrenceOnOrAfter } from '../../lib/recurringPayments'
import type { UseOutboxResult } from '../../lib/useOutbox'
import type { AppDialogs } from '../useAppDialogs'
import type { ToastAction, ToastTone } from '../../components/ui/ToastViewport'

interface RecurringActionDependencies {
  allRecurringPayments: RecurringPayment[]
  guardSensitive: () => boolean
  formatSensitive: (value: number) => string
  toOutboxPayload: (value: object) => OutboxPayload
  mutateQueue: UseOutboxResult['mutateQueue']
  snapshotForUndo: UseOutboxResult['snapshotForUndo']
  setConfirmModalData: AppDialogs['setConfirmModalData']
  showToast: (message: string, title?: string, tone?: ToastTone, action?: ToastAction) => void
}

/**
 * Recurring-bill writes, including the settlement of a pending occurrence. Settlement carries the
 * optimistic ledger row and next due date with it, because the occurrence ledger -- not this
 * client -- is authoritative once the queued op reaches the server.
 */
export function createRecurringActions(deps: RecurringActionDependencies) {
  const {
    allRecurringPayments,
    guardSensitive,
    formatSensitive,
    toOutboxPayload,
    mutateQueue,
    snapshotForUndo,
    setConfirmModalData,
    showToast,
  } = deps

  const handleConfirmSubscription = (noti: PendingNotification, paidDate: string, amount?: number) => {
    if (!guardSensitive()) return
    const transactionId = createFinalId('transaction')
    const postedAt = new Date().toISOString()
    const payment = allRecurringPayments.find(item => item.id === noti.recurringPaymentId)
    // The occurrence's own frozen account wins over the schedule's current one: re-pointing a bill
    // moves its future occurrences, not one already waiting to be confirmed. The server resolves it
    // the same way, so the two agree; only a legacy occurrence with no snapshot falls back.
    const settlementAccountId = noti.accountId ?? payment?.accountId
    const settleAmount = (amount != null && amount > 0) ? amount : noti.amount
    mutateQueue(prev => enqueue(prev, 'recurringOccurrence', 'settle', noti.id, {
      name: noti.name,
      recurringPaymentId: noti.recurringPaymentId,
      occurrenceDate: noti.billingDate,
      amount: (amount != null && amount > 0) ? amount : undefined,
      status: 'Paid',
      paidDate,
      accountId: settlementAccountId,
      optimisticNextOccurrenceDate: payment ? computeNextOccurrenceDate(payment) ?? undefined : undefined,
      optimisticTransaction: {
        id: transactionId,
        date: paidDate,
        postedAt,
        description: noti.name,
        amount: -Math.abs(settleAmount),
        category: noti.category,
        ledgerCategory: noti.ledgerCategory,
        accountId: settlementAccountId,
        recurringPaymentId: noti.recurringPaymentId,
        recurringOccurrenceDate: noti.billingDate,
        isPendingSync: true,
      },
    }))
  }

  const handleDiscardSubscription = (noti: PendingNotification) => {
    if (!guardSensitive()) return
    const transactionId = createFinalId('transaction')
    const postedAt = new Date().toISOString()
    const payment = allRecurringPayments.find(item => item.id === noti.recurringPaymentId)
    mutateQueue(prev => enqueue(prev, 'recurringOccurrence', 'settle', noti.id, {
      name: noti.name,
      recurringPaymentId: noti.recurringPaymentId,
      occurrenceDate: noti.billingDate,
      status: 'Discarded',
      optimisticNextOccurrenceDate: payment ? computeNextOccurrenceDate(payment) ?? undefined : undefined,
      optimisticTransaction: {
      id: transactionId,
      date: financialDate(),
      postedAt,
      description: `[Discarded] ${noti.name}`,
      amount: 0,
      category: noti.category,
      ledgerCategory: 'Discarded',
      recurringPaymentId: noti.recurringPaymentId,
      recurringOccurrenceDate: noti.billingDate,
      isPendingSync: true,
      },
    }))
  }

  const handleAddPayment = (newPay: Omit<RecurringPayment, 'id'>) => {
    if (!guardSensitive()) return
    const finalId = createFinalId('recurringPayment')
    mutateQueue(prev => enqueue(prev, 'recurringPayment', 'add', finalId, { ...newPay, id: finalId, active: true }))
  }

  const handleToggleActive = (id: string) => {
    if (!guardSensitive()) return
    const current = allRecurringPayments.find(p => String(p.id) === String(id))
    const nextActive = current ? !current.active : false
    const tomorrow = new Date(`${financialDate()}T12:00:00`)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const trackingStart = tomorrow.toLocaleDateString('en-CA')
    const payload = current ? {
      active: nextActive,
      name: current.name,
      nextDueDate: nextActive ? computeOccurrenceOnOrAfter(current, trackingStart) : null,
      // Toggling recomputes nextDueDate, so Undo needs the prior one to restore: rebuilding
      // { active, name } alone left the recomputed date in place until the next server refresh.
      undoSnapshot: current,
    } : undefined
    mutateQueue(prev => enqueue(prev, 'recurringPayment', 'toggle', id, payload))
  }

  const handleUpdatePayment = (id: string, payment: RecurringPayment) => {
    if (!guardSensitive()) return
    const previousPayment = allRecurringPayments.find(p => String(p.id) === String(id))
    snapshotForUndo('recurringPayment', String(id), previousPayment)
    mutateQueue(prev => enqueue(prev, 'recurringPayment', 'update', id, {
      ...toOutboxPayload(payment),
      undoSnapshot: previousPayment,
    }))
  }

  const handleDeletePayment = (id: string) => {
    if (!guardSensitive()) return
    const linkedPayment = allRecurringPayments.find(payment => payment.id === id)
    if (linkedPayment?.linkedLoanId) {
      showToast(
        `“${linkedPayment.name}” is linked to ${linkedPayment.linkedLoanName || 'a loan'} and cannot be deleted.`,
        'Recurring bill kept',
        'warning',
      )
      return
    }
    void triggerHaptic(30)
    const payment = allRecurringPayments.find(p => String(p.id) === String(id))
    snapshotForUndo('recurringPayment', String(id), payment)
    mutateQueue(prev => enqueue(prev, 'recurringPayment', 'delete', id, {
      name: payment?.name,
      undoSnapshot: payment,
    }))
  }

  const requestDeletePayment = (id: string) => {
    if (!guardSensitive()) return
    const payment = allRecurringPayments.find(p => p.id === id)
    if (payment?.linkedLoanId) {
      showToast(
        `“${payment.name}” is linked to ${payment.linkedLoanName || 'a loan'} and cannot be deleted.`,
        'Recurring bill kept',
        'warning',
      )
      return
    }
    setConfirmModalData({
      title: 'Delete Subscription',
      message: `Delete "${payment?.name || 'this recurring subscription'}"? Future reminders stop; past ledger entries stay.`,
      confirmText: 'Delete',
      onConfirm: () => { handleDeletePayment(id) }
    })
  }

  const handleUpdateReminder = (id: string, settings: RecurringReminderSettings) => {
    if (!guardSensitive()) return
    const previous = allRecurringPayments.find(p => p.id === id)
    snapshotForUndo('recurringPayment', id, previous)
    mutateQueue(queue => enqueue(queue, 'recurringPayment', 'reminder', id, {
      name: previous?.name,
      reminderEnabled: settings.enabled,
      reminderMode: settings.mode,
      reminderLeadDays: settings.leadDays,
      undoSnapshot: previous,
    }))
  }

  const handlePayEarly = (id: string, amount?: number, accountId?: string, settlesOccurrence?: boolean) => {
    if (!guardSensitive()) return
    const payment = allRecurringPayments.find(p => p.id === id)
    if (!payment?.nextDueDate) return
    const occurrenceDate = payment.nextDueDate
    const postedAt = new Date().toISOString()
    const isPartial = settlesOccurrence === false
      || (settlesOccurrence === undefined && typeof amount === 'number' && amount > 0 && amount < Math.abs(payment.amount))
    const paidAmount = typeof amount === 'number' ? amount : Math.abs(payment.amount)
    const targetAccountId = accountId ?? payment.accountId
    const pendingTransactionId = createFinalId('transaction')
    const pendingTransaction: Transaction = {
      id: pendingTransactionId,
      date: financialDate(),
      postedAt,
      description: payment.name,
      category: payment.category,
      ledgerCategory: payment.ledgerCategory,
      amount: -paidAmount,
      accountId: targetAccountId,
      recurringPaymentId: payment.id,
      recurringOccurrenceDate: occurrenceDate,
      isPendingSync: true,
    }
    mutateQueue(queue => enqueue(queue, 'recurringOccurrence', 'settle', `${id}:${occurrenceDate}`, {
      name: payment.name,
      recurringPaymentId: payment.id,
      occurrenceDate,
      status: isPartial ? 'PartiallyPaid' : 'Paid',
      paidDate: financialDate(),
      accountId: targetAccountId,
      amount: isPartial ? amount : undefined,
      optimisticNextOccurrenceDate: isPartial ? undefined : (computeNextOccurrenceDate(payment) ?? undefined),
      optimisticTransaction: pendingTransaction,
    }))
  }

  const requestPayEarly = (id: string) => {
    if (!guardSensitive()) return
    const payment = allRecurringPayments.find(p => p.id === id)
    if (!payment?.nextDueDate) return
    const todayFormatted = new Date().toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
    setConfirmModalData({
      title: 'Pay Early',
      variant: 'primary',
      message: (
        <div className="space-y-3">
          <p className="text-sm">Pay <strong>{payment.name}</strong> before its scheduled date?</p>
          <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Amount</span>
              <strong className="text-foreground">{formatSensitive(Math.abs(payment.amount))}</strong>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Scheduled date</span>
              <span className="font-semibold text-foreground">{payment.nextDueDate}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Transaction date</span>
              <span className="font-semibold text-foreground">{todayFormatted}</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">The next due date will advance by one cycle after this payment.</p>
        </div>
      ),
      confirmText: 'Pay Now',
      onConfirm: () => { handlePayEarly(id) }
    })
  }

  return {
    handleConfirmSubscription,
    handleDiscardSubscription,
    handleAddPayment,
    handleToggleActive,
    handleUpdatePayment,
    handleDeletePayment,
    requestDeletePayment,
    handleUpdateReminder,
    handlePayEarly,
    requestPayEarly,
  }
}
