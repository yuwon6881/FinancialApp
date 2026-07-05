export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// A "cycle" is a custom day-of-month-to-day-of-month range driven by the user's
// configured cycleDay, not a calendar month (cycleDay === 1 degenerates to one).
export function getCycleRangeDates(year: number, monthIndex: number, cycleDay: number): { start: Date; end: Date } {
  if (cycleDay === 1) {
    const start = new Date(year, monthIndex - 1, 1)
    const end = new Date(year, monthIndex, 0)
    start.setHours(0, 0, 0, 0)
    end.setHours(23, 59, 59, 999)
    return { start, end }
  }
  const daysInStartMonth = new Date(year, monthIndex, 0).getDate()
  const startDayActual = Math.min(cycleDay, daysInStartMonth)
  const start = new Date(year, monthIndex - 1, startDayActual)
  start.setHours(0, 0, 0, 0)

  const end = new Date(start)
  end.setMonth(end.getMonth() + 1)
  end.setDate(end.getDate() - 1)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

export function getStartOfNCyclesAgo(activeYear: number, activeMonthIndex: number, cycleDay: number, n: number): Date {
  let curMonth = activeMonthIndex
  let curYear = activeYear

  for (let i = 0; i < n - 1; i++) {
    curMonth--
    if (curMonth < 1) {
      curMonth = 12
      curYear--
    }
  }

  const { start } = getCycleRangeDates(curYear, curMonth, cycleDay)
  return start
}

export function formatDateForApi(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}
