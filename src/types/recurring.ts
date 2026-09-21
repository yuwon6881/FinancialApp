import type { Transaction } from './ledger'

export type RecurringFrequency = 'Monthly' | 'Annually'

// 'Once' sends a single reminder `leadDays` before the due date; 'Daily' sends one every day
// from `leadDays` before the due date through the due date itself.
export type RecurringReminderMode = 'Once' | 'Daily'

// How the money actually leaves the account. 'AutoDeduct' means the bank moves it on the due date;
// 'Manual' means the user sends it themselves each cycle -- and only those can be paid ahead of
// time, since a direct debit cannot be brought forward. See lib/recurringPayments's
// isEligibleForPayEarly, which is the single place that decision is made.
export type RecurringPaymentMode = 'AutoDeduct' | 'Manual'

export interface RecurringPayment {
  id: string
  name: string
  amount: number
  frequency: RecurringFrequency
  category: string
  ledgerCategory: string
  accountId: string
  nextDueDate: string | null
  dueDate: number // Day of month (1-31)
  startDate: string // Date (yyyy-MM-dd)
  active: boolean
  // Required, not optional: the server migration backfilled every existing row to 'Manual', so a
  // payment without a mode is a bug rather than a state to render around.
  paymentMode: RecurringPaymentMode
  endDate?: string
  isPendingSync?: boolean
  /** Internal optimistic projection marker for a queue op that changes this row indirectly. */
  pendingSyncOperationId?: string
  // Set locally while a delete op for this record is still queued/in-flight in the outbox.
  isPendingDelete?: boolean
  // Per-subscription push reminder configuration. Undefined/false means the reminder is off --
  // new and previously-migrated subscriptions default to off (opt-in only).
  reminderEnabled?: boolean
  reminderMode?: RecurringReminderMode
  reminderLeadDays?: number
  linkedLoanId?: string | null
  linkedLoanName?: string | null
}

export type LoanInterestMethod = 'ReducingBalance' | 'ReducingBalanceDaily' | 'Flat' | 'InterestOnly'
export type LoanRateBasis = 'Yearly' | 'Monthly'
export type LoanScheduleStatus = 'Complete' | 'Incomplete'

export interface LoanPaymentSplit {
  occurrenceDate: string
  payment: number
  interest: number
  principal: number
  balanceBefore: number
  balanceAfter: number
  surplus: number
  paymentDidNotCoverInterest: boolean
  transactionId?: string | null
}

export interface LoanScheduleEntry {
  occurrenceDate: string
  payment: number
  interest: number
  principal: number
  balanceAfter: number
}

export interface LoanSnapshot {
  outstandingBalance: number
  scheduledPayment: number
  totalScheduledInterest: number
  totalInterestPaid: number
  payoffDate?: string | null
  lastOccurrenceDate?: string | null
  nextPayment?: LoanScheduleEntry | null
  payments: LoanPaymentSplit[]
  futureSchedule: LoanScheduleEntry[]
}

export interface Loan {
  id: string
  name: string
  recurringPaymentId: string
  openingPrincipal: number
  trackingStartDate: string
  annualRatePercent: number
  termPeriods: number
  interestMethod: LoanInterestMethod
  rateBasis?: LoanRateBasis
  recurringPaymentExists?: boolean
  recurringPaymentName?: string | null
  recurringPaymentFrequency?: RecurringFrequency | null
  recurringPaymentDueDate?: number | null
  recurringPaymentLedgerCategory?: string | null
  scheduleFrequency?: RecurringFrequency | null
  scheduleDueDay?: number | null
  scheduleStartDate?: string | null
  scheduleStatus?: LoanScheduleStatus
  /** Present only while a full settlement stands; it is the handle needed to undo that payoff. */
  settlementActionId?: string
  snapshot: LoanSnapshot
  isPendingSync?: boolean
  pendingSyncOperationId?: string
  isPendingDelete?: boolean
  isRecalculating?: boolean
}

export interface LoanRepaymentPreviewCycle {
  occurrenceDate: string
  payment: number
  interest: number
  principal: number
  balanceAfter: number
}

export interface LoanRepaymentPreviewResult {
  cyclesCount: number
  totalAmount: number
  occurrences: LoanRepaymentPreviewCycle[]
  previewFingerprint: string
}

export interface LoanRepaymentActionResult {
  actionId: string
  kind: 'AdvanceCycles' | 'FullSettlement'
  loan: Loan
  transactions: Transaction[]
}

/** The two notification kinds. Each is opted into separately, and per device. */
export type PushChannel = 'billReminders' | 'categoryAlerts'

/**
 * What this device receives, plus whether any other device receives it.
 *
 * `billRemindersEnabled`/`categoryAlertsEnabled` are **this device's** state and are what the two
 * switches render from. `otherDevices*` is informational only: rendering an account-wide flag as a
 * switch state told a desktop it was receiving spending alerts a phone had turned on.
 * `tokenRenewalRequired` is a transport repair hint, never an opt-in state.
 */
export interface PushStatus {
  enabled: boolean
  deviceRegistered: boolean
  tokenRenewalRequired: boolean
  billRemindersEnabled: boolean
  categoryAlertsEnabled: boolean
  showNotificationDetails: boolean
  otherDevicesBillReminders: boolean
  otherDevicesCategoryAlerts: boolean
}

export interface PushDevice {
  id: string
  isCurrent: boolean
  billRemindersEnabled: boolean
  categoryAlertsEnabled: boolean
  enrolledAt: string
  lastUpdatedAt: string
}

export interface RecurringReminderSettings {
  enabled: boolean
  mode: RecurringReminderMode
  leadDays: number
}

// Returned by pay-early: the ledger transaction it posted plus the occurrence date it settled,
// so the caller can advance the subscription's own local nextDueDate without a full reload.
export interface PayEarlyResult {
  transaction: Transaction
  settledOccurrenceDate: string
  nextOccurrenceDate?: string | null
}

export interface RecurringSettlementResult {
  occurrence: ActiveRecurringPayment
  transaction?: Transaction | null
  nextOccurrenceDate?: string | null
}

export interface ActiveRecurringPayment {
  id: string
  recurringPaymentId: string
  name: string
  amount: number | null
  scheduledAmount?: number | null
  paidAmount?: number
  remainingAmount?: number
  category: string
  ledgerCategory: string
  dueDate: string
  dueDay?: number
  isPaid: boolean
  isDiscarded: boolean
  status: "Pending" | "PartiallyPaid" | "Paid" | "Discarded" | "SettledByLoanPayoff"
  paidDate?: string | null
}
