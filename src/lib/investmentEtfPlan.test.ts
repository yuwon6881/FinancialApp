import { describe, expect, it } from 'vitest'
import type { InvestmentPortfolio } from '../types'
import { buildEtfPlan } from './investmentEtfPlan'

const instruments: InvestmentPortfolio['instruments'] = [
  { id: 'bnd', symbol: 'BND', name: 'US Bond ETF', type: 'ETF', currency: 'USD', allocationSleeve: 'Bonds', allocationOrder: 0, isCustom: false, isArchived: false },
  { id: 'bndx', symbol: 'BNDX', name: 'Global Bond ETF', type: 'ETF', currency: 'EUR', allocationSleeve: 'Bonds', allocationOrder: 1, isCustom: false, isArchived: false },
]

const holding = (instrumentId: string, valueApp: number): InvestmentPortfolio['holdings'][number] => ({
  accountId: 'account', accountName: 'Broker', instrumentId, symbol: instrumentId.toUpperCase(), name: instrumentId,
  type: 'ETF', currency: instrumentId === 'bnd' ? 'USD' : 'EUR', units: 1, averageCostNative: 1,
  valueApp, fxIncomplete: false,
})

describe('buildEtfPlan', () => {
  it('preserves current ETF proportions and converts each native currency', () => {
    const [plan] = buildEtfPlan(
      [{ sleeve: 'Bonds', amount: 350 }], 'deposit', 'MYR',
      [holding('bnd', 750), holding('bndx', 250)], instruments,
      [{ currency: 'USD', rateToAppCurrency: 4.5, asOf: '2026-08-26', source: 'provider' }, { currency: 'EUR', rateToAppCurrency: 5, asOf: '2026-08-26', source: 'provider' }],
    )

    expect(plan.lines.map(line => line.amountApp)).toEqual([262.5, 87.5])
    expect(plan.lines[0].amountNative).toBeCloseTo(58.3333)
    expect(plan.lines[1].amountNative).toBe(17.5)
    expect(plan.lines.reduce((sum, line) => sum + line.amountApp, 0)).toBe(350)
  })

  it('requires a choice for an empty sleeve with multiple configured ETFs', () => {
    const [plan] = buildEtfPlan([{ sleeve: 'Bonds', amount: 100 }], 'deposit', 'MYR', [], instruments, [], {})
    expect(plan.requiresChoice).toBe(true)
    expect(plan.lines).toEqual([])
  })

  it('does not invent a native amount when FX is missing', () => {
    const [plan] = buildEtfPlan([{ sleeve: 'Bonds', amount: 100 }], 'withdrawal', 'MYR', [holding('bnd', 100)], instruments, [])
    expect(plan.lines[0].amountNative).toBeUndefined()
  })
})
