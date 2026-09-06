/**
 * The portfolio's total value for a page that must not load the portfolio itself.
 *
 * The investments page fills the portfolio cache when it is opened, and its `totalValue` is
 * authoritative. Before that the allocation overview -- which the background coordinator loads at
 * startup -- carries the same two parts, so Today can report a figure on a first visit instead of
 * only after a detour through Investments.
 *
 * Both parts arrive absent when the server could not value them, and an absent part leaves the
 * total absent: an unpriced holding or unconvertible broker cash would otherwise be published as a
 * smaller portfolio rather than an unknown one.
 */
export function resolveInvestmentTotalValue(
  cachedPortfolioTotal: number | null | undefined,
  allocation: { investedValue?: number | null; availableCash?: number | null } | null | undefined,
): number | undefined {
  if (typeof cachedPortfolioTotal === 'number') return cachedPortfolioTotal
  const invested = allocation?.investedValue
  const cash = allocation?.availableCash
  if (typeof invested !== 'number' || typeof cash !== 'number') return undefined
  return invested + cash
}
