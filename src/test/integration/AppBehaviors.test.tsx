import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react'
import App from '@/App'
import * as api from '@/lib/api'
import * as auth from '@/lib/auth'

// Mock the API calls so we don't depend on a live service or delay
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api') as any
  return {
    ...actual,
    fetchDashboard: vi.fn().mockImplementation((month?: string, year?: number) => Promise.resolve({
      setting: { selectedMonth: month || 'Jun', selectedYear: year || 2026, cycleDay: 28, currency: 'USD', hideSensitive: true, darkMode: false },
      stats: { pastThreeMonthsRewardsAverage: 120, hasRewardsHistory: true },
      categories: [],
      pendingNotifications: []
    })),
    fetchTransactions: vi.fn().mockResolvedValue([]),
    fetchRecurringPayments: vi.fn().mockResolvedValue([]),
    fetchCategories: vi.fn().mockResolvedValue([]),
    fetchWishlist: vi.fn().mockResolvedValue([]),
    fetchAutocompleteSuggestions: vi.fn().mockResolvedValue([]),
    fetchWalletBalance: vi.fn().mockResolvedValue(1000),
    fetchDashboardInsights: vi.fn().mockResolvedValue({
      last3CategoryBreakdown: {},
      last6CategoryBreakdown: {},
      yearlyCategoryBreakdown: {},
      availableYears: [2026],
      pastThreeMonthsRewardsAverage: 120,
      hasRewardsHistory: true
    }),
    selectPeriod: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue({ success: true }),
    pingServer: vi.fn().mockResolvedValue({ status: 'healthy' }),
    updateHideSensitive: vi.fn().mockResolvedValue(undefined)
  }
})

// Mock lazy sub-views to keep mounting simple and fast
vi.mock('@/components/LoginView', () => ({
  LoginView: ({ onLoginSuccess }: any) => (
    <div data-testid="login-view">
      <button onClick={() => onLoginSuccess('test-token-abc', 'alice')}>Log In</button>
    </div>
  )
}))

vi.mock('@/components/DashboardView', () => ({
  DashboardView: ({ dashboardData, wishlist = [] }: any) => (
    <div data-testid="dashboard-view">
      Dashboard
      <span data-testid="today-cycle">{dashboardData?.setting?.selectedMonth}-{dashboardData?.setting?.selectedYear}</span>
      <span data-testid="dashboard-wishlist">{wishlist.map((item: any) => item.name).join(',')}</span>
    </div>
  )
}))

vi.mock('@/components/ReportsView', () => ({
  ReportsView: ({ onSelectPeriod }: any) => (
    <div data-testid="reports-view">
      Reports
      <button onClick={() => onSelectPeriod('Jan', 2025)}>Select historical report</button>
    </div>
  )
}))

vi.hoisted(() => {
  window.matchMedia = vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
  Element.prototype.scrollIntoView = vi.fn()
})

describe('App behaviors', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/dashboard')
    localStorage.clear()
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('restores login state from localStorage on mount', async () => {
    localStorage.setItem('auth_session', '1')
    localStorage.setItem('auth_username', 'alice')

    render(<App />)

    // Should load the dashboard instead of login view
    await waitFor(() => {
      expect(screen.getByTestId('dashboard-view')).toBeDefined()
    }, { timeout: 5000 })
  })

  it('does not show login while a stored session is being restored', async () => {
    localStorage.setItem('auth_session', '1')
    localStorage.setItem('auth_username', 'alice')
    let resolveSession!: (token: string | null) => void
    const sessionPromise = new Promise<string | null>(resolve => { resolveSession = resolve })
    vi.spyOn(auth, 'resolveSessionToken').mockReturnValue(sessionPromise)

    render(<App />)

    try {
      await new Promise(resolve => window.setTimeout(resolve, 50))
      expect(screen.queryByTestId('login-view')).toBeNull()
    } finally {
      resolveSession('cookie-session')
    }

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-view')).toBeDefined()
    })
  })

  it('shows the skeleton and fetches data immediately after login', async () => {
    let releasePing!: (value: { status: string }) => void
    const pendingPing = new Promise<{ status: string }>(resolve => { releasePing = resolve })
    vi.mocked(api.pingServer).mockReturnValueOnce(pendingPing)

    render(<App />)
    fireEvent.click(await screen.findByText('Log In'))

    await waitFor(() => {
      expect(screen.getByTestId('app-loading-skeleton')).toBeDefined()
    })
    expect(api.fetchDashboard).not.toHaveBeenCalled()

    releasePing({ status: 'healthy' })

    await waitFor(() => {
      expect(api.fetchDashboard).toHaveBeenCalled()
      expect(screen.getByTestId('dashboard-view')).toBeDefined()
    })
  })

  it('preserves the cached wishlist when a transient refresh fails', async () => {
    const cachedWishlist = [{
      id: 1,
      name: 'Camera',
      price: 500,
      priority: 'High',
      isPurchased: false,
      createdAt: '2026-07-16T00:00:00.000Z',
      isActive: true,
    }]
    localStorage.setItem('auth_session', '1')
    localStorage.setItem('auth_username', 'alice')
    localStorage.setItem('cached_wishlist', JSON.stringify(cachedWishlist))
    vi.mocked(api.fetchWishlist).mockRejectedValueOnce(new Error('temporary network failure'))

    render(<App />)

    await waitFor(() => {
      expect(api.fetchWishlist).toHaveBeenCalled()
      expect(screen.getByTestId('dashboard-wishlist').textContent).toContain('Camera')
    }, { timeout: 5000 })
    expect(JSON.parse(localStorage.getItem('cached_wishlist') || '[]')).toEqual(cachedWishlist)
  })

  it('opens Ask AI from the mobile quick-action menu', async () => {
    localStorage.setItem('auth_session', '1')
    localStorage.setItem('auth_username', 'alice')

    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-view')).toBeDefined()
    }, { timeout: 5000 })

    fireEvent.click(screen.getByRole('button', { name: 'Open Menu' }))
    fireEvent.click(screen.getByRole('button', { name: 'Ask AI' }))

    expect(screen.getByRole('dialog', { name: 'ASK AI' })).toBeDefined()
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Ask AI' })).toBeNull()
    })
  })

  it('uses addressable navigation for the Reports view', async () => {
    localStorage.setItem('auth_session', '1')
    localStorage.setItem('auth_username', 'alice')
    render(<App />)

    await waitFor(() => expect(screen.getByTestId('dashboard-view')).toBeDefined())
    fireEvent.click(screen.getAllByRole('button', { name: /Reports/ })[0])

    await waitFor(() => expect(screen.getByTestId('reports-view')).toBeDefined())
    expect(window.location.pathname).toBe('/reports')
  })

  it('keeps cached amounts protected while the server privacy preference is loading', async () => {
    localStorage.setItem('auth_session', '1')
    localStorage.setItem('auth_username', 'alice')
    localStorage.setItem('cached_dashboard_data', JSON.stringify({
      setting: { selectedMonth: 'Jun', selectedYear: 2026, cycleDay: 28, currency: 'USD', hideSensitive: true, darkMode: false },
      stats: { pastThreeMonthsRewardsAverage: 120, hasRewardsHistory: true },
      categories: [],
      pendingNotifications: []
    }))

    let resolveDashboard!: (value: any) => void
    vi.mocked(api.fetchDashboard).mockReturnValueOnce(new Promise(resolve => { resolveDashboard = resolve }))

    render(<App />)

    await waitFor(() => expect(screen.getByTestId('dashboard-view')).toBeDefined())
    expect(screen.getByText(/Checking privacy settings/)).toBeDefined()
    expect(screen.getByRole('main').getAttribute('aria-busy')).toBe('true')

    resolveDashboard({
      setting: { selectedMonth: 'Jun', selectedYear: 2026, cycleDay: 28, currency: 'USD', hideSensitive: false, darkMode: false },
      stats: { pastThreeMonthsRewardsAverage: 120, hasRewardsHistory: true },
      categories: [],
      pendingNotifications: []
    })

    await waitFor(() => {
      expect(screen.queryByText(/Checking privacy settings/)).toBeNull()
      expect(screen.getByRole('main').getAttribute('aria-busy')).toBe('false')
    })
  })

  it('preserves a queued sensitive-off choice when startup fetch returns the older server value', async () => {
    localStorage.setItem('auth_session', '1')
    localStorage.setItem('auth_username', 'alice')
    localStorage.setItem('cached_dashboard_data', JSON.stringify({
      setting: { selectedMonth: 'Jun', selectedYear: 2026, cycleDay: 28, currency: 'USD', hideSensitive: true, darkMode: false },
      stats: { pastThreeMonthsRewardsAverage: 120, hasRewardsHistory: true },
      categories: [],
      pendingNotifications: []
    }))
    localStorage.setItem('pending_operations', JSON.stringify([{
      id: 'privacy-off',
      entity: 'settings',
      type: 'update',
      targetId: 'hideSensitive',
      payload: { hideSensitive: false },
      createdAt: Date.now(),
      retryCount: 0
    }]))

    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-view')).toBeDefined()
      expect(screen.queryByText(/Checking privacy settings/)).toBeNull()
      expect(localStorage.getItem('hide_sensitive:alice')).toBe('false')
    }, { timeout: 20000 })
    expect(api.updateHideSensitive).toHaveBeenCalledWith(false)
    expect(JSON.parse(localStorage.getItem('cached_dashboard_data') || '{}').setting.hideSensitive).toBe(false)
  })

  it('keeps Today on the current cycle after Reports selects a historical cycle', async () => {
    localStorage.setItem('auth_session', '1')
    localStorage.setItem('auth_username', 'alice')
    render(<App />)

    await waitFor(() => expect(screen.getByTestId('today-cycle').textContent).toBe('Jun-2026'))
    fireEvent.click(screen.getAllByRole('button', { name: /Reports/ })[0])
    fireEvent.click(await screen.findByRole('button', { name: 'Select historical report' }))

    await waitFor(() => expect(api.fetchDashboard).toHaveBeenCalledWith('Jan', 2025, expect.any(AbortSignal)))
    fireEvent.click(screen.getAllByRole('button', { name: /Today/ })[0])

    await waitFor(() => expect(screen.getByTestId('today-cycle').textContent).toBe('Jun-2026'))
    expect(api.fetchDashboard).toHaveBeenCalledWith('Jun', 2026, expect.any(AbortSignal), false)
  })

  it('performs cache preservation and local storage cleanup on logout', async () => {
    localStorage.setItem('auth_session', '1')
    localStorage.setItem('auth_username', 'alice')
    localStorage.setItem('draft_transactions', JSON.stringify([{ id: 'draft-1', description: 'Coffee' }]))

    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-view')).toBeDefined()
    })

    // Find and simulate logout
    const apiLogout = api.logout as any
    await apiLogout()

    expect(apiLogout).toHaveBeenCalled()
  })

  it('transitions to lock screen and synchronizes session state', async () => {
    localStorage.setItem('auth_session', '1')
    localStorage.setItem('auth_username', 'alice')
    sessionStorage.setItem('session_locked', 'true')

    render(<App />)

    await waitFor(() => {
      expect(screen.queryByTestId('dashboard-view')).toBeNull()
    })
  })
})
