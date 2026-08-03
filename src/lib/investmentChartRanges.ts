import type { InvestmentRange } from '../types'

/**
 * The ranges offered by every investment chart. Mirrors `InvestmentChartRange` on
 * the backend, which rejects anything not in its own list — keep the two in step.
 *
 * Long ranges are safe to offer: the API caps any chart at ~180 points, so "All"
 * over twenty years renders exactly as much as "1M" does.
 */
export const chartRanges: Array<{ value: InvestmentRange; label: string }> = [
  { value: '1m', label: '1M' },
  { value: '3m', label: '3M' },
  { value: '6m', label: '6M' },
  { value: '1y', label: '1Y' },
  { value: '3y', label: '3Y' },
  { value: '5y', label: '5Y' },
  { value: 'all', label: 'All' },
]
