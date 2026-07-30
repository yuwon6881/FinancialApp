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
  sessionStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('fetchDashboard request caching', () => {
  it('can read a summary cycle without persisting it as the selected report period', async () => {
    const fetchMock = mockDashboardFetch()
    vi.stubGlobal('fetch', fetchMock)
    Object.defineProperty(window, 'fetch', { value: fetchMock, configurable: true })

    const api = await import('./api')
    await api.fetchDashboard('Jun', 2026, undefined, false, true)

    const [url] = fetchMock.mock.calls[0] as unknown as [string]
    expect(url).toContain('/financial/dashboard?month=Jun&year=2026&persistSelection=false&summaryOnly=true')
  })

  it('dedupes abortable startup requests onto one shared fetch', async () => {
    const fetchMock = mockDashboardFetch()
    vi.stubGlobal('fetch', fetchMock)
    Object.defineProperty(window, 'fetch', { value: fetchMock, configurable: true })

    const api = await import('./api')
    await api.fetchDashboard(undefined, undefined, new AbortController().signal)
    await api.fetchDashboard(undefined, undefined, new AbortController().signal)

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('an aborted caller detaches without cancelling the shared fetch', async () => {
    const fetchMock = mockDashboardFetch()
    vi.stubGlobal('fetch', fetchMock)
    Object.defineProperty(window, 'fetch', { value: fetchMock, configurable: true })

    const api = await import('./api')
    const ac = new AbortController()
    const abortedCall = api.fetchDashboard(undefined, undefined, ac.signal)
    ac.abort()

    await expect(abortedCall).rejects.toMatchObject({ name: 'AbortError' })
    // The underlying fetch completed and warmed the cache for the next caller.
    await expect(api.fetchDashboard()).resolves.toBeTruthy()
    expect(fetchMock).toHaveBeenCalledTimes(1)
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

    const api = await import('./api/ai')
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

    const api = await import('./api/ai')
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

    const api = await import('./api/ai')
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
  it('does not attach a bearer header on the web (cookie-authenticated)', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response('[]', { status: 200 })))
    vi.stubGlobal('fetch', fetchMock)
    Object.defineProperty(window, 'fetch', { value: fetchMock, configurable: true })

    const api = await import('./api')
    await api.fetchTransactions()

    const [, requestInit] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    const headers = new Headers(requestInit.headers)
    expect(headers.get('Authorization')).toBeNull()
  })

  it('adds the bearer token to authenticated requests on native', async () => {
    vi.doMock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }))
    const secureStore = new Map<string, string>([['auth_token', 'test-token']])
    vi.doMock('@aparajita/capacitor-secure-storage', () => ({
      SecureStorage: {
        get: vi.fn(async (key: string) => secureStore.get(key) ?? null),
        set: vi.fn(async (key: string, value: string) => { secureStore.set(key, value) }),
        remove: vi.fn(async (key: string) => { secureStore.delete(key) }),
      },
    }))
    const fetchMock = vi.fn(() => Promise.resolve(new Response('[]', { status: 200 })))
    vi.stubGlobal('fetch', fetchMock)
    Object.defineProperty(window, 'fetch', { value: fetchMock, configurable: true })

    const api = await import('./api')
    await api.fetchTransactions()

    const [, requestInit] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    const headers = new Headers(requestInit.headers)
    expect(headers.get('Authorization')).toBe('Bearer test-token')
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

  it('rejects failed dark-mode and sensitive-display preference updates', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 500 }))
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
    vi.stubGlobal('fetch', fetchMock)
    Object.defineProperty(window, 'fetch', { value: fetchMock, configurable: true })

    const api = await import('./api')

    await expect(api.updateDarkMode(true))
      .rejects.toMatchObject({ status: 500, message: 'Failed to persist dark mode preference' })
    await expect(api.updateHideSensitive(false))
      .rejects.toMatchObject({ status: 503, message: 'Failed to persist hide sensitive preference' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
