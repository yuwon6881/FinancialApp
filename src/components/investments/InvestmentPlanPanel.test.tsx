import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { InvestmentAllocationOverview, InvestmentPortfolio } from '../../types'
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
    render(<InvestmentPlanPanel allocation={allocation} holdings={[]} instruments={[]} reference={{ currency: 'USD', rate: 0.25 }} masked={false} onNavigate={vi.fn()} />)

    expect(screen.getByText('What you hold vs your target')).toBeTruthy()
    expect(screen.queryByText('What to do next')).toBeNull()
  })

  it('uses the same three-card split instead of ordered steps when off target', () => {
    const watch: InvestmentAllocationOverview = {
      ...allocation,
      status: 'Watch',
      recommendations: [
        { priority: 1, kind: 'TopUp', amount: 100, message: 'top up' },
        { priority: 2, kind: 'Buy', sleeve: 'Bonds', amount: 50, message: 'buy' },
        { priority: 3, kind: 'Sell', sleeve: 'USEquity', amount: 20, message: 'sell' },
        { priority: 4, kind: 'TransferBuy', sleeve: 'Bonds', amount: 20, message: 'reinvest' },
      ],
      contributionPlan: {
        amount: 120,
        basis: 'The total needed to restore your target without selling. It includes RM 20.00 of uninvested cash already in your brokerage accounts; the remaining RM 100.00 is new money.',
        cyclesObserved: 1,
        isEstimated: false,
        sleeves: [
          { sleeve: 'USEquity', label: 'US Equity', amount: 0, percentageOfContribution: 0, projectedPercentage: 66, projectedDriftPercentagePoints: 0 },
          { sleeve: 'InternationalExUS', label: 'International ex-US', amount: 20, percentageOfContribution: 16.7, projectedPercentage: 10, projectedDriftPercentagePoints: 0 },
          { sleeve: 'Bonds', label: 'Bonds', amount: 100, percentageOfContribution: 83.3, projectedPercentage: 24, projectedDriftPercentagePoints: 0 },
        ],
      },
    }
    render(<InvestmentPlanPanel allocation={watch} holdings={[]} instruments={[]} reference={{ currency: 'USD', rate: 0.25 }} masked={false} onNavigate={vi.fn()} />)

    expect(screen.queryByText('What to do next')).toBeNull()
    // DepositGuide is collapsed by default; the routine badge and toggle button are visible.
    expect(screen.getByRole('button', { name: /Plan a deposit/ })).toBeTruthy()
    expect(screen.getByText('RM 120.00 routine')).toBeTruthy()
    // Sleeve amounts are only revealed once the panel is opened.
    expect(screen.queryByText('RM 100.00')).toBeNull()
  })

  it('keeps incomplete setup guidance available', () => {
    const watch: InvestmentAllocationOverview = {
      ...allocation,
      status: 'Incomplete',
      recommendations: [],
      incompleteReasons: ['Assign VTI to a basket.'],
    }
    render(<InvestmentPlanPanel allocation={watch} holdings={[]} instruments={[]} masked={false} onNavigate={vi.fn()} />)

    expect(screen.getByText('What to do next')).toBeTruthy()
    expect(screen.getByText(/Assign VTI/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Plan a withdrawal/ })).toBeNull()
  })

  it('explains when missing cash exchange rates make cash-aware guidance unavailable', () => {
    render(<InvestmentPlanPanel allocation={{
      ...allocation,
      availableCash: undefined,
      incompleteReasons: ['EUR cash in Broker cannot be valued in MYR.'],
    }} holdings={[]} instruments={[]} masked={false} onNavigate={vi.fn()} />)

    expect(screen.getByText('Why guidance is unavailable')).toBeTruthy()
    expect(screen.getByText(/EUR cash in Broker/)).toBeTruthy()
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

  it('shows the deposit toggle and routine badge even when the plan is on track', () => {
    render(<InvestmentPlanPanel allocation={withPlan} holdings={[]} instruments={[]} masked={false} onNavigate={vi.fn()} />)

    // The rebalancing guidance stays hidden; the deposit guide's toggle is visible.
    expect(screen.queryByText('What to do next')).toBeNull()
    expect(screen.getByRole('button', { name: /Plan a deposit/ })).toBeTruthy()
    expect(screen.getByText('RM 1,000.00 routine')).toBeTruthy()
    // Sleeve amounts and basis text stay hidden until the panel is opened.
    expect(screen.queryByText('RM 660.00')).toBeNull()
    expect(screen.queryByText(/median of your Growth deposits/)).toBeNull()
  })

  it('masks the routine badge amount when sensitive values are hidden', () => {
    render(<InvestmentPlanPanel allocation={withPlan} holdings={[]} instruments={[]} masked onNavigate={vi.fn()} />)

    expect(screen.queryByText('RM 1,000.00 routine')).toBeNull()
    // The badge still renders but shows the masked placeholder.
    expect(screen.getByText(/•••• routine/)).toBeTruthy()
  })

  it('omits the deposit section when there is nothing ready to invest', () => {
    render(<InvestmentPlanPanel allocation={allocation} holdings={[]} instruments={[]} masked={false} onNavigate={vi.fn()} />)

    expect(screen.queryByRole('button', { name: /Plan a deposit/ })).toBeNull()
  })
})

describe('InvestmentPlanPanel sleeve holdings', () => {
  const instruments: InvestmentPortfolio['instruments'] = [
    { id: 'voo', symbol: 'VOO', name: 'Vanguard S&P 500 ETF', type: 'ETF', currency: 'USD', allocationSleeve: 'USEquity', isCustom: false, isArchived: false },
    { id: 'other', symbol: 'OTHER', name: 'Unclassified ETF', type: 'ETF', currency: 'USD', isCustom: true, isArchived: false },
  ]
  const holdings: InvestmentPortfolio['holdings'] = [
    { accountId: 'a1', accountName: 'Broker', instrumentId: 'voo', symbol: 'VOO', name: 'Vanguard S&P 500 ETF', type: 'ETF', currency: 'USD', units: 1, averageCostNative: 400, valueApp: 500, unrealisedProfitLossApp: 100, fxIncomplete: false },
    { accountId: 'a1', accountName: 'Broker', instrumentId: 'other', symbol: 'OTHER', name: 'Unclassified ETF', type: 'ETF', currency: 'USD', units: 1, averageCostNative: 20, fxIncomplete: false },
  ]

  it('shows assigned and unassigned funds without inventing missing values', () => {
    render(<InvestmentPlanPanel allocation={allocation} holdings={holdings} instruments={instruments} masked={false} onNavigate={vi.fn()} />)

    expect(screen.getByText('VOO · Vanguard S&P 500 ETF')).toBeTruthy()
    expect(screen.getByText('Not sorted yet')).toBeTruthy()
    expect(screen.getByText('OTHER · Unclassified ETF')).toBeTruthy()
    expect(screen.getByText('Share unavailable')).toBeTruthy()
    expect(screen.getByText('Gain unavailable')).toBeTruthy()
    const disclosures = screen.getAllByText(/See the 1 fund in this basket/)
    expect(disclosures.length).toBe(2)
    expect(disclosures[0].closest('article')?.className).toContain('self-start')
    expect(disclosures[0].closest('article')?.parentElement?.className).toContain('items-start')
  })
})
