import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const dashboardPayload = {
  setting: {
    targetStabilityFund: 'd1leUV5NWVE=',
    selectedMonth: 'Jun',
    selectedYear: 2026,
    essentialsAlloc: 0.5,
    growthAlloc: 0.25,
    stabilityAlloc: 0.15,
    rewardsAlloc: 0.1,
    cycleDay: 28,
    darkMode: true,
    hideSensitive: false,
    currency: 'MYR',
  },
  categories: [],
  stats: {
    totalBalance: 'd1leUV5NWVE=',
    monthlyIncome: 'd1leUV5NWVE=',
    monthlyInflow: 'd1leUV5NWVE=',
    monthlyExpenses: 'd1leUV5NWVE=',
    activeRecurringTotal: 'd1leUV5NWVE=',
  },
  activeRecurringPayments: [],
  trendPoints: [],
  last3TrendPoints: [],
  last6TrendPoints: [],
  pendingNotifications: [],
  monthlyCategoryBreakdown: [],
}

function mockDashboardFetch() {
  return vi.fn(() =>
    Promise.resolve(new Response(JSON.stringify(dashboardPayload), { status: 200 }))
  )
}

beforeEach(() => {
  vi.resetModules()
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('fetchDashboard request caching', () => {
  it('does not reuse cached promises for abortable startup requests', async () => {
    const fetchMock = mockDashboardFetch()
    vi.stubGlobal('fetch', fetchMock)
    Object.defineProperty(window, 'fetch', { value: fetchMock, configurable: true })

    const api = await import('./api')
    await api.fetchDashboard(undefined, undefined, new AbortController().signal)
    await api.fetchDashboard(undefined, undefined, new AbortController().signal)

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('still dedupes non-abortable dashboard requests', async () => {
    const fetchMock = mockDashboardFetch()
    vi.stubGlobal('fetch', fetchMock)
    Object.defineProperty(window, 'fetch', { value: fetchMock, configurable: true })

    const api = await import('./api')
    await Promise.all([
      api.fetchDashboard(),
      api.fetchDashboard(),
    ])

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('chatWithAi state contract', () => {
  it('sends conversation state in the request body and returns it from the response', async () => {
    const state = { lastIntent: 'ledger.spending_total', lastSearchText: 'coffee' }
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response(
        JSON.stringify({ reply: 'ok', actions: [], closeChat: false, state }),
        { status: 200 },
      )))
    vi.stubGlobal('fetch', fetchMock)
    Object.defineProperty(window, 'fetch', { value: fetchMock, configurable: true })

    const api = await import('./api')
    const result = await api.chatWithAi('how much did I spend', [], state)

    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body)
    expect(body.state).toEqual(state)
    expect(result.state).toEqual(state)
  })

  it('sends null state when none is provided and tolerates a missing state field', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response(
        JSON.stringify({ reply: 'ok', actions: [], closeChat: false }),
        { status: 200 },
      )))
    vi.stubGlobal('fetch', fetchMock)
    Object.defineProperty(window, 'fetch', { value: fetchMock, configurable: true })

    const api = await import('./api')
    const result = await api.chatWithAi('hello', [])

    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body)
    expect(body.state).toBeNull()
    expect(result.state).toBeNull()
  })

  it('normalizes malformed response state before returning it to the panel', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(
      JSON.stringify({ reply: 'ok', actions: [], closeChat: false, state: {
        lastSearchText: '  coffee  ',
        lastMatchedTransactionIds: ['a', 42, '', ...Array.from({ length: 60 }, (_, i) => `id-${i}`)],
        lastWishlistItemId: -4,
        lastTopic: 'recurring',
        lastQueryFacets: ['recurring_cost', 42, '', 'recurring_status'],
        lastRecurringStatus: 'paid',
        lastTargetAmount: 5000,
      } }),
      { status: 200 },
    )))
    vi.stubGlobal('fetch', fetchMock)
    Object.defineProperty(window, 'fetch', { value: fetchMock, configurable: true })

    const api = await import('./api')
    const result = await api.chatWithAi('follow up', [])

    expect(result.state?.lastSearchText).toBe('coffee')
    expect(result.state?.lastMatchedTransactionIds).toHaveLength(50)
    expect(result.state?.lastWishlistItemId).toBeNull()
    expect(result.state?.lastTopic).toBe('recurring')
    expect(result.state?.lastQueryFacets).toEqual(['recurring_cost', 'recurring_status'])
    expect(result.state?.lastRecurringStatus).toBe('paid')
    expect(result.state?.lastTargetAmount).toBe(5000)
  })
})
