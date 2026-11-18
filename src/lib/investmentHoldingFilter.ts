import type { InvestmentPortfolio } from '../types'
import { sleeveOf, type SleeveIndexEntry } from './investmentAllocation'

type Holding = InvestmentPortfolio['holdings'][number]

export type AllocationMode = 'sleeve' | 'asset' | 'account' | 'instrument' | 'currency'
/** A chosen slice of the allocation chart. `key` is always a stable key, never a label. */
export type AllocationFilter = { mode: AllocationMode; key: string } | null

/**
 * The single definition of "this holding belongs to that slice". The allocation
 * chart and the holdings table both read it, so a slice can never highlight one
 * set of funds while the table lists another.
 */
export function matchesAllocationFilter(
  holding: Holding,
  filter: AllocationFilter,
  sleeveIndex: Map<string, SleeveIndexEntry>,
): boolean {
  if (!filter) return true
  switch (filter.mode) {
    case 'sleeve': return sleeveOf(holding, sleeveIndex).key === filter.key
    case 'asset': return holding.type === filter.key
    case 'instrument': return holding.symbol === filter.key
    case 'account': return holding.accountName === filter.key
    case 'currency': return holding.currency === filter.key
  }
}

export function filterHoldings(
  holdings: Holding[],
  filter: AllocationFilter,
  sleeveIndex: Map<string, SleeveIndexEntry>,
): Holding[] {
  return holdings.filter(holding => matchesAllocationFilter(holding, filter, sleeveIndex))
}

type CashBalance = InvestmentPortfolio['cashBalances'][number]

/**
 * Cash's counterpart to `matchesAllocationFilter`, using the keys the allocation chart gives cash
 * slices: the account name, the currency, or the single "Cash" slice in every other mode. Without
 * it a filtered table kept listing every account's cash under a heading that named one slice.
 */
export function matchesCashFilter(balance: CashBalance, filter: AllocationFilter): boolean {
  if (!filter) return true
  switch (filter.mode) {
    case 'account': return balance.accountName === filter.key
    case 'currency': return balance.currency === filter.key
    default: return filter.key === 'Cash'
  }
}
