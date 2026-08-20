import { getCycleYearAndMonthForDate, MONTH_NAMES } from './cycle'
import { getCycleLabelForDropdown } from './cycleLabels'

const parseLocalDate = (value: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12)
  return Number.isNaN(date.getTime()) ? null : date
}

export interface TransactionCyclePlacement {
  month: string
  year: number
  label: string
}

export function getTransactionCyclePlacement(dateValue: string, cycleDay: number): TransactionCyclePlacement | null {
  const date = parseLocalDate(dateValue)
  if (!date) return null
  const cycle = getCycleYearAndMonthForDate(date, cycleDay)
  const month = MONTH_NAMES[cycle.monthIndex - 1]
  if (!month) return null
  return {
    month,
    year: cycle.year,
    label: `${getCycleLabelForDropdown(month, cycle.year, cycleDay)}, ${cycle.year}`,
  }
}

export function isTransactionOutsideCycle(
  dateValue: string,
  selectedMonth: string | undefined,
  selectedYear: number | undefined,
  cycleDay: number,
): boolean {
  if (!selectedMonth || !selectedYear) return false
  const placement = getTransactionCyclePlacement(dateValue, cycleDay)
  return placement != null && (placement.month !== selectedMonth || placement.year !== selectedYear)
}
