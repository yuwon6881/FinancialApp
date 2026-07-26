import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'react'
import { AppProvider } from '../contexts/AppProvider'
import type { AppContextValue } from '../contexts/AppContext'
import type { InvestmentPortfolio } from '../types'
import { InvestmentsView } from './InvestmentsView'
import * as api from '../lib/api'

vi.mock('../lib/api', () => ({
  readCachedInvestmentPortfolio: vi.fn(),
  fetchInvestmentPortfolio: vi.fn(),
  fetchInvestmentActivity: vi.fn(),
  fetchInvestmentCashFlows: vi.fn(),
  fetchCurrencyCatalog: vi.fn(),
  searchInvestmentInstruments: vi.fn(),
  createInvestmentAccount: vi.fn(),
  createInvestmentInstrument: vi.fn(),
  createInvestmentActivity: vi.fn(),
  createManualInvestmentPrice: vi.fn(),
  deleteInvestmentActivity: vi.fn(),
  refreshInvestmentMarketData: vi.fn(),
}))

const emptyPortfolio: InvestmentPortfolio = {
  appCurrency: 'USD',
  summary: { growthLedgerBalance: 400 },
  accounts: [],
  instruments: [],
  holdings: [],
  activity: [],
  manualPrices: [],
  chart: [],
  cashBalances: [],
  cashFlows: [],
  activityCount: 0,
  cashFlowCount: 0,
  insights: [],
  warnings: [],
      marketDataConfigured: true,
      allocation: {
        status: 'NotStarted',
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
          { sleeve: 'USEquity', label: 'US Equity', targetPercentage: 66, status: 'NotStarted' },
          { sleeve: 'InternationalExUS', label: 'International ex-US', targetPercentage: 10, status: 'NotStarted' },
          { sleeve: 'Bonds', label: 'Bonds', targetPercentage: 24, status: 'NotStarted' },
        ],
        recommendations: [],
        incompleteReasons: [],
        freshness: { isStale: false, hasMissingData: false, maxAgeMinutes: 60, staleInputs: [] },
        availableCash: 0,
      },
}

const tradablePortfolio: InvestmentPortfolio = {
  ...emptyPortfolio,
  accounts: [{ id: 'a1', name: 'Broker', baseCurrency: 'USD', isArchived: false, createdAt: '', updatedAt: '' }],
  instruments: [{ id: 'i1', symbol: 'VOO', name: 'Vanguard S&P 500', type: 'ETF', currency: 'USD', isCustom: false, isArchived: false }],
}

const context: AppContextValue = {
  hideSensitive: false,
  currency: 'USD',
  darkMode: false,
  activeSyncId: null,
  deletingId: null,
  isSyncing: false,
  isOffline: false,
  formatSensitive: value => `$${value}`,
  showToast: vi.fn(),
  guardSensitive: () => true,
  confirm: vi.fn(),
  investmentOps: [],
  queueInvestmentMutation: vi.fn(),
}

const renderView = (props: Partial<ComponentProps<typeof InvestmentsView>> = {}) => render(
  <AppProvider value={context}>
    <InvestmentsView onNavigate={vi.fn()} {...props} />
  </AppProvider>,
)

describe('InvestmentsView provider call boundaries', () => {
  beforeEach(() => {
    vi.mocked(api.readCachedInvestmentPortfolio).mockReturnValue(null)
    vi.mocked(api.fetchInvestmentPortfolio).mockResolvedValue(emptyPortfolio)
    vi.mocked(api.fetchInvestmentActivity).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 10 })
    vi.mocked(api.fetchInvestmentCashFlows).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 10 })
    vi.mocked(api.fetchCurrencyCatalog).mockResolvedValue([])
    vi.mocked(api.searchInvestmentInstruments).mockReset()
    vi.mocked(api.createInvestmentInstrument).mockReset()
    vi.mocked(context.queueInvestmentMutation!).mockReset()
    vi.mocked(context.showToast).mockReset()
    vi.mocked(api.refreshInvestmentMarketData).mockReset()
  })

  it('loads an empty portfolio without searching or refreshing market data', async () => {
    renderView()

    expect(await screen.findByRole('heading', { name: 'Build your investment view' })).toBeTruthy()
    expect(api.fetchInvestmentPortfolio).toHaveBeenCalledTimes(1)
    expect(api.searchInvestmentInstruments).not.toHaveBeenCalled()
    expect(api.refreshInvestmentMarketData).not.toHaveBeenCalled()
  })

  it('omits manual-price controls and explains investment archive eligibility', async () => {
    vi.mocked(api.fetchInvestmentPortfolio).mockResolvedValue(tradablePortfolio)
    renderView()

    expect(await screen.findByText('Manage portfolio')).toBeTruthy()
    expect(screen.queryByText(/Manual prices/)).toBeNull()
    expect(screen.queryByRole('button', { name: /Manual price/i })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Manage portfolio/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Investments (1)' }))
    expect(screen.getByText(/Delete is available when an investment has no history/)).toBeTruthy()
  })

  it('debounces explicit searches and starts at three characters', async () => {
    vi.mocked(api.searchInvestmentInstruments).mockResolvedValue({
      results: [],
      providerConfigured: true,
      providerContacted: true,
    })
    renderView()
    fireEvent.click(await screen.findByRole('button', { name: 'Add investment' }))
    const input = screen.getByPlaceholderText('Search at least 3 characters')

    fireEvent.change(input, { target: { value: 'VO' } })
    await new Promise(resolve => window.setTimeout(resolve, 650))
    expect(api.searchInvestmentInstruments).not.toHaveBeenCalled()

    fireEvent.change(input, { target: { value: 'VOO' } })
    await waitFor(() => expect(api.searchInvestmentInstruments).toHaveBeenCalledTimes(1), { timeout: 1200 })
    expect(api.searchInvestmentInstruments).toHaveBeenCalledWith('VOO', expect.any(AbortSignal))
  })

  it('queues a discovered instrument without triggering a price refresh', async () => {
    vi.mocked(api.searchInvestmentInstruments).mockResolvedValue({
      results: [{
        symbol: 'VOO',
        name: 'Vanguard ETF',
        type: 'ETF',
        exchange: 'NYSE Arca',
        mic: 'ARCX',
        country: 'United States',
        currency: 'USD',
        availableOnBasic: true,
        source: 'twelvedata',
      }],
      providerConfigured: true,
      providerContacted: true,
    })
    vi.mocked(api.createInvestmentInstrument).mockResolvedValue({
      id: 'instrument-1',
      symbol: 'VOO',
      name: 'Vanguard ETF',
      type: 'ETF',
      currency: 'USD',
      isCustom: false,
      isArchived: false,
    })
    renderView()
    fireEvent.click(await screen.findByRole('button', { name: 'Add investment' }))
    fireEvent.change(screen.getByPlaceholderText('Search at least 3 characters'), { target: { value: 'VOO' } })
    fireEvent.click(await screen.findByRole('button', { name: /VOO/ }, { timeout: 1500 }))
    fireEvent.click(screen.getByRole('button', { name: 'Save investment' }))

    await waitFor(() => expect(context.queueInvestmentMutation).toHaveBeenCalledWith(
      'investmentInstrument',
      'add',
      expect.any(String),
      expect.objectContaining({ symbol: 'VOO', name: 'Vanguard ETF' }),
    ))
    expect(api.createInvestmentInstrument).not.toHaveBeenCalled()
    expect(api.refreshInvestmentMarketData).not.toHaveBeenCalled()
    expect(context.showToast).not.toHaveBeenCalled()
  })

  it('derives the missing one of units / unit price / gross and keeps it in sync', async () => {
    vi.mocked(api.fetchInvestmentPortfolio).mockResolvedValue(tradablePortfolio)
    renderView()
    fireEvent.click(await screen.findByRole('button', { name: 'Add activity' }))

    const units = screen.getByLabelText('Units') as HTMLInputElement
    const price = screen.getByLabelText(/Unit price/) as HTMLInputElement
    const gross = screen.getByLabelText(/Gross amount/) as HTMLInputElement

    // units + price -> gross derives, and re-derives live when units changes.
    fireEvent.change(units, { target: { value: '10' } })
    fireEvent.change(price, { target: { value: '10' } })
    await waitFor(() => expect(gross.value).toBe('100'))
    fireEvent.change(units, { target: { value: '20' } })
    await waitFor(() => expect(gross.value).toBe('200'))

    // Editing gross now makes gross + units the two most-recent (authoritative)
    // fields, so the untouched one -- unit price -- derives (250 / 20 = 12.5),
    // and the user-entered units and gross are left intact.
    fireEvent.change(gross, { target: { value: '250' } })
    await waitFor(() => expect(price.value).toBe('12.5'))
    expect(units.value).toBe('20')
    expect(gross.value).toBe('250')
  })

  it('auto-opens a completed investment scan and applies only supported fields', async () => {
    vi.mocked(api.fetchInvestmentPortfolio).mockResolvedValue(tradablePortfolio)
    const onResetAutoOpen = vi.fn()
    renderView({
      autoOpenAddForm: true,
      onResetAutoOpen,
      investmentScanDraft: {
        jobId: 'scan-1',
        result: {
          type: 'Sell',
          accountId: 'a1',
          instrumentId: 'i1',
          tradeDate: '2026-07-20',
          units: 2,
          unitPrice: 25,
          cashAmount: null,
          fees: null,
          taxes: null,
          confidence: 0.93,
        },
      },
      activeScanJobIds: ['scan-1'],
    })

    expect(await screen.findByText(/Investment activity scanned/)).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Activity type' }).textContent).toContain('Sell')
    await waitFor(() => {
      const values = screen.getAllByRole('spinbutton').map(input => (input as HTMLInputElement).value)
      expect(values).toEqual(expect.arrayContaining(['2', '25', '50']))
    })
    expect(onResetAutoOpen).toHaveBeenCalled()
  })

  const choose = (ariaLabel: string, option: string) => {
    fireEvent.click(screen.getByRole('combobox', { name: ariaLabel }))
    fireEvent.click(screen.getByRole('option', { name: option }))
  }

  it('refuses a buy the account has no cash for', async () => {
    vi.mocked(api.fetchInvestmentPortfolio).mockResolvedValue(tradablePortfolio)
    renderView()
    fireEvent.click(await screen.findByRole('button', { name: 'Add activity' }))
    choose('Activity type', 'Buy')

    fireEvent.change(screen.getByLabelText('Units'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText(/Unit price/), { target: { value: '100' } })
    await waitFor(() => expect((screen.getByLabelText(/Gross amount/) as HTMLInputElement).value).toBe('100'))
    fireEvent.click(screen.getByRole('button', { name: 'Save activity' }))

    expect(await screen.findByText(/is available in Broker/)).toBeTruthy()
    expect(context.queueInvestmentMutation).not.toHaveBeenCalled()
  })

  it('refuses a withdrawal the account has no cash for', async () => {
    vi.mocked(api.fetchInvestmentPortfolio).mockResolvedValue(tradablePortfolio)
    renderView()
    fireEvent.click(await screen.findByRole('button', { name: 'Manage cash' }))
    choose('Cash movement type', 'Withdrawal (cash out)')

    fireEvent.change(screen.getByLabelText(/Amount/), { target: { value: '50' } })
    fireEvent.click(screen.getByRole('button', { name: 'Record withdrawal' }))

    expect(await screen.findByText(/before withdrawing/)).toBeTruthy()
    expect(context.queueInvestmentMutation).not.toHaveBeenCalled()
  })
})
