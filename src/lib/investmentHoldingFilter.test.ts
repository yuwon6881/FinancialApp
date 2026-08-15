import { describe, expect, it } from 'vitest'
import type { InvestmentPortfolio } from '../types'
import { buildSleeveIndex } from './investmentAllocation'
import { filterHoldings, matchesAllocationFilter } from './investmentHoldingFilter'

type Holding = InvestmentPortfolio['holdings'][number]

const instruments = [
  { id: 'us', symbol: 'VTI', name: 'US shares', type: 'ETF' as const, currency: 'USD', isCustom: false, isArchived: false, allocationSleeve: 'USEquity' as const },
  { id: 'intl', symbol: 'VXUS', name: 'Shares outside the US', type: 'ETF' as const, currency: 'USD', isCustom: false, isArchived: false, allocationSleeve: 'InternationalExUS' as const },
]

const holding = (instrumentId: string, accountName: string, type: 'ETF' | 'Stock' = 'ETF'): Holding => ({
  accountId: accountName,
  accountName,
  instrumentId,
  symbol: instruments.find(instrument => instrument.id === instrumentId)?.symbol ?? instrumentId,
  name: 'Fund',
  type,
  currency: 'USD',
  units: 1,
  averageCostNative: 10,
  fxIncomplete: false,
})

describe('investment holding allocation filters', () => {
  const index = buildSleeveIndex(instruments)
  const holdings = [holding('us', 'Broker A'), holding('intl', 'Broker B', 'Stock')]

  it('matches the selected sleeve by stable key', () => {
    expect(matchesAllocationFilter(holdings[0], { mode: 'sleeve', key: 'USEquity' }, index)).toBe(true)
    expect(matchesAllocationFilter(holdings[0], { mode: 'sleeve', key: 'InternationalExUS' }, index)).toBe(false)
  })

  it('matches asset, account, and instrument filters without using display labels', () => {
    expect(filterHoldings(holdings, { mode: 'asset', key: 'Stock' }, index)).toEqual([holdings[1]])
    expect(filterHoldings(holdings, { mode: 'account', key: 'Broker A' }, index)).toEqual([holdings[0]])
    expect(filterHoldings(holdings, { mode: 'instrument', key: 'VXUS' }, index)).toEqual([holdings[1]])
  })

  it('returns all holdings when no slice is selected', () => {
    expect(filterHoldings(holdings, null, index)).toEqual(holdings)
  })
})
