import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createInvestmentAccount,
  createInvestmentActivity,
  createInvestmentCashFlow,
  createInvestmentInstrument,
  deleteInvestmentAccount,
  deleteInvestmentActivity,
  deleteInvestmentCashFlow,
  deleteInvestmentInstrument,
  fetchCurrencyCatalog,
  fetchInstrumentHistory,
  fetchInvestmentActivity,
  fetchInvestmentAllocation,
  fetchInvestmentCashFlows,
  fetchInvestmentPortfolio,
  refreshInvestmentMarketData,
  refreshInvestmentMarketDataAutomatically,
  restoreInvestmentActivity,
  restoreInvestmentCashFlow,
  searchInvestmentInstruments,
  updateInvestmentAccount,
  updateInvestmentActivity,
  updateInvestmentAllocationOrder,
  updateInvestmentAllocationSleeve,
  updateInvestmentCashFlow,
  updateInvestmentInstrument,
  updateInvestmentPlan,
} from './investments'
import { invalidateCache } from './client'

const jsonResponse = (value: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...headers },
  })

const requestPath = (call: unknown[]) => new URL(String(call[0])).pathname + new URL(String(call[0])).search

describe('investments API contract', () => {
  afterEach(() => {
    invalidateCache()
    localStorage.clear()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('maps the portfolio, history, search, catalog, and paged activity routes', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ summary: {}, holdings: [], accounts: [], instruments: [], chart: [], allocation: {} }))
      .mockResolvedValueOnce(jsonResponse({ instrumentId: 'instrument', points: [] }))
      .mockResolvedValueOnce(jsonResponse({ results: [], providerConfigured: false, providerContacted: false }))
      .mockResolvedValueOnce(jsonResponse([{ code: 'USD', symbol: '$', name: 'US dollar', label: 'USD ($) · US dollar' }]))
      .mockResolvedValueOnce(jsonResponse({ items: [], total: 0, page: 2, pageSize: 25 }))
      .mockResolvedValueOnce(jsonResponse({ items: [], total: 0, page: 1, pageSize: 10 }))
    vi.stubGlobal('fetch', fetchMock)

    await fetchInvestmentPortfolio('3m')
    await fetchInstrumentHistory('instrument', '1y')
    await searchInvestmentInstruments('S&P 500')
    await fetchCurrencyCatalog()
    await fetchInvestmentActivity({ accountId: 'account', page: 2, pageSize: 25 })
    await fetchInvestmentCashFlows({ page: 1, pageSize: 10 })

    expect(requestPath(fetchMock.mock.calls[0])).toContain('/investments/portfolio?range=3m')
    expect(requestPath(fetchMock.mock.calls[1])).toContain('/investments/instruments/instrument/history?range=1y')
    expect(requestPath(fetchMock.mock.calls[2])).toContain('/investments/instruments/search?q=S%26P%20500')
    expect(requestPath(fetchMock.mock.calls[3])).toContain('/investments/currencies')
    expect(requestPath(fetchMock.mock.calls[4])).toContain('/investments/transactions?accountId=account&page=2&pageSize=25')
    expect(requestPath(fetchMock.mock.calls[5])).toContain('/investments/cash-flows?page=1&pageSize=10')
  })

  it('sends every investment mutation to the matching route and invalidates its pages', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({ id: 'result' })))
    vi.stubGlobal('fetch', fetchMock)
    const accountId = 'account'
    const instrumentId = 'instrument'
    const activityId = 'activity'
    const flowId = 'flow'
    const account = { name: 'Broker', baseCurrency: 'USD' as const }
    const instrument = {
      symbol: 'VTI', name: 'Fund', type: 'ETF' as const, currency: 'USD', isCustom: true,
    }
    const activity = {
      accountId, instrumentId, type: 'Buy' as const, tradeDate: '2026-08-01',
      units: 1, unitPrice: 10, cashAmount: 10, fees: 0, taxes: 0,
    }
    const flow = { accountId, currency: 'USD', type: 'Deposit' as const, amount: 10, date: '2026-08-01' }

    await createInvestmentAccount(account)
    await updateInvestmentAccount(accountId, account)
    await deleteInvestmentAccount(accountId)
    await createInvestmentInstrument(instrument)
    await updateInvestmentInstrument(instrumentId, instrument)
    await deleteInvestmentInstrument(instrumentId)
    await createInvestmentActivity(activity)
    await updateInvestmentActivity(activityId, activity)
    await deleteInvestmentActivity(activityId)
    await restoreInvestmentActivity({ transactions: [] })
    await createInvestmentCashFlow(flow)
    await updateInvestmentCashFlow(flowId, flow)
    await deleteInvestmentCashFlow(flowId)
    await restoreInvestmentCashFlow({ id: flowId, ...flow })
    await refreshInvestmentMarketData()
    await refreshInvestmentMarketDataAutomatically()
    await updateInvestmentPlan({ usEquityTarget: 66, internationalExUsTarget: 10, bondsTarget: 24, watchDrift: 3, alertDrift: 5 })
    await updateInvestmentAllocationSleeve(instrumentId, 'USEquity')
    await updateInvestmentAllocationOrder([instrumentId])

    const calls = fetchMock.mock.calls
    expect(calls.map(requestPath)).toEqual(expect.arrayContaining([
      '/api/investments/accounts',
      `/api/investments/accounts/${accountId}`,
      `/api/investments/instruments/${instrumentId}`,
      '/api/investments/transactions',
      `/api/investments/transactions/${activityId}`,
      '/api/investments/transactions/restore',
      '/api/investments/cash-flows',
      `/api/investments/cash-flows/${flowId}`,
      '/api/investments/cash-flows/restore',
      '/api/investments/market-data/refresh',
      '/api/investments/allocation/plan',
      `/api/investments/instruments/${instrumentId}/allocation-sleeve`,
      '/api/investments/allocation/order',
    ]))
    expect(calls.find(call => requestPath(call) === '/api/investments/accounts')?.[1]).toMatchObject({ method: 'POST' })
    expect(calls.find(call => requestPath(call) === `/api/investments/transactions/${activityId}`)?.[1]).toMatchObject({ method: 'PUT' })
    expect(calls.find(call => requestPath(call) === '/api/investments/allocation/order')?.[1]).toMatchObject({ method: 'PUT' })
  })

  it('reuses a 304 payload and clears the ETag after a same-user mutation', async () => {
    expect(jsonResponse({ ok: true }, { ETag: 'W/"check"' }).headers.get('ETag')).toBe('W/"check"')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ status: 'OnTrack' }, { ETag: 'W/"allocation-1"' }))
      .mockResolvedValueOnce(new Response(null, { status: 304, headers: { ETag: 'W/"allocation-1"' } }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse({ status: 'OnTrack' }))
    vi.stubGlobal('fetch', fetchMock)

    await fetchInvestmentAllocation()
    await fetchInvestmentAllocation()
    const secondHeaders = new Headers(fetchMock.mock.calls[1][1].headers)
    expect(secondHeaders.get('If-None-Match')).toBe('W/"allocation-1"')

    await createInvestmentAccount({ name: 'New broker', baseCurrency: 'USD' })
    await fetchInvestmentAllocation()
    const afterMutationHeaders = new Headers(fetchMock.mock.calls[3][1].headers)
    expect(afterMutationHeaders.has('If-None-Match')).toBe(false)
  })
})
