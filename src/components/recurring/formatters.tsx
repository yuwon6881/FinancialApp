import type React from 'react'
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
