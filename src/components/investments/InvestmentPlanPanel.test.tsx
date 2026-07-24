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

    expect(screen.getByText('Actual versus target')).toBeTruthy()
    expect(screen.queryByText('Priority guidance')).toBeNull()
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

    expect(screen.getByText('Priority guidance')).toBeTruthy()
    expect(screen.getByText(/usual completed-cycle Growth deposit/).textContent).toContain('RM')
    expect(screen.getByText(/Only after investing new money/)).toBeTruthy()
    expect(screen.getByText(/Reinvest/)).toBeTruthy()
  })
})
