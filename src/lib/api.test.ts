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

describe('split API client compatibility', () => {
  it('adds the bearer token to authenticated resource requests', async () => {
    localStorage.setItem('auth_token', 'test-token')
    const fetchMock = vi.fn(() => Promise.resolve(new Response('[]', { status: 200 })))
    vi.stubGlobal('fetch', fetchMock)
    Object.defineProperty(window, 'fetch', { value: fetchMock, configurable: true })

    const api = await import('./api')
    await api.fetchTransactions()

    expect(fetchMock).toHaveBeenCalledOnce()
    const [, requestInit] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(requestInit.headers).toMatchObject({ Authorization: 'Bearer test-token' })
  })

  it('evicts a rejected cached request so the next call can retry', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 500 }))
      .mockResolvedValueOnce(new Response('[]', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    Object.defineProperty(window, 'fetch', { value: fetchMock, configurable: true })

    const api = await import('./api')
    await expect(api.fetchTransactions()).rejects.toThrow('Failed to fetch transactions')
    await expect(api.fetchTransactions()).resolves.toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('invalidates cached reads after a successful mutation', async () => {
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PUT') return Promise.resolve(new Response(null, { status: 204 }))
      return Promise.resolve(new Response(JSON.stringify(dashboardPayload), { status: 200 }))
    })
    vi.stubGlobal('fetch', fetchMock)
    Object.defineProperty(window, 'fetch', { value: fetchMock, configurable: true })

    const api = await import('./api')
    await api.fetchDashboard()
    await api.fetchDashboard()
    await api.updateSettings({
      targetStabilityFund: 1_000,
      essentialsAlloc: 0.5,
      growthAlloc: 0.25,
      stabilityAlloc: 0.15,
      rewardsAlloc: 0.1,
      cycleDay: 28,
    })
    await api.fetchDashboard()

    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('dispatches the session-locked event for protected 423 responses', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response('{}', { status: 423 })))
    vi.stubGlobal('fetch', fetchMock)
    Object.defineProperty(window, 'fetch', { value: fetchMock, configurable: true })
    const onLocked = vi.fn()

    const api = await import('./api')
    window.addEventListener(api.SESSION_LOCKED_EVENT, onLocked, { once: true })
    await expect(api.fetchTransactions()).rejects.toThrow('423 Locked')

    expect(onLocked).toHaveBeenCalledOnce()
  })

  it('preserves server error messages for endpoints that expose them', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(
      JSON.stringify({ message: 'Category already exists' }),
      { status: 409 },
    )))
    vi.stubGlobal('fetch', fetchMock)
    Object.defineProperty(window, 'fetch', { value: fetchMock, configurable: true })

    const api = await import('./api')
    await expect(api.addCategory({ name: 'Food' }))
      .rejects.toThrow('Category already exists')
  })
})
