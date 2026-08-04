import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { InvestmentPortfolio } from '../../types'
import type { ForecastResult } from '../../lib/investmentForecast'
import { InvestmentForecastPanel } from './InvestmentForecastPanel'
import { useInvestmentForecast } from './useInvestmentForecast'

vi.mock('./useInvestmentForecast', () => ({ useInvestmentForecast: vi.fn() }))

const result: ForecastResult = {
  points: [
    { year: 0, lower: 10_000, median: 10_000, upper: 10_000 },
    { year: 10, lower: 15_000, median: 25_000, upper: 40_000 },
  ],
  ending: { year: 10, lower: 15_000, median: 25_000, upper: 40_000 },
  futureContributions: 12_000,
  estimatedGrowth: 3_000,
  requiredMonthlyContribution: 125,
  targetChance: 0.63,
}

const portfolio = (isEstimated = false): InvestmentPortfolio => ({
  appCurrency: 'USD',
  summary: {
    growthLedgerBalance: 0,
    totalValue: 10_000,
  },
  accounts: [],
  instruments: [],
  holdings: [],
  activity: [],
  chart: [],
  cashBalances: [],
  cashFlows: [],
  insights: [],
  warnings: [],
  marketDataConfigured: true,
  allocation: {
    status: 'OnTrack',
    appCurrency: 'USD',
    plan: {
      usEquityTarget: 66,
      internationalExUsTarget: 10,
      bondsTarget: 24,
      watchDrift: 3,
      alertDrift: 5,
    },
    assignments: [],
    sleeves: [],
    recommendations: [],
    incompleteReasons: [],
    freshness: { isStale: false, hasMissingData: false, maxAgeMinutes: 60, staleInputs: [] },
    availableCash: 0,
    contributionPlan: {
      amount: 100,
      basis: isEstimated ? 'Uninvested cash.' : 'Completed cycles.',
      cyclesObserved: isEstimated ? 0 : 3,
      isEstimated,
      sleeves: [],
    },
  },
})

describe('InvestmentForecastPanel', () => {
  beforeEach(() => {
    vi.mocked(useInvestmentForecast).mockReturnValue({
      error: '',
      initializationMs: 12,
      ready: true,
      result,
    })
  })

  it('defaults to the observed completed-cycle pace and keeps target changes independent', () => {
    render(<InvestmentForecastPanel portfolio={portfolio()} masked={false} />)
    fireEvent.click(screen.getByRole('button', { name: /Investment forecast/ }))
    
    const contribution = screen.getByLabelText('Hypothetical monthly contribution') as HTMLInputElement
    const target = screen.getByLabelText('Forecast target amount')
    expect(contribution.value).toBe('100')

    fireEvent.change(target, { target: { value: '50000' } })
    expect(contribution.value).toBe('100')
  })

  it('does not treat uninvested cash as an observed monthly pace', () => {
    render(<InvestmentForecastPanel portfolio={portfolio(true)} masked={false} />)
    fireEvent.click(screen.getByRole('button', { name: /Investment forecast/ }))
    expect((screen.getByLabelText('Hypothetical monthly contribution') as HTMLInputElement).value).toBe('0')
  })

  it('copies the required amount into local forecast state only', () => {
    render(<InvestmentForecastPanel portfolio={portfolio()} masked={false} />)
    fireEvent.click(screen.getByRole('button', { name: /Investment forecast/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Try this amount' }))
    expect((screen.getByLabelText('Hypothetical monthly contribution') as HTMLInputElement).value).toBe('125')
  })

  it('supports today-money display and warns beyond 30 years', () => {
    render(<InvestmentForecastPanel portfolio={portfolio()} masked={false} />)
    fireEvent.click(screen.getByRole('button', { name: /Investment forecast/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Today’s money' }))
    expect(screen.getByRole('button', { name: 'Today’s money' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.change(screen.getByLabelText('Forecast years'), { target: { value: '40' } })
    expect(screen.getByText(/Years 31–50 extend beyond/)).toBeTruthy()
  })

  it('masks values, disables controls, and keeps an accessible data table', () => {
    render(<InvestmentForecastPanel portfolio={portfolio()} masked />)
    fireEvent.click(screen.getByRole('button', { name: /Investment forecast/ }))
    expect(screen.getAllByText('••••').length).toBeGreaterThan(0)
    expect((screen.getByLabelText('Forecast years') as HTMLInputElement).disabled).toBe(true)
    expect(screen.getByText('Investment forecast data')).toBeTruthy()
    expect(screen.getAllByText('Hidden').length).toBeGreaterThan(0)
  })
})
