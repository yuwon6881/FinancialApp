import { describe, expect, it } from 'vitest'
import type { InvestmentPortfolio } from '../types'
import { splitUnrealisedGain } from './investmentGainSplit'

type Holding = InvestmentPortfolio['holdings'][number]

const holding = (overrides: Partial<Holding>): Holding => ({
  accountId: 'a1', accountName: 'Broker', instrumentId: 'i1', symbol: 'VOO', name: 'VOO',
  type: 'ETF', currency: 'USD', units: 1, averageCostNative: 100, latestPriceNative: 100,
  fxRate: 4, unrealisedProfitLossApp: 0, fxIncomplete: false,
  ...overrides,
})

describe('splitUnrealisedGain', () => {
  it('attributes a gain to the exchange rate when the price itself fell', () => {
    // The case that looks like a bug on screen: down in USD, up in MYR.
    const split = splitUnrealisedGain(holding({
      averageCostNative: 693.73,
      latestPriceNative: 693.57,
      units: 1,
      fxRate: 4.25,
      unrealisedProfitLossApp: 34.59,
    }), 'MYR')

    expect(split).toBeDefined()
    expect(split!.price).toBeLessThan(0)
    expect(split!.currency).toBeGreaterThan(0)
    // The two parts must always reconstruct the reported gain.
    expect(split!.price + split!.currency).toBeCloseTo(34.59, 6)
  })

  it('attributes the gain to the fund when the rate has not moved', () => {
    const split = splitUnrealisedGain(holding({
      averageCostNative: 100,
      latestPriceNative: 110,
      units: 2,
      fxRate: 4,
      unrealisedProfitLossApp: 80,
    }), 'MYR')

    expect(split).toEqual({ price: 80, currency: 0 })
  })

  it('says nothing for a fund already in your own currency', () => {
    expect(splitUnrealisedGain(holding({ currency: 'MYR' }), 'MYR')).toBeUndefined()
    expect(splitUnrealisedGain(holding({ currency: 'myr' }), 'MYR')).toBeUndefined()
  })

  it('refuses to guess when an input is missing', () => {
    expect(splitUnrealisedGain(holding({ latestPriceNative: undefined }), 'MYR')).toBeUndefined()
    expect(splitUnrealisedGain(holding({ fxRate: undefined }), 'MYR')).toBeUndefined()
    expect(splitUnrealisedGain(holding({ unrealisedProfitLossApp: undefined }), 'MYR')).toBeUndefined()
  })

  it('handles a loss driven by the exchange rate', () => {
    const split = splitUnrealisedGain(holding({
      averageCostNative: 100,
      latestPriceNative: 105,
      units: 1,
      fxRate: 4,
      unrealisedProfitLossApp: -10,
    }), 'MYR')

    expect(split!.price).toBe(20)
    expect(split!.currency).toBe(-30)
  })
})
