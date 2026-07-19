import type React from 'react'
import { formatCurrencyVal } from '../../lib/utils'

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

// Blur-based sensitive masking (this view blurs amounts in place rather than
// swapping in a mask string like the dashboard does).
export const formatBlurSensitiveAmount = (
  val: number,
  hideSensitive: boolean,
  currency: string
): React.ReactNode => {
  return (
    <span className={hideSensitive ? 'blur-sm select-none pointer-events-none inline-block transition-[filter] duration-200' : 'transition-[filter] duration-200'}>
      {formatCurrencyAmount(val, currency)}
    </span>
  )
}
