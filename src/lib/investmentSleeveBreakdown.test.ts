import { describe, expect, it } from 'vitest'
import type { InvestmentPortfolio } from '../types'
import { buildSleeveIndex } from './investmentAllocation'
import { breakdownBySleeve } from './investmentSleeveBreakdown'

type Holding = InvestmentPortfolio['holdings'][number]
const holding = (instrumentId: string, valueApp?: number): Holding => ({
  accountId: 'account-1', accountName: 'Broker', instrumentId, symbol: instrumentId.toUpperCase(),
  name: instrumentId, type: 'ETF', currency: 'USD', units: 1, averageCostNative: 10, valueApp,
  fxIncomplete: false,
})
const instruments: InvestmentPortfolio['instruments'] = [
  { id: 'voo', symbol: 'VOO', name: 'VOO', type: 'ETF', currency: 'USD', allocationSleeve: 'USEquity', isCustom: false, isArchived: false },
  { id: 'vti', symbol: 'VTI', name: 'VTI', type: 'ETF', currency: 'USD', allocationSleeve: 'USEquity', isCustom: false, isArchived: false },
  { id: 'other', symbol: 'OTHER', name: 'Other', type: 'ETF', currency: 'USD', isCustom: true, isArchived: false },
]

describe('breakdownBySleeve', () => {
  it('sorts constituents by value and calculates their share', () => {
    const result = breakdownBySleeve([holding('voo', 25), holding('vti', 75)], buildSleeveIndex(instruments))
    expect(result.get('USEquity')?.map(item => [item.symbol, item.shareOfSleeve])).toEqual([['VTI', 75], ['VOO', 25]])
  })

  it('groups unclassified holdings and preserves missing values', () => {
    const result = breakdownBySleeve([holding('other')], buildSleeveIndex(instruments))
    expect(result.get('Unassigned')?.[0]).toMatchObject({ valueApp: undefined, shareOfSleeve: undefined })
  })
})
