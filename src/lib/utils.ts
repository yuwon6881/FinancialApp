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
  } catch (e) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(val)
  }
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