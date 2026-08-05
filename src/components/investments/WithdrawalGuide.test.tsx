import { fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'
import type { InvestmentAllocationOverview } from '../../types'
import type { SleeveConstituent } from '../../lib/investmentSleeveBreakdown'
import { formatCurrencyVal } from '../../lib/utils'
import { WithdrawalGuide } from './WithdrawalGuide'

const allocation: InvestmentAllocationOverview = {
  status: 'OnTrack',
  appCurrency: 'MYR',
  plan: { usEquityTarget: 60, internationalExUsTarget: 30, bondsTarget: 10, watchDrift: 3, alertDrift: 5 },
  assignments: [],
  sleeves: [
    { sleeve: 'USEquity', label: 'US shares', targetPercentage: 60, currentPercentage: 60, value: 6000, driftPercentagePoints: 0, status: 'OnTrack' },
    { sleeve: 'InternationalExUS', label: 'Shares outside the US', targetPercentage: 30, currentPercentage: 30, value: 3000, driftPercentagePoints: 0, status: 'OnTrack' },
    { sleeve: 'Bonds', label: 'Bonds', targetPercentage: 10, currentPercentage: 10, value: 1000, driftPercentagePoints: 0, status: 'OnTrack' },
  ],
  recommendations: [],
  incompleteReasons: [],
  freshness: { isStale: false, hasMissingData: false, maxAgeMinutes: 60, staleInputs: [] },
  investedValue: 10000,
  availableCash: 0,
  minimumContribution: 0,
}

const holding = (instrumentId: string, valueApp: number, unrealisedProfitLossApp?: number): SleeveConstituent => ({
  accountId: 'a1',
  accountName: 'Broker',
  instrumentId,
  symbol: instrumentId.toUpperCase(),
  name: instrumentId,
  type: 'ETF',
  currency: 'USD',
  units: 1,
  averageCostNative: 1,
  valueApp,
  unrealisedProfitLossApp,
  fxIncomplete: false,
})

const constituents = new Map<string, SleeveConstituent[]>([
  ['USEquity', [holding('voo', 6000, 600)]],
  ['InternationalExUS', [holding('vxus', 3000, -150)]],
  ['Bonds', [holding('bnd', 1000, 20)]],
])

const money = (value?: number) => value === undefined ? 'Incomplete' : formatCurrencyVal(value, 'MYR')
const colors = ['bg-blue-500', 'bg-amber-500', 'bg-emerald-500']

const renderGuide = (overrides: Partial<InvestmentAllocationOverview> = {}) => render(
  <WithdrawalGuide
    allocation={{ ...allocation, ...overrides }}
    constituentsBySleeve={constituents}
    money={money}
    colors={colors}
  />,
)

const open = () => fireEvent.click(screen.getByRole('button', { name: /Plan a withdrawal/ }))
const enterAmount = (value: string) => fireEvent.change(
  screen.getByLabelText('Amount to withdraw in MYR'), { target: { value } })

describe('WithdrawalGuide', () => {
  beforeAll(() => {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  })

  it('stays folded away until asked for', () => {
    renderGuide()
    expect(screen.getByText('Taking money out').className).toContain('hidden')
    expect(screen.getByRole('button', { name: /Plan a withdrawal/ }).className).toContain('w-full')
    expect(screen.queryByLabelText('Amount to withdraw in MYR')).toBeNull()
    open()
    expect(screen.getByLabelText('Amount to withdraw in MYR')).toBeTruthy()
  })

  it('splits a withdrawal across the baskets by target weight', () => {
    renderGuide()
    open()
    enterAmount('1000')

    expect(screen.getByText('RM 600.00')).toBeTruthy()
    expect(screen.getByText('RM 300.00')).toBeTruthy()
    expect(screen.getByText('RM 100.00')).toBeTruthy()
    expect(screen.getByText(/RM 1,000.00 raised by selling/)).toBeTruthy()
  })

  it('spends spare broker cash before proposing any sale', () => {
    renderGuide({ availableCash: 2000 })
    open()
    enterAmount('500')

    expect(screen.getByText(/RM 500.00 from spare cash — nothing to sell/)).toBeTruthy()
    expect(screen.queryByText(/raised by selling/)).toBeNull()
  })

  it('reports the gain or loss the sale turns real without letting it drive the split', () => {
    renderGuide()
    open()
    enterAmount('1000')

    expect(screen.getByText(/About RM 60.00 gain moves from on paper to already banked/)).toBeTruthy()
    expect(screen.getByText(/About RM 15.00 loss moves from on paper to already banked/)).toBeTruthy()
  })

  it('warns when the request is larger than everything held', () => {
    renderGuide({ availableCash: 500 })
    open()
    enterAmount('20000')

    expect(screen.getByText(/You are RM 9,500.00 short/)).toBeTruthy()
  })

  it('offers nothing to plan when the portfolio is empty', () => {
    renderGuide({ investedValue: 0, availableCash: 0, sleeves: allocation.sleeves.map(s => ({ ...s, value: 0 })) })

    expect(screen.getByRole('button', { name: /Plan a withdrawal/ })).toHaveProperty('disabled', true)
    expect(screen.getByText('There is nothing to withdraw yet.')).toBeTruthy()
  })
})
