import type { InvestmentPortfolio } from '../types'

type Holding = InvestmentPortfolio['holdings'][number]

export interface GainSplit {
  /** The part of the gain the fund's own price movement produced. */
  price: number
  /** The part the exchange rate produced, which the fund had nothing to do with. */
  currency: number
}

/**
 * Splits an unrealised gain into the part the fund earned and the part the
 * exchange rate handed you.
 *
 * Without this the page looks self-contradictory to anyone holding a foreign
 * fund: the price line falls while the gain rises. The gain is measured in your
 * currency and the cost was converted at the rate on each trade date, so a
 * currency move alone can turn a small price loss into a gain.
 *
 * Priced at today's rate, `units × (latest − average cost)` is the price part;
 * whatever is left of the reported gain is the currency part. Returns
 * `undefined` when any input is missing rather than attributing the whole gain
 * to the wrong cause.
 */
export function splitUnrealisedGain(holding: Holding, appCurrency: string): GainSplit | undefined {
  if (holding.currency.toUpperCase() === appCurrency.toUpperCase()) return undefined
  const { latestPriceNative, averageCostNative, fxRate, unrealisedProfitLossApp, units } = holding
  if (
    latestPriceNative === undefined ||
    averageCostNative === undefined ||
    fxRate === undefined ||
    unrealisedProfitLossApp === undefined
  ) {
    return undefined
  }

  const price = (latestPriceNative - averageCostNative) * units * fxRate
  return { price, currency: unrealisedProfitLossApp - price }
}
