import { describe, expect, it } from 'vitest'
import { investmentMarketValue } from './investmentMarketValue'

const portfolio = (summary: { totalValue?: number; netDeposits?: number }, appCurrency = 'MYR', archived = false) => ({
  appCurrency,
  accounts: [{ id: 'a', name: 'Broker', baseCurrency: 'USD', isArchived: archived }],
  summary: { growthLedgerBalance: 0, ...summary },
})

describe('investmentMarketValue', () => {
  it('sets today’s worth beside the money sent, the gain being the difference', () => {
    expect(investmentMarketValue(portfolio({ totalValue: 3987.03, netDeposits: 3988.5 }), 'MYR'))
      .toEqual({ kind: 'known', worth: 3987.03, sent: 3988.5, gain: -1.47 })
    expect(investmentMarketValue(portfolio({ totalValue: 12000, netDeposits: 9000 }), 'myr'))
      .toMatchObject({ gain: 3000 })
  })

  it('keeps a missing price unknown rather than zero', () => {
    expect(investmentMarketValue(portfolio({ netDeposits: 1000 }), 'MYR')).toEqual({ kind: 'unknown' })
  })

  it('stays out of the total when it cannot be added honestly or there is nothing invested', () => {
    expect(investmentMarketValue(null, 'MYR')).toBeNull()
    expect(investmentMarketValue(portfolio({ totalValue: 10, netDeposits: 5 }, 'USD'), 'MYR')).toBeNull()
    expect(investmentMarketValue(portfolio({ totalValue: 10, netDeposits: 5 }, 'MYR', true), 'MYR')).toBeNull()
    expect(investmentMarketValue(portfolio({ totalValue: 0, netDeposits: 0 }), 'MYR')).toBeNull()
  })
})
