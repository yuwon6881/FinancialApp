import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { InvestmentPortfolio } from '../../../types'
import type { ForecastResult } from '../../../lib/investmentForecast'
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
      routineContribution: isEstimated ? undefined : 100,
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
    expect(contribution.value).toBe('100')
    expect(contribution.max).toBe('10000')

    fireEvent.click(screen.getByRole('button', { name: 'Add a target' }))
    const target = screen.getByLabelText('Forecast target amount') as HTMLInputElement
    expect(target.max).toBe('10000000')
    fireEvent.change(target, { target: { value: '50000' } })
    expect(contribution.value).toBe('100')
  })

  it('does not copy a required contribution above the ten-thousand slider limit', () => {
    vi.mocked(useInvestmentForecast).mockReturnValue({
      error: '',
      initializationMs: 12,
      ready: true,
      result: { ...result, requiredMonthlyContribution: 25_000 },
    })
    render(<InvestmentForecastPanel portfolio={portfolio()} masked={false} />)
    fireEvent.click(screen.getByRole('button', { name: /Investment forecast/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Add a target' }))
    const overLimit = screen.getByRole('button', { name: 'Above slider limit' }) as HTMLButtonElement

    expect(overLimit.disabled).toBe(true)
    expect((screen.getByLabelText('Hypothetical monthly contribution') as HTMLInputElement).value).toBe('100')
  })

  it('draws no target until one is asked for, and drops it again on removal', () => {
    render(<InvestmentForecastPanel portfolio={portfolio()} masked={false} />)
    fireEvent.click(screen.getByRole('button', { name: /Investment forecast/ }))

    expect(screen.queryByLabelText('Forecast target amount')).toBeNull()
    expect(screen.queryByText('Chance of reaching your target')).toBeNull()
    expect(screen.queryByText('Your target')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Add a target' }))
    expect(screen.getByLabelText('Forecast target amount')).toBeTruthy()
    expect(screen.getByText('Chance of reaching your target')).toBeTruthy()
    expect(screen.getByText(/Your target/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Remove target' }))
    expect(screen.queryByLabelText('Forecast target amount')).toBeNull()
    expect(screen.getByRole('button', { name: 'Add a target' })).toBeTruthy()
  })

  it('reveals the inflation slider only alongside the today-money view', () => {
    render(<InvestmentForecastPanel portfolio={portfolio()} masked={false} />)
    fireEvent.click(screen.getByRole('button', { name: /Investment forecast/ }))

    expect(screen.queryByLabelText(/Forecast inflation estimate/)).toBeNull()
    fireEvent.click(screen.getByRole('switch', { name: /Show in today/ }))
    expect(screen.getByLabelText('Forecast inflation estimate')).toBeTruthy()
    fireEvent.click(screen.getByRole('switch', { name: /Show in today/ }))
    expect(screen.queryByLabelText(/Forecast inflation estimate/)).toBeNull()
  })

  it('labels the chart scale and its span in years', () => {
    render(<InvestmentForecastPanel portfolio={portfolio()} masked={false} />)
    fireEvent.click(screen.getByRole('button', { name: /Investment forecast/ }))

    expect(screen.getByText('Today')).toBeTruthy()
    expect(screen.getByText('In 10 years')).toBeTruthy()
    expect(screen.getByText('5 years')).toBeTruthy()
  })

  it('does not add a zero-value label at the bottom of the chart', () => {
    vi.mocked(useInvestmentForecast).mockReturnValue({
      error: '',
      initializationMs: 12,
      ready: true,
      result: {
        ...result,
        points: [
          { year: 0, lower: 0, median: 0, upper: 0 },
          ...result.points.slice(1),
        ],
      },
    })

    render(<InvestmentForecastPanel portfolio={portfolio()} masked={false} />)
    fireEvent.click(screen.getByRole('button', { name: /Investment forecast/ }))

    const chart = document.querySelector('.cursor-crosshair')
    expect(chart).toBeTruthy()
    expect(chart?.textContent).not.toContain('$0.00')
  })

  it('does not open an explanation popover just because the sheet opens', async () => {
    render(<InvestmentForecastPanel portfolio={portfolio()} masked={false} />)
    fireEvent.click(screen.getByRole('button', { name: /Investment forecast/ }))

    await new Promise(resolve => setTimeout(resolve, 60))
    expect(screen.queryByText(/Half of the 10,000 simulated outcomes ended above this amount/)).toBeNull()
  })

  it('does not treat uninvested cash as an observed monthly pace', () => {
    render(<InvestmentForecastPanel portfolio={portfolio(true)} masked={false} />)
    fireEvent.click(screen.getByRole('button', { name: /Investment forecast/ }))
    expect((screen.getByLabelText('Hypothetical monthly contribution') as HTMLInputElement).value).toBe('0')
  })

  it('does not show zero as a forecast result while the worker is preparing', () => {
    vi.mocked(useInvestmentForecast).mockReturnValue({
      error: '',
      initializationMs: null,
      ready: false,
      result: null,
    })

    render(<InvestmentForecastPanel portfolio={portfolio()} masked={false} />)
    fireEvent.click(screen.getByRole('button', { name: /Investment forecast/ }))

    expect(screen.getAllByText('Calculating…').length).toBeGreaterThan(0)
    expect(screen.queryByText('$0.00')).toBeNull()
  })

  it('copies the required amount into local forecast state only', () => {
    render(<InvestmentForecastPanel portfolio={portfolio()} masked={false} />)
    fireEvent.click(screen.getByRole('button', { name: /Investment forecast/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Add a target' }))
    fireEvent.click(screen.getByRole('button', { name: 'Use this amount' }))
    expect((screen.getByLabelText('Hypothetical monthly contribution') as HTMLInputElement).value).toBe('125')
  })

  it('supports today-money display and warns beyond 30 years', () => {
    render(<InvestmentForecastPanel portfolio={portfolio()} masked={false} />)
    fireEvent.click(screen.getByRole('button', { name: /Investment forecast/ }))
    fireEvent.click(screen.getByRole('switch', { name: /Show in today/ }))
    expect(screen.getByRole('switch', { name: /Show in today/ }).getAttribute('aria-checked')).toBe('true')
    fireEvent.change(screen.getByLabelText('Forecast years'), { target: { value: '40' } })
    expect(screen.getByText(/Years 31–50 use a less certain/)).toBeTruthy()
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
