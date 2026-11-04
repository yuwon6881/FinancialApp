import type { InvestmentHistory, InvestmentHistoryYear } from '../types'

/** `+12.3%` / `−4.0%`: a return is read as a direction first, so the sign is always shown. */
export function formatSignedPercent(value: number, digits = 1): string {
  const rounded = Number(value.toFixed(digits))
  if (rounded === 0) return `${(0).toFixed(digits)}%`
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded).toFixed(digits)}%`
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

/** `2026 so far` for a year that has not finished; a full year is just its number. */
export function yearLabel(year: InvestmentHistoryYear): string {
  return year.isFullYear ? String(year.year) : `${year.year} to ${monthLabel(year.periodEnd).split(' ')[0]}`
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
