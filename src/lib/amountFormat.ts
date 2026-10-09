/**
 * Splits a currency amount into the pieces Lumen sets at different weights: the currency marker,
 * the whole units and the fraction. `formatCurrencyVal` stays the single source of locale and
 * symbol rules; this reads the same Intl formatter through `formatToParts` so the two can never
 * disagree on grouping, symbol or sign.
 */
export interface AmountParts {
  sign: '' | '-' | '+'
  currency: string
  /** Whole units with grouping separators, e.g. `12,480`. */
  integer: string
  /** The decimal separator and digits, e.g. `.25`; empty for zero-decimal currencies. */
  fraction: string
  /** Whether the currency marker is written after the number in this locale. */
  currencyAfter: boolean
}

const LOCALE_BY_CURRENCY: Record<string, string> = {
  MYR: 'en-MY',
  CNY: 'zh-CN',
  EUR: 'en-IE',
  GBP: 'en-GB',
  SGD: 'en-SG',
}

const formatterCache = new Map<string, Intl.NumberFormat>()

function formatterFor(currencyCode: string): Intl.NumberFormat {
  const code = currencyCode.toUpperCase() === 'RM' ? 'MYR' : currencyCode.toUpperCase()
  const cached = formatterCache.get(code)
  if (cached) return cached
  let formatter: Intl.NumberFormat
  try {
    formatter = new Intl.NumberFormat(LOCALE_BY_CURRENCY[code] ?? 'en-US', { style: 'currency', currency: code })
  } catch {
    formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
  }
  formatterCache.set(code, formatter)
  return formatter
}

export function formatAmountParts(
  value: number,
  currencyCode = 'MYR',
  signDisplay: 'auto' | 'always' | 'never' = 'auto',
): AmountParts {
  const safe = Number.isFinite(value) ? value : 0
  const parts = formatterFor(currencyCode).formatToParts(Math.abs(safe))
  let currency = ''
  let integer = ''
  let fraction = ''
  let seenNumber = false
  let currencyAfter = false
  for (const part of parts) {
    if (part.type === 'currency') {
      currency = part.value
      currencyAfter = seenNumber
    } else if (part.type === 'integer' || part.type === 'group') {
      integer += part.value
      seenNumber = true
    } else if (part.type === 'decimal' || part.type === 'fraction') {
      fraction += part.value
    }
  }
  const isNegative = safe < 0 && Math.abs(safe) >= 0.005
  const sign: AmountParts['sign'] = signDisplay === 'never'
    ? ''
    : isNegative
      ? '-'
      : signDisplay === 'always' && Math.abs(safe) >= 0.005
        ? '+'
        : ''
  return { sign, currency, integer, fraction, currencyAfter }
}
