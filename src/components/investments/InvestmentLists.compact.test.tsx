import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { InvestmentActivity, InvestmentPortfolio } from '../../types'
import * as api from '../../lib/api'
import { HoldingsTable, PagedActivityTable } from './InvestmentTables'
import { SummaryCards } from './SummaryCards'

vi.mock('../../lib/api', () => ({
  fetchInvestmentActivity: vi.fn(),
  fetchInvestmentCashFlows: vi.fn(),
}))

const portfolio: InvestmentPortfolio = {
  appCurrency: 'USD',
  summary: { growthLedgerBalance: 0, totalValue: 150, marketValue: 150, cashValue: 0, costBasis: 130 },
  accounts: [{ id: 'a1', name: 'Broker', baseCurrency: 'USD', isArchived: false, createdAt: '', updatedAt: '' }],
  instruments: [
    { id: 'voo', symbol: 'VOO', name: 'Vanguard S&P 500 ETF', type: 'ETF', currency: 'USD', isCustom: false, isArchived: false },
    { id: 'bnd', symbol: 'BND', name: 'Total Bond ETF', type: 'ETF', currency: 'USD', isCustom: false, isArchived: false },
  ],
  holdings: [
    { accountId: 'a1', accountName: 'Broker', instrumentId: 'voo', symbol: 'VOO', name: 'Vanguard S&P 500 ETF', type: 'ETF', currency: 'USD', units: 1, averageCostNative: 90, latestPriceNative: 100, valueNative: 100, valueApp: 100, unrealisedProfitLossApp: 10, unrealisedPercent: 11.1, fxIncomplete: false },
    { accountId: 'a1', accountName: 'Broker', instrumentId: 'bnd', symbol: 'BND', name: 'Total Bond ETF', type: 'ETF', currency: 'USD', units: 2, averageCostNative: 40, fxIncomplete: false },
  ],
  activity: [], chart: [], cashBalances: [], cashFlows: [],
  activityCount: 1, cashFlowCount: 0, insights: [], warnings: [], marketDataConfigured: true,
  allocation: {
    status: 'NotStarted', appCurrency: 'USD',
    plan: { usEquityTarget: 66, internationalExUsTarget: 10, bondsTarget: 24, watchDrift: 3, alertDrift: 5 },
    assignments: [], sleeves: [], recommendations: [], incompleteReasons: [],
    freshness: { isStale: false, hasMissingData: false, maxAgeMinutes: 60, staleInputs: [] },
  },
}

const buy: InvestmentActivity = {
  id: 't1', accountId: 'a1', instrumentId: 'voo', type: 'Buy', tradeDate: '2026-09-02',
  units: 4, unitPrice: 100, cashAmount: 400, fees: 1, taxes: 0, createdAt: '',
}

// The page swaps its holdings table and activity table for grouped lists below the expanded tier.
// The shared matchMedia stub answers from window.innerWidth, so a phone width is set per test.
const originalWidth = window.innerWidth
const setWidth = (width: number) => Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width })

describe('investment lists on a phone', () => {
  beforeEach(() => {
    setWidth(390)
    vi.mocked(api.fetchInvestmentActivity).mockReset()
    vi.mocked(api.fetchInvestmentActivity).mockResolvedValue({ items: [buy], total: 1, page: 1, pageSize: 10 })
    vi.mocked(api.fetchInvestmentCashFlows).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 10 })
  })
  afterEach(() => setWidth(originalWidth))

  it('lists holdings as rows that open the fund, without a table or a single-page pager', () => {
    const onSelect = vi.fn()
    render(<HoldingsTable portfolio={portfolio} masked={false} filter={null} onSelectHolding={onSelect} />)

    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByText(/Rows per page/)).toBeNull()
    // A fund with no saved price says so instead of showing a blank value.
    expect(screen.getByRole('button', { name: 'BND · Total Bond ETF' }).textContent).toContain('No price yet')
    fireEvent.click(screen.getByRole('button', { name: 'VOO · Vanguard S&P 500 ETF' }))
    expect(onSelect).toHaveBeenCalledWith(portfolio.holdings[0])
  })

  it('keeps the activity filters in a sheet and applies them on Search', async () => {
    render(<PagedActivityTable portfolio={portfolio} masked={false} refreshToken={0} operations={[]} activeSyncId={null} onEdit={vi.fn()} onDelete={vi.fn()} onEditCashFlow={vi.fn()} onDeleteCashFlow={vi.fn()} />)
    await screen.findByText('Buy VOO')

    // No inline filter controls on a phone, only the pill that opens them.
    expect(screen.queryByRole('combobox', { name: 'Filter by type' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Filters/ }))
    const sheet = await screen.findByRole('dialog', { name: 'Filter activity' })
    fireEvent.click(within(sheet).getByRole('combobox', { name: 'Filter by type' }))
    fireEvent.click(screen.getByRole('option', { name: 'Sell' }))
    fireEvent.click(within(sheet).getByRole('button', { name: 'Search' }))

    await waitFor(() => expect(api.fetchInvestmentActivity).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'Sell', page: 1 }),
      expect.anything(),
    ))
    expect(screen.getByRole('button', { name: /Filters/ }).textContent).toContain('1')
  })

  it('edits from the row and deletes from its menu', async () => {
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    render(<PagedActivityTable portfolio={portfolio} masked={false} refreshToken={0} operations={[]} activeSyncId={null} onEdit={onEdit} onDelete={onDelete} onEditCashFlow={vi.fn()} onDeleteCashFlow={vi.fn()} />)
    await screen.findByText('Buy VOO')

    expect(screen.getByText('Wed, Sep 2')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Edit Buy 2026-09-02' }))
    expect(onEdit).toHaveBeenCalledWith(buy)
    fireEvent.click(screen.getByRole('button', { name: 'More actions for Buy 2026-09-02' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    expect(onDelete).toHaveBeenCalledWith(buy)
  })
})

describe('investments hero', () => {
  afterEach(() => setWidth(originalWidth))

  it('keeps the breakdown one tap away below the expanded tier', () => {
    setWidth(390)
    render(<SummaryCards portfolio={portfolio} masked={false} />)
    const toggle = screen.getByRole('button', { name: 'Show breakdown' })
    const breakdown = document.getElementById(toggle.getAttribute('aria-controls')!)!
    expect(breakdown.className).toContain('hidden')
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(breakdown.className).not.toMatch(/(^|\s)hidden(\s|$)/)
    expect(screen.getByRole('button', { name: 'Hide breakdown' })).toBeTruthy()
  })

  it('masks the hero figure and the facts in sensitive mode', () => {
    const { container } = render(<SummaryCards portfolio={portfolio} masked />)
    expect(screen.getByTestId('investment-total').textContent).not.toContain('150')
    expect(container.querySelector('dl')?.textContent).not.toContain('130')
  })
})
