import type { InvestmentActivity, InvestmentCashFlow } from '../types'

const day = (value?: string) => {
  if (!value) return 0
  const parsed = Date.parse(`${value}T00:00:00.000Z`)
  return Number.isFinite(parsed) ? parsed : 0
}

// Optimistic rows queued offline have no server timestamp yet. Treating them as
// the newest entry of their day keeps a freshly added row at the top of that day
// instead of letting it drop below existing rows and then jump on reconcile.
const created = (value?: string) => {
  if (!value) return Number.POSITIVE_INFINITY
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY
}

/**
 * Mirrors the server ordering (trade date desc, created desc, id desc) so an edited
 * date moves the row immediately and the backend response only confirms the position.
 */
export function compareActivityNewestFirst(a: InvestmentActivity, b: InvestmentActivity): number {
  const dayDiff = day(b.tradeDate) - day(a.tradeDate)
  if (dayDiff !== 0) return dayDiff
  // Compared, not subtracted, because a missing timestamp resolves to Infinity.
  const createdA = created(a.createdAt)
  const createdB = created(b.createdAt)
  if (createdA !== createdB) return createdB > createdA ? 1 : -1
  return String(b.id).localeCompare(String(a.id))
}

/** Cash movements use creation time for same-day ordering, matching the server. */
export function compareCashFlowNewestFirst(a: InvestmentCashFlow, b: InvestmentCashFlow): number {
  const dayDiff = day(b.date) - day(a.date)
  if (dayDiff !== 0) return dayDiff
  const createdA = created(a.createdAt)
  const createdB = created(b.createdAt)
  if (createdA !== createdB) return createdB > createdA ? 1 : -1
  return String(b.id).localeCompare(String(a.id))
}

export const sortActivityNewestFirst = (rows: InvestmentActivity[]) =>
  [...rows].sort(compareActivityNewestFirst)

export const sortCashFlowsNewestFirst = (rows: InvestmentCashFlow[]) =>
  [...rows].sort(compareCashFlowNewestFirst)
