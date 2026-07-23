import type React from 'react'
import { formatCurrencyVal, getCurrencySymbol } from '../../lib/utils'
import { SensitiveMask } from '../ui/SensitiveAmount'

// Format currency
export const formatCurrencyAmount = (val: number, currency: string | undefined): string => {
  return formatCurrencyVal(val, currency || 'USD')
}

export const formatSensitiveAmount = (
  val: number,
  hideSensitive: boolean,
  currency: string | undefined
): React.ReactNode => {
  return hideSensitive ? (
    <SensitiveMask className="text-foreground" />
  ) : (
    <span className="transition-[filter] duration-200">{formatCurrencyAmount(val, currency)}</span>
  )
}

export const formatCompactNetValue = (val: number, currency: string | undefined): string => {
  const abs = Math.abs(Math.round(val))
  const symbol = getCurrencySymbol(currency || 'USD')
  if (abs >= 1000000) {
    return `${val < 0 ? '-' : '+'}${symbol}${(abs / 1000000).toFixed(1).replace(/\.0$/, '')}M`
  }
  if (abs >= 1000) {
    return `${val < 0 ? '-' : '+'}${symbol}${(abs / 1000).toFixed(1).replace(/\.0$/, '')}k`
  }
  return `${val < 0 ? '-' : '+'}${symbol}${abs}`
}

export const formatCompactSensitiveAmount = (
  val: number,
  hideSensitive: boolean,
  currency: string | undefined
): React.ReactNode => {
  return hideSensitive ? (
    <SensitiveMask className="text-foreground" />
  ) : (
    <span className="transition-[filter] duration-200">{formatCompactNetValue(val, currency)}</span>
  )
}
