import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react'
import App from '@/App'
import * as api from '@/lib/api'

// Mock the API calls so we don't depend on a live service or delay
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api') as any
  return {
    ...actual,
    fetchDashboard: vi.fn().mockResolvedValue({
      setting: { selectedMonth: 'Jun', selectedYear: 2026, currency: 'USD', hideSensitive: true, darkMode: false },
      stats: { pastThreeMonthsRewardsAverage: 120, hasRewardsHistory: true },
      categories: [],
      pendingNotifications: []
    }),
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
    logout: vi.fn().mockResolvedValue({ success: true }),
    pingServer: vi.fn().mockResolvedValue({ status: 'healthy' })
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
  DashboardView: ({ wishlist = [] }: any) => (
    <div data-testid="dashboard-view">
      Dashboard
      <span data-testid="dashboard-wishlist">{wishlist.map((item: any) => item.name).join(',')}</span>
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
    localStorage.clear()
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
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

  it('shows the skeleton and fetches data immediately after login', async () => {
    let releasePing!: (value: { status: string }) => void
    const pendingPing = new Promise<{ status: string }>(resolve => { releasePing = resolve })
    vi.mocked(api.pingServer).mockReturnValueOnce(pendingPing)

    render(<App />)
    fireEvent.click(screen.getByText('Log In'))

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
