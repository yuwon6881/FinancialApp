import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { InvestmentAllocationOverview } from '../../types'
import { InvestmentPlanPanel } from './InvestmentPlanPanel'

const allocation: InvestmentAllocationOverview = {
  status: 'OnTrack',
  appCurrency: 'MYR',
  plan: {
    usEquityTarget: 66,
    internationalExUsTarget: 10,
    bondsTarget: 24,
    watchDrift: 3,
    alertDrift: 5,
  },
  assignments: [],
  sleeves: [
    { sleeve: 'USEquity', label: 'US Equity', targetPercentage: 66, currentPercentage: 66, value: 660, driftPercentagePoints: 0, status: 'OnTrack' },
    { sleeve: 'InternationalExUS', label: 'International ex-US', targetPercentage: 10, currentPercentage: 10, value: 100, driftPercentagePoints: 0, status: 'OnTrack' },
    { sleeve: 'Bonds', label: 'Bonds', targetPercentage: 24, currentPercentage: 24, value: 240, driftPercentagePoints: 0, status: 'OnTrack' },
  ],
  recommendations: [],
  incompleteReasons: [],
  freshness: { isStale: false, hasMissingData: false, maxAgeMinutes: 60, staleInputs: [] },
  investedValue: 1000,
  availableCash: 0,
  minimumContribution: 0,
}

describe('InvestmentPlanPanel guidance', () => {
  it('omits the guidance section when every sleeve is within its configured drift', () => {
    render(<InvestmentPlanPanel allocation={allocation} usdRate={0.25} masked={false} onNavigate={vi.fn()} />)

    expect(screen.getByText('What you hold vs your target')).toBeTruthy()
    expect(screen.queryByText('What to do next')).toBeNull()
  })

  it('shows every ordered scenario step and defaults to reporting currency', () => {
    const watch: InvestmentAllocationOverview = {
      ...allocation,
      status: 'Watch',
      recommendations: [
        { priority: 1, kind: 'TopUp', amount: 100, message: 'top up' },
        { priority: 2, kind: 'Buy', sleeve: 'Bonds', amount: 50, message: 'buy' },
        { priority: 3, kind: 'Sell', sleeve: 'USEquity', amount: 20, message: 'sell' },
        { priority: 4, kind: 'TransferBuy', sleeve: 'Bonds', amount: 20, message: 'reinvest' },
      ],
    }
    render(<InvestmentPlanPanel allocation={watch} usdRate={0.25} masked={false} onNavigate={vi.fn()} />)

    expect(screen.getByText('What to do next')).toBeTruthy()
    expect(screen.getByText(/usual completed-cycle Growth deposit/).textContent).toContain('RM')
    expect(screen.getByText(/Only after investing new money/)).toBeTruthy()
    expect(screen.getByText(/Reinvest/)).toBeTruthy()
  })

  it('omits available-cash guidance and renumbers the useful steps', () => {
    const watch: InvestmentAllocationOverview = {
      ...allocation,
      status: 'Watch',
      recommendations: [
        { priority: 1, kind: 'UseCash', amount: 2.12, message: 'invest available cash' },
        { priority: 2, kind: 'Buy', sleeve: 'Bonds', amount: 100, message: 'buy' },
      ],
    }
    render(<InvestmentPlanPanel allocation={watch} masked={false} onNavigate={vi.fn()} />)

    expect(screen.queryByText(/available cash/i)).toBeNull()
    expect(screen.getByText('1.')).toBeTruthy()
    expect(screen.queryByText('2.')).toBeNull()
  })
})

describe('InvestmentPlanPanel contribution split', () => {
  const withPlan: InvestmentAllocationOverview = {
    ...allocation,
    contributionPlan: {
      amount: 1000,
      basis: 'The median of your Growth deposits across 3 completed cycles.',
      cyclesObserved: 3,
      isEstimated: false,
      sleeves: [
        { sleeve: 'USEquity', label: 'US Equity', amount: 660, percentageOfContribution: 66, projectedPercentage: 66, projectedDriftPercentagePoints: 0 },
        { sleeve: 'InternationalExUS', label: 'International ex-US', amount: 100, percentageOfContribution: 10, projectedPercentage: 10, projectedDriftPercentagePoints: 0 },
        { sleeve: 'Bonds', label: 'Bonds', amount: 240, percentageOfContribution: 24, projectedPercentage: 24, projectedDriftPercentagePoints: 0 },
      ],
    },
  }

  it('shows the per-sleeve split even when the plan is on track', () => {
    render(<InvestmentPlanPanel allocation={withPlan} masked={false} onNavigate={vi.fn()} />)

    // The rebalancing guidance stays hidden; the routine split does not.
    expect(screen.queryByText('What to do next')).toBeNull()
    expect(screen.getByText('Your next deposit, split three ways')).toBeTruthy()
    expect(screen.getByText('RM 660.00')).toBeTruthy()
    expect(screen.getByText(/66.0% of this deposit/)).toBeTruthy()
    expect(screen.getByText(/median of your Growth deposits/)).toBeTruthy()
  })

  it('masks the amounts when sensitive values are hidden', () => {
    render(<InvestmentPlanPanel allocation={withPlan} masked onNavigate={vi.fn()} />)

    expect(screen.queryByText('RM 660.00')).toBeNull()
    expect(screen.getAllByText('••••').length).toBeGreaterThan(0)
  })

  it('omits the section when there is nothing ready to invest', () => {
    render(<InvestmentPlanPanel allocation={allocation} masked={false} onNavigate={vi.fn()} />)

    expect(screen.queryByText('Your next deposit, split three ways')).toBeNull()
  })
})
