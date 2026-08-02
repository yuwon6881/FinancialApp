import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useFinancialData } from './useFinancialData'
import * as api from '../lib/api'
import type { RecurringPayment } from '../types'

class ApiErrorLike extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

const payment: RecurringPayment = {
  id: 'rp-1',
  name: 'Streaming',
  amount: 50,
  frequency: 'Monthly',
  category: 'Entertainment',
  ledgerCategory: 'Needs',
  nextDueDate: '2026-08-01',
  dueDate: 1,
  startDate: '2026-01-01',
  active: true,
  reminderEnabled: false,
  reminderMode: 'Once',
  reminderLeadDays: 0,
}

const dashboard = {
  setting: { selectedMonth: 'July', selectedYear: 2026, hideSensitive: false, darkMode: false },
  cycleLabel: 'July 2026',
  categories: [],
  stats: {},
  activeRecurringPayments: [],
  trendPoints: [],
  last3TrendPoints: [],
  last6TrendPoints: [],
  pendingNotifications: [],
  monthlyCategoryBreakdown: [],
  last3CategoryBreakdown: [],
  last6CategoryBreakdown: [],
  yearlyCategoryBreakdown: [],
} as any

const insights = {
  last3CategoryBreakdown: [],
  last6CategoryBreakdown: [],
  yearlyCategoryBreakdown: [],
  availableYears: [2026],
  pastThreeMonthsRewardsAverage: 0,
  hasRewardsHistory: false,
} as any

const handleLogout = vi.fn(async () => undefined)
const markSessionLocked = vi.fn()
const markSensitivePreferenceUnavailable = vi.fn()
const setDarkMode = vi.fn()

function renderFinancialData() {
  // Every option must be stable across renders -- an inline literal or `vi.fn()` here
  // would churn `loadAll`'s identity by itself and mask the churn these tests pin.
  const options = {
    token: 'token-1',
    lastUnlockedTimeRef: { current: 0 },
    isLocked: false,
    markSessionLocked,
    handleLogout,
    hideSensitive: false,
    darkMode: false,
    showToast: vi.fn(),
    guardSensitive: () => true,
    setConfirmModalData: vi.fn(),
    resolveHideSensitive: vi.fn(),
    markSensitivePreferenceUnavailable,
    setDarkMode,
    notifyOnLogin: false,
    loadAllAbortRef: { current: null as AbortController | null },
    selectedMonth: 'July',
    setSelectedMonth: vi.fn(),
    selectedYear: 2026,
    setSelectedYear: vi.fn(),
    setHasShownModalThisSession: vi.fn(),
    hasShownModalThisSession: true,
    setShowLoginModal: vi.fn(),
  }
  return renderHook(() => useFinancialData(options as any))
}

function mockHappyApi(recurring: RecurringPayment[] = [payment]) {
  // loadAll boots from the composite endpoint; the individual mocks below still cover the
  // targeted refreshes and the fallback path for a server without /api/bootstrap.
  vi.spyOn(api, 'fetchBootstrap').mockResolvedValue({
    month: 'July',
    year: 2026,
    dashboard,
    insights,
    transactions: [],
    recurringPayments: recurring,
    categories: [],
    wishlist: [],
    autocomplete: [],
    walletBalance: 100,
  } as any)
  vi.spyOn(api, 'fetchDashboard').mockResolvedValue(dashboard)
  vi.spyOn(api, 'fetchTransactions').mockResolvedValue([] as any)
  vi.spyOn(api, 'fetchDashboardInsights').mockResolvedValue(insights)
  vi.spyOn(api, 'fetchRecurringPayments').mockResolvedValue(recurring)
  vi.spyOn(api, 'fetchCategories').mockResolvedValue([] as any)
  vi.spyOn(api, 'fetchWishlist').mockResolvedValue([] as any)
  vi.spyOn(api, 'fetchAutocompleteSuggestions').mockResolvedValue([] as any)
  vi.spyOn(api, 'fetchWalletBalance').mockResolvedValue(100 as any)
}

describe('useFinancialData', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not restart the wake-up ping loop when the outbox queue changes', async () => {
    mockHappyApi()
    // Keep the server "waking" so the ping loop stays live and every effect
    // re-registration would be observable as an extra immediate ping.
    const ping = vi.spyOn(api, 'pingServer').mockResolvedValue({ status: 'waking_up' } as any)

    const { result } = renderFinancialData()
    await waitFor(() => expect(ping).toHaveBeenCalledTimes(1))

    act(() => {
      result.current.mutateQueue(prev =>
        result.current.enqueue(prev, 'transaction', 'add', 'tx-local-1', { amount: 5 } as any))
    })
    // The queue really did change identity -- that is what used to churn `loadAll`.
    expect(result.current.pendingOps).toHaveLength(1)
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)) })

    expect(ping).toHaveBeenCalledTimes(1)
  })

  it('does not let a late startup response roll back a newly selected theme', async () => {
    let resolveBootstrap: (value: unknown) => void = () => undefined
    vi.spyOn(api, 'fetchBootstrap').mockReturnValue(new Promise(resolve => {
      resolveBootstrap = resolve
    }) as any)
    vi.spyOn(api, 'pingServer').mockResolvedValue({ status: 'ok' } as any)
    vi.spyOn(api, 'updateDarkMode').mockReturnValue(new Promise(() => undefined) as any)

    const { result } = renderFinancialData()
    await waitFor(() => expect(api.fetchBootstrap).toHaveBeenCalled())

    act(() => {
      result.current.handleUpdateDarkModePreference(true)
    })

    await act(async () => {
      resolveBootstrap({
        month: 'July',
        year: 2026,
        dashboard,
        insights,
        transactions: [],
        recurringPayments: [],
        categories: [],
        wishlist: [],
        autocomplete: [],
        walletBalance: 100,
      })
    })

    await waitFor(() => expect(result.current.dashboardData?.setting.darkMode).toBe(true))
    expect(setDarkMode).toHaveBeenLastCalledWith(true)
    expect(JSON.parse(localStorage.getItem('cached_dashboard_data') ?? '{}').setting.darkMode).toBe(true)
  })

  it('preserves a theme choice when its fast save completes before the stale startup response', async () => {
    let resolveBootstrap: (value: unknown) => void = () => undefined
    vi.spyOn(api, 'fetchBootstrap').mockReturnValue(new Promise(resolve => {
      resolveBootstrap = resolve
    }) as any)
    vi.spyOn(api, 'pingServer').mockResolvedValue({ status: 'ok' } as any)
    vi.spyOn(api, 'updateDarkMode').mockResolvedValue(undefined as any)

    const { result } = renderFinancialData()
    await waitFor(() => expect(api.fetchBootstrap).toHaveBeenCalled())

    act(() => {
      result.current.handleUpdateDarkModePreference(true)
    })
    await waitFor(() => expect(api.updateDarkMode).toHaveBeenCalledWith(true))
    await waitFor(() => expect(result.current.pendingOps).toHaveLength(0))

    await act(async () => {
      resolveBootstrap({
        month: 'July',
        year: 2026,
        dashboard,
        insights,
        transactions: [],
        recurringPayments: [],
        categories: [],
        wishlist: [],
        autocomplete: [],
        walletBalance: 100,
      })
    })

    await waitFor(() => expect(result.current.dashboardData?.setting.darkMode).toBe(true))
    expect(setDarkMode).toHaveBeenLastCalledWith(true)
    expect(JSON.parse(localStorage.getItem('cached_dashboard_data') ?? '{}').setting.darkMode).toBe(true)
  })

  it('applies the same stale-bootstrap protection to the other financial settings', async () => {
    let resolveBootstrap: (value: unknown) => void = () => undefined
    vi.spyOn(api, 'fetchBootstrap').mockReturnValue(new Promise(resolve => {
      resolveBootstrap = resolve
    }) as any)
    vi.spyOn(api, 'pingServer').mockResolvedValue({ status: 'ok' } as any)
    vi.spyOn(api, 'updateSettings').mockResolvedValue(dashboard.setting as any)

    const { result } = renderFinancialData()
    await waitFor(() => expect(api.fetchBootstrap).toHaveBeenCalled())

    act(() => {
      result.current.handleUpdateSettings({
        targetStabilityFund: 20000,
        essentialsAlloc: 0.4,
        growthAlloc: 0.3,
        stabilityAlloc: 0.2,
        rewardsAlloc: 0.1,
        cycleDay: 25,
        currency: 'MYR',
      })
    })
    await waitFor(() => expect(api.updateSettings).toHaveBeenCalled())
    await waitFor(() => expect(result.current.pendingOps).toHaveLength(0))

    await act(async () => {
      resolveBootstrap({
        month: 'July',
        year: 2026,
        dashboard,
        insights,
        transactions: [],
        recurringPayments: [],
        categories: [],
        wishlist: [],
        autocomplete: [],
        walletBalance: 100,
      })
    })

    await waitFor(() => expect(result.current.dashboardData?.setting.currency).toBe('MYR'))
    expect(result.current.dashboardData?.setting.cycleDay).toBe(25)
  })

  it('logs out on a status-coded 401 that has no "401" in its message', async () => {
    mockHappyApi()
    vi.spyOn(api, 'pingServer').mockResolvedValue({ status: 'ok' } as any)
    vi.spyOn(api, 'fetchBootstrap').mockRejectedValue(new ApiErrorLike('Request failed', 401))

    renderFinancialData()

    await waitFor(() => expect(handleLogout).toHaveBeenCalled())
    expect(markSensitivePreferenceUnavailable).not.toHaveBeenCalled()
  })

  it('locks the session on a status-coded 423 that has no "423" in its message', async () => {
    mockHappyApi()
    vi.spyOn(api, 'pingServer').mockResolvedValue({ status: 'ok' } as any)
    vi.spyOn(api, 'fetchBootstrap').mockRejectedValue(new ApiErrorLike('Request failed', 423))

    renderFinancialData()

    await waitFor(() => expect(markSessionLocked).toHaveBeenCalled())
    expect(handleLogout).not.toHaveBeenCalled()
  })

  it('queues reminder updates and projects them while offline', async () => {
    mockHappyApi()
    vi.spyOn(api, 'pingServer').mockResolvedValue({ status: 'ok' } as any)
    const updateReminder = vi.spyOn(api, 'updateRecurringPaymentReminder').mockResolvedValue(undefined)

    const originalOnline = navigator.onLine
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: false })

    try {
      const { result } = renderFinancialData()
      await waitFor(() => expect(result.current.recurringPayments).toHaveLength(1))

      act(() => {
        result.current.handleUpdateReminder('rp-1', { enabled: true, mode: 'Once', leadDays: 0 })
      })
      await waitFor(() => expect(result.current.allRecurringPayments[0].reminderEnabled).toBe(true))

      expect(result.current.pendingOps).toEqual([expect.objectContaining({
        entity: 'recurringPayment',
        type: 'reminder',
        targetId: 'rp-1',
        payload: expect.objectContaining({ reminderEnabled: true, reminderMode: 'Once', reminderLeadDays: 0 }),
      })])
      expect(updateReminder).not.toHaveBeenCalled()
    } finally {
      Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: originalOnline })
    }
  })

  it('queues pay-early with an optimistic ledger row while offline', async () => {
    mockHappyApi()
    vi.spyOn(api, 'pingServer').mockResolvedValue({ status: 'ok' } as any)
    const payEarly = vi.spyOn(api, 'payRecurringPaymentEarly').mockResolvedValue({
      transaction: { id: 'tx-server', date: '2026-08-02', description: 'Streaming', category: 'Entertainment', ledgerCategory: 'Needs', amount: -50, recurringPaymentId: 'rp-1', recurringOccurrenceDate: '2026-08-01' },
      settledOccurrenceDate: '2026-08-01',
      nextOccurrenceDate: '2026-09-01',
    })
    const originalOnline = navigator.onLine
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: false })

    try {
      const { result } = renderFinancialData()
      await waitFor(() => expect(result.current.recurringPayments).toHaveLength(1))

      act(() => {
        result.current.handlePayEarly('rp-1')
      })

      await waitFor(() => expect(result.current.pendingOps).toEqual([expect.objectContaining({
        entity: 'recurringPayment',
        type: 'payEarly',
        targetId: 'rp-1',
      })]))
      expect(result.current.allTransactions).toEqual([expect.objectContaining({
        description: 'Streaming',
        recurringPaymentId: 'rp-1',
        recurringOccurrenceDate: '2026-08-01',
        amount: -50,
        isPendingSync: true,
      })])
      expect(payEarly).not.toHaveBeenCalled()
    } finally {
      Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: originalOnline })
    }
  })
})
