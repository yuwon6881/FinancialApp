// Ordinal-suffix + cycle-label helpers. Previously duplicated verbatim across
// DashboardView, LedgerView (getCycleLabelForDropdown / getSuffix) and
// BillTimeline (getDaySuffix). Kept as pure string/date math so it is trivially
// unit-testable and shared from one place.

import { getCycleRangeDates } from './cycle'

const MONTH_ABBREVS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Ordinal suffix for a day-of-month, e.g. 1 -> "st", 2 -> "nd", 11 -> "th". */
export function ordinalSuffix(d: number): string {
  if (d >= 11 && d <= 13) return 'th'
  switch (d % 10) {
    case 1: return 'st'
    case 2: return 'nd'
    case 3: return 'rd'
    default: return 'th'
  }
}

/** Full ordinal for a day-of-month, e.g. 1 -> "1st", 22 -> "22nd". */
export function ordinal(d: number): string {
  return `${d}${ordinalSuffix(d)}`
}

/**
 * Human-readable label for a budget cycle, given the cycle's anchor month/year
 * and the configured cycle start day. Matches the format shown in the month
 * dropdown, e.g. "Jun 28th ~ Jul 27th" or (for cycleDay 1) "Jul 1st ~ Jul 31st".
 * Returns the input month unchanged if it is not a recognized month abbreviation.
 */
export function getCycleLabelForDropdown(month: string, year: number, cycleDay: number): string {
  const monthIdx = MONTH_ABBREVS.indexOf(month)
  if (monthIdx === -1) return month

  if (cycleDay === 1) {
    const days = new Date(year, monthIdx + 1, 0).getDate()
    return `${month} 1st ~ ${month} ${ordinal(days)}`
  }

  const { start: startDate, end: endDate } = getCycleRangeDates(year, monthIdx + 1, cycleDay)

  const startMonthStr = MONTH_ABBREVS[startDate.getMonth()]
  const endMonthStr = MONTH_ABBREVS[endDate.getMonth()]

  return `${startMonthStr} ${ordinal(startDate.getDate())} ~ ${endMonthStr} ${ordinal(endDate.getDate())}`
}
