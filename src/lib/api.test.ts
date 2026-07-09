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
