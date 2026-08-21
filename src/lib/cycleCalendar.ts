import type { ActiveRecurringPayment, Transaction } from '../types'
import { getCycleRangeDates } from './cycle'
import { isReportableCashMovement } from './transactionReportSemantics'

const MONTH_INDEX: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
}

export type CycleHeatmapMode = 'expense' | 'net' | 'activity'

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
  inflow: number
  outflow: number
  activity: number
  heatLevel: 0 | 1 | 2 | 3 | 4
  heatLevels: {
    expense: 0 | 1 | 2 | 3 | 4
    net: 0 | 1 | 2 | 3 | 4
    activity: 0 | 1 | 2 | 3 | 4
  }
  transactions: Transaction[]
  recurring: ActiveRecurringPayment[]
  recurringNames: string[]
  isFuture: boolean
  isToday: boolean
  isWeekend: boolean
  projectedBillsAmount: number
  hasPendingBills: boolean
  hasPaidBills: boolean
}

export interface CycleWeekSummary {
  weekNumber: number
  startDate: string
  endDate: string
  totalOutflow: number
  totalInflow: number
  totalNet: number
  transactionCount: number
}

export interface CycleCalendarStats {
  totalInflow: number
  totalOutflow: number
  totalNet: number
  averageDailySpend: number
  maxExpenseDay: number
  maxActivityDay: number
  noSpendDaysCount: number
}

export interface CycleCalendarResult {
  startDayOfWeek: number
  days: CycleCalendarDay[]
  weeks: CycleWeekSummary[]
  stats: CycleCalendarStats
}

export function buildCycleCalendar(options: {
  selectedMonth: string
  selectedYear: number
  cycleDay: number
  transactions: Transaction[]
  recurringPayments: ActiveRecurringPayment[]
  today?: Date
}): CycleCalendarResult {
  const monthIndex = MONTH_INDEX[options.selectedMonth] ?? 0
  const { start, end } = getCycleRangeDates(options.selectedYear, monthIndex + 1, options.cycleDay)
  const startKey = formatCalendarDate(start)
  const endKey = formatCalendarDate(end)
  const todayKey = formatCalendarDate(options.today ?? new Date())

  const transactionsByDay = new Map<string, Transaction[]>()
  const netByDay = new Map<string, number>()
  const inflowByDay = new Map<string, number>()
  const outflowByDay = new Map<string, number>()
  const activityByDay = new Map<string, number>()

  for (const transaction of options.transactions) {
    if (transaction.date < startKey || transaction.date > endKey || !isReportableCashMovement(transaction)) continue
    
    const dayTransactions = transactionsByDay.get(transaction.date) || []
    dayTransactions.push(transaction)
    transactionsByDay.set(transaction.date, dayTransactions)

    const prevNet = netByDay.get(transaction.date) || 0
    netByDay.set(transaction.date, prevNet + transaction.amount)

    if (transaction.amount > 0) {
      inflowByDay.set(transaction.date, (inflowByDay.get(transaction.date) || 0) + transaction.amount)
    } else if (transaction.amount < 0) {
      outflowByDay.set(transaction.date, (outflowByDay.get(transaction.date) || 0) + Math.abs(transaction.amount))
    }

    activityByDay.set(transaction.date, (activityByDay.get(transaction.date) || 0) + Math.abs(transaction.amount))
  }

  const recurringByDay = new Map<string, ActiveRecurringPayment[]>()
  for (const payment of options.recurringPayments) {
    if (payment.dueDate < startKey || payment.dueDate > endKey) continue
    const list = recurringByDay.get(payment.dueDate) || []
    list.push(payment)
    recurringByDay.set(payment.dueDate, list)
  }

  const rawDays: Omit<CycleCalendarDay, 'heatLevel' | 'heatLevels'>[] = []
  const cursor = new Date(start)
  while (cursor <= end) {
    const date = new Date(cursor)
    const dateKey = formatCalendarDate(date)
    const dayOfWeek = date.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    const isToday = dateKey === todayKey
    const isFuture = dateKey > todayKey

    const dayTransactions = transactionsByDay.get(dateKey) || []
    const dayRecurring = recurringByDay.get(dateKey) || []
    const inflow = inflowByDay.get(dateKey) || 0
    const outflow = outflowByDay.get(dateKey) || 0
    const activity = activityByDay.get(dateKey) || 0
    const net = netByDay.get(dateKey)

    const projectedBillsAmount = dayRecurring.reduce((sum, p) => sum + (p.remainingAmount ?? p.scheduledAmount ?? p.amount ?? 0), 0)
    const hasPendingBills = dayRecurring.some(p => !p.isPaid && !p.isDiscarded && p.status !== 'Paid' && p.status !== 'SettledByLoanPayoff')
    const hasPaidBills = dayRecurring.some(p => p.isPaid || p.status === 'Paid' || p.status === 'SettledByLoanPayoff')

    rawDays.push({
      date,
      dateKey,
      net,
      inflow,
      outflow,
      activity,
      transactions: dayTransactions,
      recurring: dayRecurring,
      recurringNames: dayRecurring.map(p => p.name),
      isFuture,
      isToday,
      isWeekend,
      projectedBillsAmount,
      hasPendingBills,
      hasPaidBills,
    })
    cursor.setDate(cursor.getDate() + 1)
  }

  const busiestActivity = Math.max(0, ...rawDays.map(d => d.activity))
  const busiestExpense = Math.max(0, ...rawDays.map(d => d.outflow))
  const busiestNetAbs = Math.max(0, ...rawDays.map(d => Math.abs(d.net ?? 0)))

  const calculateHeatLevel = (value: number, max: number): 0 | 1 | 2 | 3 | 4 => {
    if (value <= 0 || max <= 0) return 0
    return Math.min(4, Math.max(1, Math.ceil((value / max) * 4))) as 0 | 1 | 2 | 3 | 4
  }

  const days: CycleCalendarDay[] = rawDays.map(day => {
    const expenseHeat = calculateHeatLevel(day.outflow, busiestExpense)
    const activityHeat = calculateHeatLevel(day.activity, busiestActivity)
    const netHeat = calculateHeatLevel(Math.abs(day.net ?? 0), busiestNetAbs)

    return {
      ...day,
      heatLevel: expenseHeat,
      heatLevels: {
        expense: expenseHeat,
        activity: activityHeat,
        net: netHeat,
      },
    }
  })

  // Group into calendar weeks for weekly subtotals
  const weeks: CycleWeekSummary[] = []
  let currentWeekDays: CycleCalendarDay[] = []
  let weekIndex = 1
  const startDayOfWeek = start.getDay()

  days.forEach((day, index) => {
    currentWeekDays.push(day)
    const gridColumn = (startDayOfWeek + index) % 7
    if (gridColumn === 6 || index === days.length - 1) {
      const totalOutflow = currentWeekDays.reduce((acc, d) => acc + d.outflow, 0)
      const totalInflow = currentWeekDays.reduce((acc, d) => acc + d.inflow, 0)
      const totalNet = currentWeekDays.reduce((acc, d) => acc + (d.net ?? 0), 0)
      const transactionCount = currentWeekDays.reduce((acc, d) => acc + d.transactions.length, 0)

      weeks.push({
        weekNumber: weekIndex,
        startDate: currentWeekDays[0].dateKey,
        endDate: currentWeekDays[currentWeekDays.length - 1].dateKey,
        totalOutflow,
        totalInflow,
        totalNet,
        transactionCount,
      })
      currentWeekDays = []
      weekIndex += 1
    }
  })

  const totalInflow = days.reduce((acc, d) => acc + d.inflow, 0)
  const totalOutflow = days.reduce((acc, d) => acc + d.outflow, 0)
  const totalNet = days.reduce((acc, d) => acc + (d.net ?? 0), 0)
  const pastOrTodayDays = days.filter(d => !d.isFuture)
  const noSpendDaysCount = pastOrTodayDays.filter(d => d.outflow === 0).length
  const averageDailySpend = pastOrTodayDays.length > 0 ? totalOutflow / pastOrTodayDays.length : 0

  return {
    startDayOfWeek,
    days,
    weeks,
    stats: {
      totalInflow,
      totalOutflow,
      totalNet,
      averageDailySpend,
      maxExpenseDay: busiestExpense,
      maxActivityDay: busiestActivity,
      noSpendDaysCount,
    },
  }
}
