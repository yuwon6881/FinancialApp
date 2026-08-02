import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { InvestmentPortfolio } from '../../types'
import { AllocationChart } from './InvestmentCharts'
import { HoldingsTable } from './InvestmentTables'

const portfolio: InvestmentPortfolio = {
  appCurrency: 'USD',
  summary: { growthLedgerBalance: 0 },
  accounts: [{ id: 'account-1', name: 'Broker', baseCurrency: 'USD', isArchived: false, createdAt: '', updatedAt: '' }],
  instruments: [
    { id: 'voo', symbol: 'VOO', name: 'Vanguard S&P 500 ETF', type: 'ETF', currency: 'USD', allocationSleeve: 'USEquity', isCustom: false, isArchived: false },
    { id: 'other', symbol: 'OTHER', name: 'Other ETF', type: 'ETF', currency: 'USD', isCustom: true, isArchived: false },
  ],
  holdings: [
    { accountId: 'account-1', accountName: 'Broker', instrumentId: 'voo', symbol: 'VOO', name: 'Vanguard S&P 500 ETF', type: 'ETF', currency: 'USD', units: 1, averageCostNative: 90, valueNative: 100, valueApp: 100, usesManualPrice: false, fxIncomplete: false },
    { accountId: 'account-1', accountName: 'Broker', instrumentId: 'other', symbol: 'OTHER', name: 'Other ETF', type: 'ETF', currency: 'USD', units: 1, averageCostNative: 40, valueNative: 50, valueApp: 50, usesManualPrice: false, fxIncomplete: false },
  ],
  activity: [], manualPrices: [], chart: [], cashBalances: [], cashFlows: [],
  activityCount: 0, cashFlowCount: 0, insights: [], warnings: [], marketDataConfigured: false,
  allocation: {
    status: 'Incomplete', appCurrency: 'USD',
    plan: { usEquityTarget: 66, internationalExUsTarget: 10, bondsTarget: 24, watchDrift: 3, alertDrift: 5 },
    assignments: [],
    sleeves: [
      { sleeve: 'USEquity', label: 'US Equity', targetPercentage: 66, status: 'Incomplete' },
      { sleeve: 'InternationalExUS', label: 'International ex-US', targetPercentage: 10, status: 'Incomplete' },
      { sleeve: 'Bonds', label: 'Bonds', targetPercentage: 24, status: 'Incomplete' },
    ],
    recommendations: [], incompleteReasons: [],
    freshness: { isStale: false, hasMissingData: false, maxAgeMinutes: 60, staleInputs: [] },
    availableCash: 0,
  },
}

describe('investment sleeve allocation view', () => {
  it('uses sleeves as the primary chart lens and emits a sleeve filter', () => {
    const onSelect = vi.fn()
    render(<AllocationChart portfolio={portfolio} masked={false} selected={null} onSelect={onSelect} />)

    expect(screen.getByRole('combobox', { name: 'Group by' }).textContent).toContain('Basket in your plan')
    expect(screen.getByRole('img', { name: /US shares 66\.7%, Not sorted yet 33\.3%/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('listitem', { name: /US shares:/ }))
    expect(onSelect).toHaveBeenCalledWith({ mode: 'sleeve', key: 'USEquity' })
  })

  it('filters the holdings table with the same sleeve lookup', () => {
    render(<HoldingsTable portfolio={portfolio} masked={false} filter={{ mode: 'sleeve', key: 'USEquity' }} />)

    expect(screen.getAllByText(/Vanguard S&P 500 ETF/).length).toBeGreaterThan(0)
    expect(screen.queryByText('Other ETF')).toBeNull()
  })
})
