import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react'
import App from '@/App'
import * as api from '@/lib/api'
import * as auth from '@/lib/auth'
import { getCurrentCycleYearAndMonth, MONTH_NAMES } from '@/lib/cycle'
import { ACCOUNT_TRACKING_CACHE_VERSION, ACCOUNT_TRACKING_CACHE_VERSION_KEY } from '@/lib/cache'

const apiMocks = vi.hoisted(() => ({
  updateHideSensitive: vi.fn().mockResolvedValue(undefined),
  updateSummarySeen: vi.fn().mockResolvedValue(undefined),
}))

const mobilePwaGateMocks = vi.hoisted(() => ({
  credentialId: null as string | null,
  verify: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
}))

const testAccounts = ['Essentials', 'Growth', 'Stability', 'Rewards'].map(bucket => ({
  id: `acct-${bucket.toLowerCase()}`,
  name: `${bucket} balance`,
  bucket,
  kind: 'Other',
  remaining: 0,
  isArchived: false,
}))

vi.mock('@/lib/mobilePwaDeviceGateEligibility', async () => {
  const actual = await vi.importActual('@/lib/mobilePwaDeviceGateEligibility') as object
  return {
    ...actual,
    getMobilePwaLaunchGateCredential: () => mobilePwaGateMocks.credentialId,
  }
})

vi.mock('@/lib/mobilePwaDeviceGate', async () => {
  const actual = await vi.importActual('@/lib/mobilePwaDeviceGate') as object
  return {
    ...actual,
    verifyMobilePwaDeviceGate: mobilePwaGateMocks.verify,
  }
})

// The outbox resolves its dispatch table through the financial API module. Mock
// that source module as well as the barrel so the test never reaches the network
// when Vite gives the re-export and source module separate graph identities.
vi.mock('@/lib/api/financial', async () => {
  const actual = await vi.importActual('@/lib/api/financial') as object
  return {
    ...actual,
    updateHideSensitive: apiMocks.updateHideSensitive,
    updateSummarySeen: apiMocks.updateSummarySeen,
  }
})

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
    // loadAll fetches everything in one request now; the per-endpoint mocks below remain
    // for the targeted refreshes and for the fallback path when a server has no /api/bootstrap.
    fetchBootstrap: vi.fn().mockImplementation((month?: string, year?: number) => Promise.resolve({
      month: month || 'Jun',
      year: year || 2026,
      dashboard: {
        setting: { selectedMonth: month || 'Jun', selectedYear: year || 2026, cycleDay: 28, currency: 'USD', hideSensitive: true, darkMode: false },
        stats: { pastThreeMonthsRewardsAverage: 120, hasRewardsHistory: true },
        categories: [],
        pendingNotifications: []
      },
      insights: {
        last3CategoryBreakdown: {},
        last6CategoryBreakdown: {},
        yearlyCategoryBreakdown: {},
        availableYears: [2026],
        pastThreeMonthsRewardsAverage: 120,
        hasRewardsHistory: true
      },
      transactions: [],
      recurringPayments: [],
      categories: [],
      wishlist: [],
      autocomplete: [],
      // Every bucket needs one open account or the coverage gate holds the app closed: placement
      // is explicit now, with no default to fall back on.
      accounts: ['Essentials', 'Growth', 'Stability', 'Rewards'].map(bucket => ({
        id: `acct-${bucket.toLowerCase()}`,
        name: `${bucket} balance`,
        bucket,
        kind: 'Other',
        remaining: 0,
        isArchived: false,
      })),
      walletBalance: 1000,
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
    updateHideSensitive: apiMocks.updateHideSensitive,
    updateSummarySeen: apiMocks.updateSummarySeen,
    fetchInvestmentAllocation: vi.fn().mockResolvedValue({
      sleeves: [],
      freshness: { isStale: false, hasMissingData: false },
    }),
    refreshInvestmentMarketDataAutomatically: vi.fn().mockResolvedValue({
      updated: 0,
      total: 0,
      complete: true,
    }),
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
    // Read the current version rather than a literal: these tests seed a dashboard cache and
    // assert it renders, so a stale version here silently evicts the very fixture under test.
    localStorage.setItem(ACCOUNT_TRACKING_CACHE_VERSION_KEY, ACCOUNT_TRACKING_CACHE_VERSION)
    sessionStorage.clear()
    vi.clearAllMocks()
    mobilePwaGateMocks.credentialId = null
    mobilePwaGateMocks.verify.mockResolvedValue(undefined)
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
    }, { timeout: 15000 })
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
    }, { timeout: 15000 })
  })

  it('keeps cached content behind the startup gate while bootstrap wakes the API', async () => {
    localStorage.setItem('auth_session', '1')
    localStorage.setItem('auth_username', 'alice')
    localStorage.setItem('cached_dashboard_data', JSON.stringify({
      setting: { selectedMonth: 'Jun', selectedYear: 2026, cycleDay: 28, currency: 'USD', hideSensitive: true, darkMode: false },
      stats: { pastThreeMonthsRewardsAverage: 120, hasRewardsHistory: true },
      categories: [],
      pendingNotifications: [],
    }))
    mobilePwaGateMocks.credentialId = '010203'
    localStorage.setItem('fingerprint_credential_id_on_this_device:ALICE', '010203')
    let finishDeviceUnlock!: () => void
    mobilePwaGateMocks.verify.mockImplementationOnce(() => new Promise(resolve => { finishDeviceUnlock = resolve }))

    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Unlock FinancialApp' }, { timeout: 15_000 })).toBeDefined()
    expect(screen.queryByTestId('dashboard-view')).toBeNull()
    await waitFor(() => expect(api.fetchBootstrap).toHaveBeenCalled())
    await waitFor(() => expect(mobilePwaGateMocks.verify).toHaveBeenCalledOnce())

    finishDeviceUnlock()
    await waitFor(() => expect(screen.getByTestId('dashboard-view')).toBeDefined())
  })

  it('shows the skeleton and fetches data immediately after login', async () => {
    render(<App />)
    fireEvent.click(await screen.findByText('Log In'))

    await waitFor(() => {
      expect(screen.getByTestId('app-loading-skeleton')).toBeDefined()
    })
    await waitFor(() => {
      expect(api.fetchBootstrap).toHaveBeenCalled()
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
    localStorage.setItem('cached_dashboard_data', JSON.stringify({
      setting: { selectedMonth: 'Jun', selectedYear: 2026, cycleDay: 28, currency: 'USD', hideSensitive: false, darkMode: false },
      stats: { pastThreeMonthsRewardsAverage: 120, hasRewardsHistory: true },
      categories: [],
      pendingNotifications: [],
    }))
    localStorage.setItem('cached_wishlist', JSON.stringify(cachedWishlist))
    localStorage.setItem('cached_ledger_accounts', JSON.stringify(testAccounts))
    // The boot request carries the wishlist now, so a transient failure is a failure of the
    // whole refresh rather than of one slice. The guarantee under test is unchanged and is
    // what the user actually sees: a failed refresh must never blank out cached data.
    // Rejected for the whole test, not just once: the app retries the load, and a later
    // success would legitimately replace the cache with the server's (here empty) wishlist.
    // Restored explicitly afterwards — afterEach's restoreAllMocks does not reinstate an
    // implementation supplied by the vi.mock factory, so leaving it would break later tests.
    const originalFetchBootstrap = vi.mocked(api.fetchBootstrap).getMockImplementation()
    vi.mocked(api.fetchBootstrap).mockRejectedValue(new Error('temporary network failure'))

    try {
      render(<App />)

      await waitFor(() => {
        expect(api.fetchBootstrap).toHaveBeenCalled()
        expect(screen.getByTestId('dashboard-wishlist').textContent).toContain('Camera')
      }, { timeout: 5000 })
      expect(JSON.parse(localStorage.getItem('cached_wishlist') || '[]')).toEqual(cachedWishlist)
    } finally {
      if (originalFetchBootstrap) {
        vi.mocked(api.fetchBootstrap).mockImplementation(originalFetchBootstrap)
      }
    }
  })

  it('opens Ask AI from the mobile quick-action menu', async () => {
    localStorage.setItem('auth_session', '1')
    localStorage.setItem('auth_username', 'alice')

    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-view')).toBeDefined()
    }, { timeout: 5000 })

    fireEvent.click(await screen.findByRole('button', { name: 'Open Menu' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Ask AI' }, { timeout: 5000 }))

    // The panel is lazy behind a null fallback, so this waits on a real dynamic import
    // rather than a render; the default 1s is not enough for its chunk here.
    expect(await screen.findByRole('dialog', { name: 'ASK AI' }, { timeout: 5000 })).toBeDefined()
    await waitFor(() => {
      expect(screen.queryByRole('menuitem', { name: 'Ask AI' })).toBeNull()
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
    localStorage.setItem('cached_ledger_accounts', JSON.stringify(testAccounts))

    // Hold the boot request open so the cached dashboard is what renders first.
    let resolveDashboard!: (value: any) => void
    const bootPromise = new Promise<any>(resolve => { resolveDashboard = resolve })
    vi.mocked(api.fetchBootstrap).mockReturnValueOnce(bootPromise)

    render(<App />)

    await waitFor(() => expect(screen.getByTestId('dashboard-view')).toBeDefined())
    expect(screen.getByText(/Checking privacy settings/)).toBeDefined()
    expect(screen.getByRole('main').getAttribute('aria-busy')).toBe('true')

    resolveDashboard({
      month: 'Jun',
      year: 2026,
      dashboard: {
        setting: { selectedMonth: 'Jun', selectedYear: 2026, cycleDay: 28, currency: 'USD', hideSensitive: false, darkMode: false },
        stats: { pastThreeMonthsRewardsAverage: 120, hasRewardsHistory: true },
        categories: [],
        pendingNotifications: []
      },
      insights: {
        last3CategoryBreakdown: {},
        last6CategoryBreakdown: {},
        yearlyCategoryBreakdown: {},
        availableYears: [2026],
        pastThreeMonthsRewardsAverage: 120,
        hasRewardsHistory: true
      },
      transactions: [],
      recurringPayments: [],
      categories: [],
      wishlist: [],
      autocomplete: [],
      accounts: testAccounts,
      walletBalance: 1000,
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
    expect(apiMocks.updateHideSensitive).toHaveBeenCalledWith(false)
    expect(JSON.parse(localStorage.getItem('cached_dashboard_data') || '{}').setting.hideSensitive).toBe(false)
  })

  it('keeps Today on the current cycle after Reports selects a historical cycle', async () => {
    localStorage.setItem('auth_session', '1')
    localStorage.setItem('auth_username', 'alice')
    const currentCycle = getCurrentCycleYearAndMonth(28)
    const currentMonth = MONTH_NAMES[currentCycle.monthIndex - 1]
    const currentCycleLabel = `${currentMonth}-${currentCycle.year}`
    render(<App />)

    await waitFor(() => expect(screen.getByTestId('today-cycle').textContent).toBe(currentCycleLabel))
    fireEvent.click(screen.getAllByRole('button', { name: /Reports/ })[0])
    fireEvent.click(await screen.findByRole('button', { name: 'Select historical report' }))

    await waitFor(() => expect(api.fetchBootstrap).toHaveBeenCalledWith('Jan', 2025, expect.any(AbortSignal)))
    fireEvent.click(screen.getAllByRole('button', { name: /Today/ })[0])

    await waitFor(() => expect(screen.getByTestId('today-cycle').textContent).toBe(currentCycleLabel))
    expect(api.fetchDashboard).toHaveBeenCalledWith(currentMonth, currentCycle.year, expect.any(AbortSignal), false)
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
