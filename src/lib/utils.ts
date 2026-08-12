import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export const SENSITIVE_AMOUNT_MASK = '......'

/**
 * Capitalize the first letter of each whitespace-separated word, leaving the
 * remaining characters untouched so existing casing/acronyms (e.g. "HDMI") are
 * preserved. Used to tidy free-text names/descriptions from the AI assistant's
 * add actions, e.g. "nasi lemak" → "Nasi Lemak", "bills" → "Bills".
 */
export const capitalizeWords = (value: string): string =>
  value.replace(/(^|\s)(\p{L})/gu, (_match, boundary, letter) => boundary + letter.toUpperCase())

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

export const maskCurrencyInput = (rawVal: string, currentValue: string): string => {
  if (!rawVal) return ''

  // Replace standard operators with nice symbols, and allow them in the regex
  let val = rawVal.replace(/\*/g, '×').replace(/\//g, '÷')
  val = val.replace(/[^0-9+\-×÷.]/g, '')

  // Split by operators, capturing them so they are preserved in the array
  const tokens = val.split(/([+\-×÷])/)
  const currentTokens = currentValue ? currentValue.split(/([+\-×÷])/) : []

  const followsMultiplierOrDivisor = (index: number) => {
    const operator = tokens[index - 1]
    if (operator === '×' || operator === '÷') return true

    // Keep a unary sign attached to the scalar operand: `12÷-2` should divide
    // by negative two, not by negative two cents.
    return (operator === '+' || operator === '-')
      && tokens[index - 2] === ''
      && (tokens[index - 3] === '×' || tokens[index - 3] === '÷')
  }

  const formattedTokens = tokens.map((token, index) => {
    // If the token is an operator, keep it as is
    if (/[+\-×÷]/.test(token)) return token
    if (!token) return ''

    // Apply ATM formatting to this specific number token
    const digits = token.replace(/\D/g, '')

    // Multiplication and division operands are counts or factors more often
    // than money, so enter whole numbers by default. A typed decimal point is
    // explicit and switches just that operand to normal decimal entry.
    if (followsMultiplierOrDivisor(index)) {
      const decimalIndex = token.indexOf('.')
      if (decimalIndex >= 0) {
        const wholeDigits = token.slice(0, decimalIndex).replace(/\D/g, '')
        const fractionDigits = token.slice(decimalIndex + 1).replace(/\D/g, '')
        const whole = wholeDigits ? String(parseInt(wholeDigits, 10)) : '0'
        return `${whole}.${fractionDigits}`
      }
      if (!digits) return ''
      return String(parseInt(digits, 10))
    }

    if (!digits) return ''

    const parsed = parseInt(digits, 10)
    if (parsed === 0) {
      const prevToken = currentTokens[index] || ''
      return prevToken === '0.00' || prevToken === '' ? '' : '0.00'
    }

    return (parsed / 100).toFixed(2)
  })

  return formattedTokens.join('')
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
  if (cat.toLowerCase() === 'accountmove') return 'Between accounts'
  if (cat.startsWith('IncomeSplit:')) return 'Income'
  if (cat.startsWith('Transfer:Income->')) {
    return cat.substring(17)
  }
  if (cat.startsWith('Transfer:')) {
    return 'Transfer'
  }
  return cat
}
