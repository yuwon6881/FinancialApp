import type { ActiveRecurringPayment, Transaction } from '../types'
import { getCycleRangeDates } from './cycle'
import { isReportableCashMovement } from './transactionReportSemantics'

const MONTH_INDEX: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
}

export const formatCalendarDate = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export interface CycleCalendarDay {
  date: Date
  dateKey: string
  net?: number
  activity: number
  heatLevel: 0 | 1 | 2 | 3 | 4
  recurringNames: string[]
}

export function buildCycleCalendar(options: {
  selectedMonth: string
  selectedYear: number
  cycleDay: number
  transactions: Transaction[]
  recurringPayments: ActiveRecurringPayment[]
}): { startDayOfWeek: number; days: CycleCalendarDay[] } {
  const monthIndex = MONTH_INDEX[options.selectedMonth] ?? 0
  const { start, end } = getCycleRangeDates(options.selectedYear, monthIndex + 1, options.cycleDay)
  const startKey = formatCalendarDate(start)
  const endKey = formatCalendarDate(end)

  const netByDay = new Map<string, number>()
  const activityByDay = new Map<string, number>()
  for (const transaction of options.transactions) {
    if (transaction.date < startKey || transaction.date > endKey || !isReportableCashMovement(transaction)) continue
    netByDay.set(transaction.date, (netByDay.get(transaction.date) || 0) + transaction.amount)
    activityByDay.set(transaction.date, (activityByDay.get(transaction.date) || 0) + Math.abs(transaction.amount))
  }
  const recurringByDay = new Map<string, string[]>()
  for (const payment of options.recurringPayments) {
    if (payment.dueDate < startKey || payment.dueDate > endKey) continue
    recurringByDay.set(payment.dueDate, [...(recurringByDay.get(payment.dueDate) || []), payment.name])
  }

  const busiestDay = Math.max(0, ...activityByDay.values())
  const days: CycleCalendarDay[] = []
  const cursor = new Date(start)
  while (cursor <= end) {
    const date = new Date(cursor)
    const dateKey = formatCalendarDate(date)
    const activity = activityByDay.get(dateKey) || 0
    const heatLevel = activity === 0 || busiestDay === 0
      ? 0
      : Math.min(4, Math.max(1, Math.ceil((activity / busiestDay) * 4))) as 1 | 2 | 3 | 4
    days.push({
      date,
      dateKey,
      net: netByDay.get(dateKey),
      activity,
      heatLevel,
      recurringNames: recurringByDay.get(dateKey) || [],
    })
    cursor.setDate(cursor.getDate() + 1)
  }
  return { startDayOfWeek: start.getDay(), days }
}
