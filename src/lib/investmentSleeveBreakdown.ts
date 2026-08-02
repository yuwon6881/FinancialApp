import type { InvestmentPortfolio } from '../types'
import { sleeveOf, type SleeveIndexEntry } from './investmentAllocation'

type InvestmentHolding = InvestmentPortfolio['holdings'][number]

export type SleeveConstituent = InvestmentHolding & { shareOfSleeve?: number }

/**
 * Groups holdings into the plan's baskets, keyed by sleeve key — never by label,
 * see the note on `SleeveIndexEntry`. A holding with no value yet keeps an
 * `undefined` share rather than a misleading 0%.
 */
export function breakdownBySleeve(
  holdings: InvestmentHolding[],
  sleeveIndex: Map<string, SleeveIndexEntry>,
): Map<string, SleeveConstituent[]> {
  const grouped = new Map<string, InvestmentHolding[]>()
  holdings.forEach(holding => {
    const { key } = sleeveOf(holding, sleeveIndex)
    grouped.set(key, [...(grouped.get(key) ?? []), holding])
  })

  return new Map([...grouped].map(([key, constituents]) => {
    const valuedTotal = constituents
      .flatMap(holding => holding.valueApp === undefined ? [] : [holding.valueApp])
      .reduce((sum, value) => sum + value, 0)
    return [key, constituents
      .map<SleeveConstituent>(holding => ({
        ...holding,
        shareOfSleeve: holding.valueApp === undefined || valuedTotal <= 0
          ? undefined
          : holding.valueApp / valuedTotal * 100,
      }))
      .sort((left, right) => (right.valueApp ?? Number.NEGATIVE_INFINITY) - (left.valueApp ?? Number.NEGATIVE_INFINITY))]
  }))
}
