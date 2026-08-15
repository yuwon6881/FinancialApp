import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { InvestmentAllocationOverview, InvestmentPortfolio } from '../types'
import { InvestmentPlanPanel } from './investments/InvestmentPlanPanel'

const allocation = (status: InvestmentAllocationOverview['status']): InvestmentAllocationOverview => ({
  status,
  appCurrency: 'USD',
  plan: { usEquityTarget: 66, internationalExUsTarget: 10, bondsTarget: 24, watchDrift: 3, alertDrift: 5 },
  assignments: [],
  sleeves: [
    { sleeve: 'USEquity', label: 'US shares', targetPercentage: 66, currentPercentage: undefined, value: undefined, status },
    { sleeve: 'InternationalExUS', label: 'Shares outside the US', targetPercentage: 10, currentPercentage: undefined, value: undefined, status },
    { sleeve: 'Bonds', label: 'Bonds', targetPercentage: 24, currentPercentage: undefined, value: undefined, status },
  ],
  recommendations: [],
  incompleteReasons: [],
  freshness: { isStale: false, hasMissingData: false, maxAgeMinutes: 60, staleInputs: [] },
  investedValue: 0,
  availableCash: 0,
  minimumContribution: undefined,
})

describe('investment UI vocabulary', () => {
  it('renders human labels rather than allocation or sleeve codes', () => {
    render(
      <InvestmentPlanPanel
        allocation={allocation('NotStarted')}
        holdings={[] as InvestmentPortfolio['holdings']}
        instruments={[] as InvestmentPortfolio['instruments']}
        masked={false}
        onNavigate={vi.fn()}
      />,
    )

    expect(screen.getAllByText('Not started').length).toBeGreaterThan(0)
    expect(screen.getAllByText('US shares').length).toBeGreaterThan(0)
    expect(screen.getByText('Shares outside the US')).toBeTruthy()
    expect(screen.queryByText('NotStarted')).toBeNull()
    expect(screen.queryByText('InternationalExUS')).toBeNull()
  })
})
