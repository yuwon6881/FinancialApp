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
    setDarkMode: vi.fn(),
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

  it('logs out on a status-coded 401 that has no "401" in its message', async () => {
    mockHappyApi()
    vi.spyOn(api, 'pingServer').mockResolvedValue({ status: 'ok' } as any)
    vi.spyOn(api, 'fetchDashboard').mockRejectedValue(new ApiErrorLike('Request failed', 401))

    renderFinancialData()

    await waitFor(() => expect(handleLogout).toHaveBeenCalled())
    expect(markSensitivePreferenceUnavailable).not.toHaveBeenCalled()
  })

  it('locks the session on a status-coded 423 that has no "423" in its message', async () => {
    mockHappyApi()
    vi.spyOn(api, 'pingServer').mockResolvedValue({ status: 'ok' } as any)
    vi.spyOn(api, 'fetchDashboard').mockRejectedValue(new ApiErrorLike('Request failed', 423))

    renderFinancialData()

    await waitFor(() => expect(markSessionLocked).toHaveBeenCalled())
    expect(handleLogout).not.toHaveBeenCalled()
  })

  it('rolls back only the reminder fields when the reminder update fails', async () => {
    mockHappyApi()
    vi.spyOn(api, 'pingServer').mockResolvedValue({ status: 'ok' } as any)

    let rejectUpdate: (err: unknown) => void = () => undefined
    vi.spyOn(api, 'updateRecurringPaymentReminder').mockReturnValue(
      new Promise((_resolve, reject) => { rejectUpdate = reject }) as any)

    const { result } = renderFinancialData()
    await waitFor(() => expect(result.current.recurringPayments).toHaveLength(1))

    let pending: Promise<void> = Promise.resolve()
    act(() => {
      pending = result.current.handleUpdateReminder('rp-1', { enabled: true, mode: 'Once', leadDays: 0 })
    })
    await waitFor(() => expect(result.current.recurringPayments[0].reminderEnabled).toBe(true))

    // A concurrent refresh lands while the request is still in flight.
    vi.mocked(api.fetchRecurringPayments).mockResolvedValue([{ ...payment, amount: 99, reminderEnabled: true }])
    await act(async () => { await result.current.loadAll('July', 2026, true) })
    expect(result.current.recurringPayments[0].amount).toBe(99)

    await act(async () => {
      rejectUpdate(new Error('nope'))
      await pending
    })

    expect(result.current.recurringPayments[0].reminderEnabled).toBe(false)
    // The concurrently-refreshed field must survive the rollback.
    expect(result.current.recurringPayments[0].amount).toBe(99)
  })
})
