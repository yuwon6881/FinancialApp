import type { InvestmentHistory, InvestmentHistoryYear } from '../types'

/** `+12.3%` / `−4.0%`: a return is read as a direction first, so the sign is always shown. */
export function formatSignedPercent(value: number, digits = 1): string {
  const rounded = Number(value.toFixed(digits))
  if (rounded === 0) return `${(0).toFixed(digits)}%`
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded).toFixed(digits)}%`
}

/**
 * Which way a figure points as shown, after rounding to the digits it is displayed with: −0.04%
 * prints as 0.0%, so it must read as flat, not as a loss. Unknown stays unknown.
 */
export function shownDirection(value: number | undefined, digits: number): 'gain' | 'loss' | 'flat' | undefined {
  if (value === undefined) return undefined
  const rounded = Number(value.toFixed(digits))
  return rounded > 0 ? 'gain' : rounded < 0 ? 'loss' : 'flat'
}

/**
 * The one return figure that headlines the history. A yearly rate once a full year exists;
 * before that, the return since the start, labelled as such so a short run is never read as a
 * yearly pace.
 */
export function headlineReturn(history: InvestmentHistory): { label: string; value?: number } {
  const { lifetime } = history
  if (lifetime.annualisedReturnPercent !== undefined)
    return { label: 'Yearly return', value: lifetime.annualisedReturnPercent }
  return { label: 'Return so far', value: lifetime.cumulativeReturnPercent }
}

/** `Oct 2026`, from a server `yyyy-MM-dd` date, without local time-zone drift. */
export function monthLabel(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
}

const shortMonth = (month: number) =>
  new Date(Date.UTC(2000, month - 1, 1)).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })

/**
 * The months a year row covers. A whole calendar year is just its number; a year that started
 * part-way (the first one) or has not finished (this one) names its months: `Jan–Sep 2026`, or
 * `Sep 2026` for a single month. `firstMonth` is the history's first settled month-end.
 */
export function yearLabel(year: InvestmentHistoryYear, firstMonth?: string): string {
  const first = firstMonth ? new Date(`${firstMonth}T00:00:00Z`) : undefined
  const startMonth = first && first.getUTCFullYear() === year.year ? first.getUTCMonth() + 1 : 1
  const endMonth = new Date(`${year.periodEnd}T00:00:00Z`).getUTCMonth() + 1
  if (startMonth === 1 && endMonth === 12) return String(year.year)
  if (startMonth === endMonth) return `${shortMonth(endMonth)} ${year.year}`
  return `${shortMonth(startMonth)}–${shortMonth(endMonth)} ${year.year}`
}

/**
 * Bar widths that let years be compared at a glance: what was added and what the market did,
 * on one shared scale across every year shown. A year whose growth is unknown draws no growth
 * bar rather than a zero-length one that would read as "nothing happened".
 */
export function yearBarScale(years: InvestmentHistoryYear[]): number {
  const largest = Math.max(0, ...years.map(year =>
    Math.abs(year.netContributions ?? 0) + Math.abs(year.growth ?? 0)))
  return largest > 0 ? largest : 1
}
