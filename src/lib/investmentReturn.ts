import type { InvestmentPortfolio } from '../types'
import { xirr, type DatedFlow } from './xirr'

/**
 * The yearly return rate the portfolio has actually earned, accounting for *when*
 * money went in.
 *
 * Gain-on-cost — the "on paper" percentage on the summary cards — flatters a
 * portfolio that has been fed steadily, because money added last month is credited
 * with a full period of growth. This is the honest counterpart.
 *
 * Flows are derived from the movement in cumulative net deposits between charted
 * points, so the figure is only as fine-grained as the chart itself; the chart is
 * capped at ~180 points, which is ample for a yearly rate but means this is an
 * approximation, not an audited number. Any incomplete point voids the result
 * rather than silently biasing it.
 */
export function portfolioAnnualReturn(portfolio: InvestmentPortfolio): number | undefined {
  const points = portfolio.chart
  if (points.length < 2) return undefined

  const flows: DatedFlow[] = []
  let previousDeposits: number | undefined

  for (const point of points) {
    // One unpriced or unconverted point makes every later deposit delta wrong.
    if (point.netDeposits === undefined) return undefined
    if (previousDeposits !== undefined) {
      const added = point.netDeposits - previousDeposits
      // Money in is money out of your pocket, hence the negative sign.
      if (added !== 0) flows.push({ date: point.date, amount: -added })
    } else {
      flows.push({ date: point.date, amount: -point.netDeposits })
    }
    previousDeposits = point.netDeposits
  }

  const last = points[points.length - 1]
  if (last.totalValue === undefined) return undefined
  flows.push({ date: last.date, amount: last.totalValue })

  return xirr(flows)
}
