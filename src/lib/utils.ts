import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export const formatCurrencyVal = (val: number, currencyCode: string = 'USD') => {
  const code = currencyCode.toUpperCase()
  const isoCode = code === 'RM' ? 'MYR' : code
  
  let locale = 'en-US'
  if (isoCode === 'MYR') locale = 'en-MY'
  else if (isoCode === 'CNY') locale = 'zh-CN'
  else if (isoCode === 'EUR') locale = 'en-IE'
  else if (isoCode === 'GBP') locale = 'en-GB'
  else if (isoCode === 'SGD') locale = 'en-SG'
  
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: isoCode
    }).format(val)
  } catch {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(val)
  }
}

// Masks a raw currency input as the user types: strips non-digits, treats the
// value as cents, and renders it as a "0.00"-style decimal string.
export const maskCurrencyInput = (rawVal: string, currentValue: string, allowZero = false): string => {
  if (!rawVal) return ''

  const digits = rawVal.replace(/\D/g, '')
  if (!digits) return ''

  const parsed = parseInt(digits, 10)
  if (parsed === 0) {
    if (allowZero) return '0.00'
    return currentValue === '0.00' || currentValue === '' ? '' : '0.00'
  }

  return (parsed / 100).toFixed(2)
}



export const getCurrencySymbol = (currencyCode: string = 'USD') => {
  const code = currencyCode.toUpperCase()
  if (code === 'RM' || code === 'MYR') return 'RM'
  if (code === 'CNY') return '¥'
  if (code === 'EUR') return '€'
  if (code === 'GBP') return '£'
  if (code === 'SGD') return 'S$'
  return '$'
}

// Maps a raw ledgerCategory value (which may carry an encoded split/transfer
// spec, e.g. "IncomeSplit:50,25,15,10" or "Transfer:Growth-Stability") to the
// label a user should see.
export const displayLedgerCategory = (cat: string) => {
  if (cat.startsWith('IncomeSplit:')) return 'Income'
  if (cat.startsWith('Transfer:Income->')) {
    return cat.substring(17)
  }
  if (cat.startsWith('Transfer:')) {
    return 'Transfer'
  }
  return cat
}