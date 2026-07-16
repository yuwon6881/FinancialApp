export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// JavaScript's Date#setMonth overflows (Jan 31 + one month becomes March).
// This mirrors .NET DateTime.AddMonths by clamping the original day to the
// target month's last valid day.
export function addMonthsClamped(date: Date, months: number): Date {
  const result = new Date(date)
  const originalDay = result.getDate()
  result.setDate(1)
  result.setMonth(result.getMonth() + months)
  const daysInTargetMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate()
  result.setDate(Math.min(originalDay, daysInTargetMonth))
  return result
}

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

  // The end is the day before the NEXT cycle's clamped start so consecutive cycles
  // tile with no gaps or overlaps. Deriving it from this month's start (addMonthsClamped)
  // drops days whenever cycleDay > 28 and adjacent months clamp to different lengths.
  const nextMonthIndex = monthIndex === 12 ? 1 : monthIndex + 1
  const nextYear = monthIndex === 12 ? year + 1 : year
  const daysInNextMonth = new Date(nextYear, nextMonthIndex, 0).getDate()
  const nextStartDay = Math.min(cycleDay, daysInNextMonth)
  const end = new Date(nextYear, nextMonthIndex - 1, nextStartDay)
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

// The cycle "today" actually falls in, independent of whatever cycle the user
// has navigated to elsewhere (Dashboard/Ledger persist that as the "selected"
// period, which is a different concept -- last viewed, not current). Mirrors
// the backend's GetCycleYearAndMonthIndexForDate.
export function getCurrentCycleYearAndMonth(cycleDay: number): { year: number; monthIndex: number } {
  const now = new Date()
  let year = now.getFullYear()
  let monthIndex = now.getMonth() + 1
  // Clamp cycleDay to this month's length before comparing, matching getCycleRangeDates.
  // A raw "getDate() < cycleDay" would misattribute a clamped last-of-month day
  // (e.g. Feb 28 with cycleDay 31) to the previous cycle, contradicting the range.
  const daysInMonth = new Date(year, monthIndex, 0).getDate()
  const clampedStart = Math.min(cycleDay, daysInMonth)
  if (cycleDay > 1 && now.getDate() < clampedStart) {
    monthIndex--
    if (monthIndex < 1) {
      monthIndex = 12
      year--
    }
  }
  return { year, monthIndex }
}

export function formatDateForApi(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}
