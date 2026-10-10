import type { ActiveRecurringPayment, RecurringPayment } from '../types'
import { hasBillingEnded } from './recurringPayments'

/** Where a bill sits on the Bills list: what needs paying first comes first. */
export type BillGroupId = 'overdue' | 'due-soon' | 'later' | 'paid' | 'paused'

export const BILL_GROUP_ORDER: readonly BillGroupId[] = ['overdue', 'due-soon', 'paid', 'later', 'paused']

export const BILL_GROUP_LABELS: Record<BillGroupId, string> = {
  overdue: 'Overdue',
  'due-soon': 'Due this week',
  later: 'Later',
  paid: 'Paid this cycle',
  paused: 'Paused',
}

export interface BillCycleState {
  group: BillGroupId
  /** The occurrence this cycle the row is about: the first one still owed, else the latest settled. */
  occurrence: ActiveRecurringPayment | null
  /** The date the row talks about (yyyy-MM-dd), when there is one. */
  date: string | null
  /** Whole days from today to `date`; negative when it has passed. */
  daysAway: number | null
  ended: boolean
}

const DAY_MS = 86_400_000
const DUE_SOON_DAYS = 7

const isSettled = (status: ActiveRecurringPayment['status']) => status === 'Paid' || status === 'SettledByLoanPayoff'
const isOwed = (status: ActiveRecurringPayment['status']) => status === 'Pending' || status === 'PartiallyPaid'

function dayNumber(iso: string): number {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number)
  return Math.round(Date.UTC(year, month - 1, day) / DAY_MS)
}

function todayNumber(today: Date): number {
  return Math.round(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) / DAY_MS)
}

/**
 * Sorts one bill into its group from this cycle's occurrences. A bill with nothing in the cycle
 * (an annual one due in another month, say) is placed by its next due date instead.
 */
export function getBillCycleState(
  payment: RecurringPayment,
  occurrences: readonly ActiveRecurringPayment[],
  today: Date = new Date(),
): BillCycleState {
  const ended = hasBillingEnded(payment, today)
  const own = occurrences
    .filter(occurrence => occurrence.recurringPaymentId === payment.id)
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate))
  const owed = own.find(occurrence => isOwed(occurrence.status)) ?? null
  const settled = [...own].reverse().find(occurrence => isSettled(occurrence.status)) ?? null
  const now = todayNumber(today)
  const away = (date: string | null) => (date ? dayNumber(date) - now : null)

  if (!payment.active || ended) {
    return { group: 'paused', occurrence: owed ?? settled, date: ended ? payment.endDate ?? null : null, daysAway: null, ended }
  }
  if (!owed && settled) {
    const date = settled.paidDate?.slice(0, 10) || settled.dueDate
    return { group: 'paid', occurrence: settled, date, daysAway: away(date), ended }
  }

  const date = owed?.dueDate ?? payment.nextDueDate ?? null
  const daysAway = away(date)
  const group: BillGroupId = daysAway == null
    ? 'later'
    : daysAway < 0
      ? 'overdue'
      : daysAway < DUE_SOON_DAYS ? 'due-soon' : 'later'
  return { group, occurrence: owed, date, daysAway, ended }
}

/** The short line under a bill's name: when it is due, or when it was paid. */
export function describeBillDue(state: BillCycleState, formatDate: (iso: string) => string): string {
  if (state.group === 'paused') {
    return state.ended && state.date ? `Ended ${formatDate(state.date)}` : 'Paused'
  }
  if (state.group === 'paid') {
    const prefix = state.occurrence?.status === 'SettledByLoanPayoff' ? 'Paid off' : 'Paid'
    return state.date ? `${prefix} ${formatDate(state.date)}` : prefix
  }
  if (state.date == null || state.daysAway == null) return 'No date this cycle'
  if (state.daysAway < -1) return `${-state.daysAway} days overdue`
  if (state.daysAway === -1) return 'Due yesterday'
  if (state.daysAway === 0) return 'Due today'
  if (state.daysAway === 1) return 'Due tomorrow'
  if (state.daysAway < DUE_SOON_DAYS) return `Due in ${state.daysAway} days`
  return `Due ${formatDate(state.date)}`
}

/** Keeps the incoming (already sorted) order inside each group, and drops groups with no bills. */
export function groupBills<T extends { state: BillCycleState }>(rows: readonly T[]): Array<{ id: BillGroupId; label: string; rows: T[] }> {
  return BILL_GROUP_ORDER
    .map(id => ({ id, label: BILL_GROUP_LABELS[id], rows: rows.filter(row => row.state.group === id) }))
    .filter(group => group.rows.length > 0)
}
