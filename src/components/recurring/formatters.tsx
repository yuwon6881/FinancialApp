import type React from 'react'
import type { RecurringFrequency } from '../../types'
import { formatCurrencyVal } from '../../lib/utils'
import { SensitiveMask } from '../ui/SensitiveAmount'

// Ordinal suffix for a day-of-month (1st, 2nd, 3rd, 4th, ... 11th-13th).
export const getDayWithSuffix = (day: number) => {
  if (day >= 11 && day <= 13) return `${day}th`
  if (day % 10 === 1) return `${day}st`
  if (day % 10 === 2) return `${day}nd`
  if (day % 10 === 3) return `${day}rd`
  return `${day}th`
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const

function getMonthName(date: string): string | undefined {
  const month = Number(date.slice(5, 7))
  return Number.isInteger(month) && month >= 1 && month <= MONTH_NAMES.length
    ? MONTH_NAMES[month - 1]
    : undefined
}

export const getRecurrenceDescription = (
  frequency: RecurringFrequency,
  startDate: string,
  dueDate: number,
): string => {
  const day = getDayWithSuffix(dueDate)
  if (frequency !== 'Annually') return `Every month on the ${day}`

  const month = getMonthName(startDate)
  return month ? `Every year on ${month} ${day}` : `Every year on the ${day}`
}

export const formatCurrencyAmount = (val: number, currency: string): string => {
  return formatCurrencyVal(val, currency)
}

export const formatSensitiveAmount = (
  val: number,
  hideSensitive: boolean,
  currency: string
): React.ReactNode => {
  return hideSensitive
    ? <SensitiveMask />
    : <span className="transition-[filter] duration-200">{formatCurrencyAmount(val, currency)}</span>
}

export function getOccurrenceStatusLabel(status: string): string {
  switch (status) {
    case 'PartiallyPaid':
      return 'Part paid'
    case 'SettledByLoanPayoff':
      return 'Paid off'
    case 'Paid':
      return 'Paid'
    case 'Discarded':
      return 'Discarded'
    default:
      return 'Pending'
  }
}
