import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { InvestmentAllocationOverview } from '../../types'
import { InvestmentPlanExceptionCard } from './InvestmentPlanExceptionCard'

const overview = (status: InvestmentAllocationOverview['status']): InvestmentAllocationOverview => ({
  status,
  appCurrency: 'USD',
  plan: {
    usEquityTarget: 66,
    internationalExUsTarget: 10,
    bondsTarget: 24,
    watchDrift: 3,
    alertDrift: 5,
  },
  assignments: [],
  sleeves: [
    { sleeve: 'USEquity', label: 'US Equity', targetPercentage: 66, currentPercentage: 75, driftPercentagePoints: 9, status },
    { sleeve: 'InternationalExUS', label: 'International ex-US', targetPercentage: 10, currentPercentage: 10, driftPercentagePoints: 0, status: 'OnTrack' },
    { sleeve: 'Bonds', label: 'Bonds', targetPercentage: 24, currentPercentage: 15, driftPercentagePoints: -9, status },
  ],
  recommendations: [],
  incompleteReasons: status === 'Incomplete' ? ['VTI must be assigned.'] : [],
  freshness: { isStale: false, hasMissingData: false, maxAgeMinutes: 60, staleInputs: [] },
  investedValue: 100,
  availableCash: 0,
})

describe('InvestmentPlanExceptionCard', () => {
  it.each(['NotStarted', 'OnTrack', 'Watch'] as const)('stays hidden for %s', status => {
    const { container } = render(<InvestmentPlanExceptionCard allocation={overview(status)} onNavigate={vi.fn()} />)
    expect(container.innerHTML).toBe('')
  })

  it('appears for alert drift', () => {
    render(<InvestmentPlanExceptionCard allocation={overview('Alert')} onNavigate={vi.fn()} />)
    expect(screen.getByText('Investment allocation needs attention')).toBeTruthy()
  })

  it('appears when setup or valuation is incomplete', () => {
    render(<InvestmentPlanExceptionCard allocation={overview('Incomplete')} onNavigate={vi.fn()} />)
    expect(screen.getByText('Investment plan needs setup')).toBeTruthy()
  })
})
