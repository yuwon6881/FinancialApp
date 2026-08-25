import type { Loan, RecurringPayment } from '../../types'
import { createFinalId, type OutboxPayload } from '../../lib/outbox'
import { triggerHaptic } from '../../lib/haptics'
import type { UseOutboxResult } from '../../lib/useOutbox'
import type { AppDialogs } from '../useAppDialogs'

interface LoanActionDependencies {
  loans: Loan[]
  recurringPayments: RecurringPayment[]
  guardSensitive: () => boolean
  enqueue: UseOutboxResult['enqueue']
  mutateQueue: UseOutboxResult['mutateQueue']
  snapshotForUndo: UseOutboxResult['snapshotForUndo']
  setConfirmModalData: AppDialogs['setConfirmModalData']
}

const emptySnapshot = {
  outstandingBalance: 0,
  scheduledPayment: 0,
  totalScheduledInterest: 0,
  totalInterestPaid: 0,
  payoffDate: null,
  lastOccurrenceDate: null,
  nextPayment: null,
  payments: [],
  futureSchedule: [],
}

export function createLoanActions(deps: LoanActionDependencies) {
  const {
    loans,
    recurringPayments,
    guardSensitive,
    enqueue,
    mutateQueue,
    snapshotForUndo,
    setConfirmModalData,
  } = deps

  const handleAddLoan = (value: Partial<Loan>) => {
    if (!guardSensitive()) return
    const id = createFinalId('loan')
    const payment = recurringPayments.find(item => item.id === value.recurringPaymentId)
    const scheduleStatus = payment && (payment.frequency === 'Monthly' || payment.frequency === 'Annually')
      && payment.dueDate >= 1 && payment.dueDate <= 31 && Boolean(payment.startDate)
      ? 'Complete'
      : 'Incomplete'
    const payload: OutboxPayload = {
      ...value,
      id,
      name: value.name?.trim() ?? '',
      recurringPaymentId: value.recurringPaymentId ?? '',
      openingPrincipal: value.openingPrincipal ?? 0,
      trackingStartDate: value.trackingStartDate ?? '',
      annualRatePercent: value.annualRatePercent ?? 0,
      termPeriods: value.termPeriods ?? 0,
      interestMethod: value.interestMethod ?? 'ReducingBalance',
      rateBasis: value.rateBasis ?? 'Yearly',
      scheduleFrequency: payment?.frequency ?? null,
      scheduleDueDay: payment?.dueDate ?? null,
      scheduleStartDate: payment?.startDate ?? null,
      scheduleStatus,
      snapshot: emptySnapshot,
    }
    mutateQueue(previous => enqueue(previous, 'loan', 'add', id, payload))
  }

  const handleUpdateLoan = (id: string, value: Loan) => {
    if (!guardSensitive()) return
    const previous = loans.find(loan => loan.id === id)
    snapshotForUndo('loan', id, previous)
    const selectedPayment = recurringPayments.find(payment => payment.id === value.recurringPaymentId)
    const linkChanged = previous?.recurringPaymentId !== value.recurringPaymentId
    mutateQueue(queue => enqueue(queue, 'loan', 'update', id, {
      ...value,
      recurringPaymentId: value.recurringPaymentId,
      scheduleFrequency: linkChanged ? selectedPayment?.frequency ?? null : previous?.scheduleFrequency,
      scheduleDueDay: linkChanged ? selectedPayment?.dueDate ?? null : previous?.scheduleDueDay,
      scheduleStartDate: linkChanged ? selectedPayment?.startDate ?? null : previous?.scheduleStartDate,
      scheduleStatus: linkChanged ? 'Complete' : previous?.scheduleStatus,
      isRecalculating: linkChanged,
      undoSnapshot: previous,
    }))
  }

  const handleDeleteLoan = (id: string) => {
    if (!guardSensitive()) return
    void triggerHaptic(30)
    const previous = loans.find(loan => loan.id === id)
    snapshotForUndo('loan', id, previous)
    mutateQueue(queue => enqueue(queue, 'loan', 'delete', id, {
      name: previous?.name,
      undoSnapshot: previous,
    }))
  }

  const requestDeleteLoan = (id: string) => {
    if (!guardSensitive()) return
    const loan = loans.find(item => item.id === id)
    setConfirmModalData({
      title: 'Delete loan',
      message: `Delete “${loan?.name || 'this loan'}”? The linked bill and its past ledger entries stay in place.`,
      confirmText: 'Delete',
      onConfirm: () => handleDeleteLoan(id),
    })
  }

  const handleAdvanceRepayment = async (id: string, cycles: number, accountId?: string, previewFingerprint?: string) => {
    if (!guardSensitive()) return
    const loan = loans.find(item => item.id === id)
    if (!loan) return
    mutateQueue(queue => enqueue(queue, 'loan', 'advanceRepayment', id, {
      cycles,
      accountId,
      previewFingerprint,
      name: loan.name,
    }))
  }

  const handleFullSettlement = async (id: string, lenderQuoteAmount: number, accountId?: string) => {
    if (!guardSensitive()) return
    const loan = loans.find(item => item.id === id)
    if (!loan) return
    mutateQueue(queue => enqueue(queue, 'loan', 'fullSettlement', id, {
      amount: lenderQuoteAmount,
      accountId,
      name: loan.name,
    }))
  }

  const handleUndoRepayment = async (actionId: string, loanId?: string) => {
    if (!guardSensitive()) return
    const loan = loans.find(item => item.id === loanId)
    // Flagged as an undo so it gets the undo-confirmation toast and never offers an Undo of its own.
    mutateQueue(queue => enqueue(queue, 'loan', 'undoRepayment', actionId, {
      loanId,
      name: loan?.name,
    }, true))
  }

  return {
    handleAddLoan,
    handleUpdateLoan,
    handleDeleteLoan,
    requestDeleteLoan,
    handleAdvanceRepayment,
    handleFullSettlement,
    handleUndoRepayment,
  }
}
