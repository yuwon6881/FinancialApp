import type { RecurringFrequency, RecurringPayment, RecurringPaymentMode, RecurringReminderMode, RecurringReminderSettings, Transaction } from '../types'

/** The only fields the occurrence arithmetic below reads off a ledger row. */
export type OccurrenceTransaction = Pick<
  Transaction,
  'amount' | 'ledgerCategory' | 'recurringPaymentId' | 'recurringOccurrenceDate'
>

export function normalizeRecurringFrequency(value: unknown): RecurringFrequency {
  return value === 'Annually' ? 'Annually' : 'Monthly'
}

// Default reminder configuration for a subscription that has never had one saved --
// new and previously-migrated recurring payments start disabled (opt-in only).
//
// These must be the values the server stores for a bill that has never had a reminder saved
// (RecurringPayment's PushReminderMode/PushReminderLeadDays defaults, and the matching column
// defaults). A different lead day here is only ever seen before the first sync, which made a newly
// added bill advertise a reminder window the server was never going to use.
export const DEFAULT_REMINDER_SETTINGS: RecurringReminderSettings = {
  enabled: false,
  mode: 'Once',
  leadDays: 1,
}

export const REMINDER_LEAD_DAY_OPTIONS: readonly number[] = [7, 3, 2, 1]

function parseDateOnly(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, (month || 1) - 1, day || 1)
}

function formatDateOnly(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Advances a recurring payment's due date by one cycle (Monthly/Annually), clamping to the
// last valid day of the resulting month so e.g. Jan 31 -> Feb 28/29 rather than overflowing
// into March.
export function computeNextOccurrenceDate(payment: Pick<RecurringPayment, 'nextDueDate' | 'frequency'> & Partial<Pick<RecurringPayment, 'dueDate' | 'startDate' | 'endDate'>>): string | null {
  if (!payment.nextDueDate) return null
  const current = parseDateOnly(payment.nextDueDate)
  const day = payment.dueDate ?? current.getDate()
  const monthsToAdd = payment.frequency === 'Annually' ? 12 : 1
  const annualAnchorMonth = payment.startDate ? parseDateOnly(payment.startDate).getMonth() : current.getMonth()
  const targetMonthIndex = payment.frequency === 'Annually'
    ? annualAnchorMonth
    : current.getMonth() + monthsToAdd
  const targetYear = payment.frequency === 'Annually'
    ? current.getFullYear() + 1
    : current.getFullYear() + Math.floor(targetMonthIndex / 12)
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12
  const lastDayOfTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate()
  const clampedDay = Math.min(day, lastDayOfTargetMonth)
  const next = formatDateOnly(new Date(targetYear, targetMonth, clampedDay))
  return payment.endDate && next > payment.endDate ? null : next
}

export function computeOccurrenceOnOrAfter(
  payment: Pick<RecurringPayment, 'frequency' | 'dueDate' | 'startDate'> & Partial<Pick<RecurringPayment, 'endDate'>>,
  date: string
): string | null {
  const start = parseDateOnly(payment.startDate)
  const target = parseDateOnly(date)
  const dueDay = Math.max(1, Math.min(31, payment.dueDate))
  const annual = payment.frequency === 'Annually'
  // Monthly searches from whichever bound is later; deriving the month from the two month numbers
  // looked equivalent but skipped ahead whenever the target fell in a year before the start.
  // Mirrors RecurringOccurrenceService.FindOccurrenceOnOrAfter.
  const floor = target > start ? target : start
  let year = annual ? Math.max(start.getFullYear(), target.getFullYear()) : floor.getFullYear()
  let month = annual ? start.getMonth() : floor.getMonth()

  const anchoredDate = () => {
    const lastDay = new Date(year, month + 1, 0).getDate()
    return new Date(year, month, Math.min(dueDay, lastDay))
  }
  let candidate = anchoredDate()
  if (candidate < start || candidate < target) {
    if (annual) year++
    else if (++month === 12) { month = 0; year++ }
    candidate = anchoredDate()
  }
  const result = formatDateOnly(candidate)
  return payment.endDate && result > payment.endDate ? null : result
}

/**
 * What one occurrence has already taken, and what it still owes.
 *
 * Mirrors the server's `RecurringOccurrenceAmounts`, and has to keep its two rules: a row in the
 * `Discarded` bucket is a marker carrying no money, and the sign of a stored amount is not a
 * contract, so magnitudes are summed rather than signed values.
 */
export function occurrencePaidSoFar(
  transactions: readonly OccurrenceTransaction[],
  recurringPaymentId: string,
  occurrenceDate: string,
): number {
  return transactions.reduce((total, transaction) => {
    if (transaction.recurringPaymentId !== recurringPaymentId) return total
    if (transaction.recurringOccurrenceDate !== occurrenceDate) return total
    if ((transaction.ledgerCategory || '').toLowerCase() === 'discarded') return total
    return total + Math.abs(transaction.amount)
  }, 0)
}

export function occurrenceRemaining(scheduledAmount: number, paidSoFar: number): number {
  return Math.max(0, Math.abs(scheduledAmount) - paidSoFar)
}

// True once a subscription's end date has passed. Such a row can stay flagged `active` (the
// toggle is the user's pause switch, not an expiry flag) but it no longer bills, so it must not
// count toward committed spend.
export function hasBillingEnded(
  payment: Pick<RecurringPayment, 'endDate'>,
  today: Date = new Date()
): boolean {
  if (!payment.endDate) return false
  return payment.endDate < formatDateOnly(today)
}

// What the two payment modes are called on screen. Kept next to the eligibility rule so no call
// site spells the words itself and the stored codes never reach the UI.
export const RECURRING_PAYMENT_MODE_LABELS: Record<RecurringPaymentMode, string> = {
  AutoDeduct: 'Auto deduct',
  Manual: 'Manual payment',
}

// "Pay Early" is only offered for an active subscription whose next due date is strictly in
// the future -- due-today/overdue subscriptions keep the normal pay flow unchanged.
export function isEligibleForPayEarly(
  payment: Pick<RecurringPayment, 'active' | 'nextDueDate' | 'paymentMode'>,
  today: Date = new Date()
): boolean {
  // An auto-deducted bill is moved by the bank on its own schedule, so there is nothing to bring
  // forward -- paying it here would record money that is still going to leave on the due date.
  // The server enforces the same rule; this only keeps the button off screen.
  if (payment.paymentMode === 'AutoDeduct') return false
  if (!payment.active) return false
  if (!payment.nextDueDate) return false
  const dueDate = parseDateOnly(payment.nextDueDate)
  const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return dueDate.getTime() > todayDateOnly.getTime()
}

export function getEffectiveReminderSettings(
  payment: Pick<RecurringPayment, 'reminderEnabled' | 'reminderMode' | 'reminderLeadDays'>
): RecurringReminderSettings {
  return {
    enabled: payment.reminderEnabled ?? DEFAULT_REMINDER_SETTINGS.enabled,
    mode: payment.reminderMode ?? DEFAULT_REMINDER_SETTINGS.mode,
    leadDays: payment.reminderLeadDays ?? DEFAULT_REMINDER_SETTINGS.leadDays,
  }
}

export type ReminderEffectiveState = 'off' | 'paused' | 'active'

// The reminder's effective state folds in the *global* Push Payment Reminders toggle: a
// per-subscription reminder that is configured "on" is only ever actually sent while the
// global feature is enabled, so the card must visually distinguish "off" from "paused".
export function getReminderEffectiveState(
  payment: Pick<RecurringPayment, 'reminderEnabled' | 'reminderMode' | 'reminderLeadDays'>,
  globalPushEnabled: boolean
): ReminderEffectiveState {
  const settings = getEffectiveReminderSettings(payment)
  if (!settings.enabled) return 'off'
  return globalPushEnabled ? 'active' : 'paused'
}

function formatLeadDaysLabel(leadDays: number): string {
  return `${leadDays} day${leadDays === 1 ? '' : 's'}`
}

// Exact human-readable preview of when a reminder will fire, shown live in the card editor.
export function buildReminderPreview(mode: RecurringReminderMode, leadDays: number): string {
  return mode === 'Daily'
    ? `Daily reminders from ${formatLeadDaysLabel(leadDays)} before until it's due.`
    : `One reminder ${formatLeadDaysLabel(leadDays)} before it's due.`
}
