import type { InvestmentAllocationSleeve, InvestmentPortfolio } from '../types'

type Holding = InvestmentPortfolio['holdings'][number]
type Instrument = InvestmentPortfolio['instruments'][number]
type FxRate = NonNullable<InvestmentPortfolio['planFxRates']>[number]

export interface EtfPlanLine {
  instrumentId: string
  symbol: string
  name: string
  currency: string
  amountApp: number
  amountNative?: number
  fx?: FxRate
}

export interface EtfSleevePlan {
  sleeve: InvestmentAllocationSleeve
  lines: EtfPlanLine[]
  choices: Instrument[]
  requiresChoice: boolean
}

const moneyRound = (value: number) => Math.round(value * 100) / 100

export function buildEtfPlan(
  sleeveAmounts: Array<{ sleeve: string; amount: number }>,
  mode: 'deposit' | 'withdrawal',
  appCurrency: string,
  holdings: Holding[],
  instruments: Instrument[],
  fxRates: FxRate[],
  selections: Record<string, string> = {},
): EtfSleevePlan[] {
  const rateByCurrency = new Map(fxRates.map(rate => [rate.currency.toUpperCase(), rate]))
  const instrumentById = new Map(instruments.map(instrument => [instrument.id, instrument]))

  return sleeveAmounts.filter(item => item.amount > 0.005).map(item => {
    const sleeve = item.sleeve as InvestmentAllocationSleeve
    const choices = instruments
      .filter(instrument => !instrument.isArchived && instrument.allocationSleeve === sleeve)
      .sort((left, right) => (left.allocationOrder ?? 0) - (right.allocationOrder ?? 0))
    const grouped = new Map<string, { instrument: Instrument; value: number }>()
    for (const holding of holdings) {
      const instrument = instrumentById.get(holding.instrumentId)
      if (!instrument || instrument.allocationSleeve !== sleeve || holding.valueApp === undefined) continue
      const existing = grouped.get(instrument.id)
      grouped.set(instrument.id, { instrument, value: (existing?.value ?? 0) + holding.valueApp })
    }

    let weighted = [...grouped.values()].filter(item => item.value > 0)
    if (weighted.length === 0 && mode === 'deposit') {
      const selected = choices.find(choice => choice.id === selections[sleeve])
      const only = choices.length === 1 ? choices[0] : selected
      if (only) weighted = [{ instrument: only, value: 1 }]
    }
    const requiresChoice = mode === 'deposit' && weighted.length === 0 && choices.length > 1
    const totalWeight = weighted.reduce((sum, item) => sum + item.value, 0)
    const rounded = weighted.map(weight => ({
      instrument: weight.instrument,
      amountApp: moneyRound(item.amount / totalWeight * weight.value),
    }))
    const drift = moneyRound(item.amount) - rounded.reduce((sum, line) => sum + line.amountApp, 0)
    if (rounded.length > 0 && drift !== 0) rounded[0].amountApp = moneyRound(rounded[0].amountApp + drift)

    const lines = rounded.map<EtfPlanLine>(line => {
      const currency = line.instrument.currency.toUpperCase()
      const fx = currency === appCurrency.toUpperCase()
        ? { currency, rateToAppCurrency: 1, asOf: '', source: 'Same currency' }
        : rateByCurrency.get(currency)
      return {
        instrumentId: line.instrument.id,
        symbol: line.instrument.symbol,
        name: line.instrument.name,
        currency,
        amountApp: line.amountApp,
        amountNative: fx && fx.rateToAppCurrency > 0 ? line.amountApp / fx.rateToAppCurrency : undefined,
        fx,
      }
    })
    return { sleeve, lines, choices, requiresChoice }
  })
}
