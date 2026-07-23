import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppProvider } from '../contexts/AppProvider'
import type { AppContextValue } from '../contexts/AppContext'
import type { InvestmentPortfolio } from '../types'
import { InvestmentsView } from './InvestmentsView'
import * as api from '../lib/api'

vi.mock('../lib/api', () => ({
  readCachedInvestmentPortfolio: vi.fn(),
  fetchInvestmentPortfolio: vi.fn(),
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
  insights: [],
  warnings: [],
  marketDataConfigured: true,
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
}

const renderView = () => render(
  <AppProvider value={context}>
    <InvestmentsView onNavigate={vi.fn()} />
  </AppProvider>,
)

describe('InvestmentsView provider call boundaries', () => {
  beforeEach(() => {
    vi.mocked(api.readCachedInvestmentPortfolio).mockReturnValue(null)
    vi.mocked(api.fetchInvestmentPortfolio).mockResolvedValue(emptyPortfolio)
    vi.mocked(api.searchInvestmentInstruments).mockReset()
    vi.mocked(api.createInvestmentInstrument).mockReset()
    vi.mocked(api.refreshInvestmentMarketData).mockReset()
  })

  it('loads an empty portfolio without searching or refreshing market data', async () => {
    renderView()

    expect(await screen.findByRole('heading', { name: 'Build your investment view' })).toBeTruthy()
    expect(api.fetchInvestmentPortfolio).toHaveBeenCalledTimes(1)
    expect(api.searchInvestmentInstruments).not.toHaveBeenCalled()
    expect(api.refreshInvestmentMarketData).not.toHaveBeenCalled()
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

  it('saving a discovered instrument does not trigger a price refresh', async () => {
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

    await waitFor(() => expect(api.createInvestmentInstrument).toHaveBeenCalledTimes(1))
    expect(api.refreshInvestmentMarketData).not.toHaveBeenCalled()
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
})
