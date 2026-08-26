import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { queuedTransactionDeleteCoversTarget, useFinancialData } from './useFinancialData'
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
  accountId: 'acct-essentials',
  nextDueDate: '2026-08-01',
  dueDate: 1,
  startDate: '2026-01-01',
  active: true,
  paymentMode: 'Manual',
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
const mountedFinancialDataHooks = new Set<() => void>()

function renderFinancialData(guardSensitive: () => boolean = () => true) {
  // Every option must be stable across renders -- an inline literal or `vi.fn()` here
  // would churn `loadAll`'s identity by itself and mask the churn these tests pin.
  const setDarkMode = vi.fn()
  const showToast = vi.fn()
  const setConfirmModalData = vi.fn()
  const options = {
    token: 'token-1',
    username: 'test-user',
    lastUnlockedTimeRef: { current: 0 },
    isLocked: false,
    markSessionLocked,
    handleLogout,
    hideSensitive: false,
    darkMode: false,
    showToast,
    guardSensitive,
    setConfirmModalData,
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
  const rendered = renderHook(() => useFinancialData(options as any))
  mountedFinancialDataHooks.add(rendered.unmount)
  return { ...rendered, setDarkMode, showToast, setConfirmModalData }
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
    for (const unmount of mountedFinancialDataHooks) unmount()
    mountedFinancialDataHooks.clear()
    vi.restoreAllMocks()
  })

  it('recognizes both single and bulk queued transaction deletes before document upload', () => {
    expect(queuedTransactionDeleteCoversTarget({ entity: 'transaction', type: 'delete', targetId: 'tx-1' }, 'tx-1')).toBe(true)
    expect(queuedTransactionDeleteCoversTarget({
      entity: 'transaction',
      type: 'bulkDelete',
      targetId: 'bulk-1',
      payload: { transactionIds: ['tx-1', 'tx-2'] },
    }, 'tx-2')).toBe(true)
    expect(queuedTransactionDeleteCoversTarget({
      entity: 'transaction',
      type: 'bulkDelete',
      targetId: 'bulk-1',
      payload: { transactionIds: ['tx-1'] },
    }, 'tx-2')).toBe(false)
  })

  it('blocks financial mutation handlers at execution time in sensitive mode', async () => {
    mockHappyApi()
    const guardSensitive = vi.fn(() => false)
    const { result } = renderFinancialData(guardSensitive)
    await waitFor(() => expect(api.fetchBootstrap).toHaveBeenCalled())

    act(() => {
      expect(result.current.handleStageDraftTransactions([{} as any])).toEqual([])
      result.current.handleDeleteDraftTransaction('draft-1')
      result.current.handleSyncDraftBatch()
      result.current.handleAddPayment({} as any)
      result.current.handleDeletePayment('rp-1')
      result.current.handleUpdateSettings({} as any)
      result.current.handleDeleteCategory('category-1')
    })

    expect(result.current.pendingOps).toHaveLength(0)
    expect(result.current.draftTransactions).toHaveLength(0)
    expect(guardSensitive).toHaveBeenCalledTimes(7)
  })

  it('restores a deleted draft at its original position through toast Undo', async () => {
    const drafts = [
      { id: 'draft-1', description: 'First', amount: -10, date: '2026-07-01', category: 'Other', ledgerCategory: 'Needs', isPendingSync: true },
      { id: 'draft-2', description: 'Second', amount: -20, date: '2026-07-02', category: 'Other', ledgerCategory: 'Needs', isPendingSync: true },
    ]
    localStorage.setItem('draft_transactions', JSON.stringify(drafts))
    mockHappyApi()
    const { result, showToast } = renderFinancialData()
    await waitFor(() => expect(result.current.draftTransactions.map(item => item.id)).toEqual(['draft-1', 'draft-2']))

    await act(async () => { await result.current.handleDeleteDraftTransaction('draft-1') })
    expect(result.current.draftTransactions.map(item => item.id)).toEqual(['draft-2'])
    const undo = showToast.mock.calls.at(-1)?.[3]
    expect(undo?.label).toBe('Undo')

    await act(async () => { undo.onAction(); await Promise.resolve() })
    await waitFor(() => expect(result.current.draftTransactions.map(item => item.id)).toEqual(['draft-1', 'draft-2']))
  })

  it('queues top drafts first and reverses them in same-day newest-first Ledger timestamps', async () => {
    const drafts = [
      {
        id: 'draft-groceries',
        description: 'Groceries',
        amount: -80,
        date: '2026-07-13',
        category: 'Transport',
        ledgerCategory: 'Essentials',
        accountId: 'acct-essentials',
        stabilityReloadIntent: 'NotRequired',
        isPendingSync: true,
      },
      {
        id: 'draft-fuel',
        description: 'Car Fuel',
        amount: -30,
        date: '2026-07-13',
        category: 'Transport',
        ledgerCategory: 'Essentials',
        accountId: 'acct-essentials',
        stabilityReloadIntent: 'NotRequired',
        isPendingSync: true,
      },
    ]
    localStorage.setItem('draft_transactions', JSON.stringify(drafts))
    mockHappyApi()
    vi.spyOn(api, 'addTransaction').mockReturnValue(new Promise(() => undefined) as any)
    vi.mocked(api.fetchBootstrap).mockResolvedValue({
      month: 'July',
      year: 2026,
      dashboard,
      insights,
      transactions: [],
      recurringPayments: [],
      categories: [{ id: 'transport', name: 'Transport', type: 'outflow' }],
      wishlist: [],
      autocomplete: [],
      walletBalance: 100,
    } as any)
    const { result } = renderFinancialData()
    await waitFor(() => expect(result.current.allCategories).toHaveLength(1))

    await act(async () => {
      await result.current.handleSyncDraftBatch()
    })

    expect(result.current.pendingOps.map(operation => operation.payload?.description)).toEqual([
      'Groceries',
      'Car Fuel',
    ])
    const postedAt = result.current.pendingOps.map(operation => Date.parse(String(operation.payload?.postedAt)))
    expect(postedAt[0]).toBeLessThan(postedAt[1])
  })

  it('starts with bootstrap directly and does not restart startup when the outbox queue changes', async () => {
    mockHappyApi()

    const { result } = renderFinancialData()
    await waitFor(() => expect(api.fetchBootstrap).toHaveBeenCalledTimes(1))

    act(() => {
      result.current.mutateQueue(prev => [...prev])
    })
    // The queue really did change identity -- that is what used to churn `loadAll`. Keep it
    // empty so this assertion cannot confuse a legitimate post-dispatch refresh with startup.
    expect(result.current.pendingOps).toHaveLength(0)
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)) })

    expect(api.fetchBootstrap).toHaveBeenCalledTimes(1)
  })

  it('does not let a late startup response roll back a newly selected theme', async () => {
    let resolveBootstrap: (value: unknown) => void = () => undefined
    vi.spyOn(api, 'fetchBootstrap').mockReturnValue(new Promise(resolve => {
      resolveBootstrap = resolve
    }) as any)
    vi.spyOn(api, 'updateDarkMode').mockReturnValue(new Promise(() => undefined) as any)

    const { result, setDarkMode } = renderFinancialData()
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
    vi.spyOn(api, 'updateDarkMode').mockResolvedValue(undefined as any)

    const { result, setDarkMode } = renderFinancialData()
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
    vi.spyOn(api, 'fetchBootstrap').mockRejectedValue(new ApiErrorLike('Request failed', 401))

    renderFinancialData()

    await waitFor(() => expect(handleLogout).toHaveBeenCalled())
    expect(markSensitivePreferenceUnavailable).not.toHaveBeenCalled()
  })

  it('locks the session on a status-coded 423 that has no "423" in its message', async () => {
    mockHappyApi()
    vi.spyOn(api, 'fetchBootstrap').mockRejectedValue(new ApiErrorLike('Request failed', 423))

    renderFinancialData()

    await waitFor(() => expect(markSessionLocked).toHaveBeenCalled())
    expect(handleLogout).not.toHaveBeenCalled()
  })

  it('queues reminder updates and projects them while offline', async () => {
    mockHappyApi()
    const updateReminder = vi.spyOn(api, 'updateRecurringPaymentReminder').mockResolvedValue(undefined)

    const originalOnline = navigator.onLine

    try {
      const { result } = renderFinancialData()
      await waitFor(() => expect(result.current.recurringPayments).toHaveLength(1))
      Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: false })
      act(() => window.dispatchEvent(new Event('offline')))

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
    const settleOccurrence = vi.spyOn(api, 'settleRecurringOccurrence').mockResolvedValue({
      occurrence: {} as never,
      transaction: { id: 'tx-server', date: '2026-08-02', description: 'Streaming', category: 'Entertainment', ledgerCategory: 'Needs', amount: -50, recurringPaymentId: 'rp-1', recurringOccurrenceDate: '2026-08-01' },
      nextOccurrenceDate: '2026-09-01',
    })
    const originalOnline = navigator.onLine

    try {
      const { result } = renderFinancialData()
      await waitFor(() => expect(result.current.recurringPayments).toHaveLength(1))
      Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: false })
      act(() => window.dispatchEvent(new Event('offline')))

      act(() => {
        result.current.handlePayEarly('rp-1')
      })

      await waitFor(() => expect(result.current.pendingOps).toEqual([expect.objectContaining({
        entity: 'recurringOccurrence',
        type: 'settle',
        targetId: 'rp-1:2026-08-01',
      })]))
      expect(result.current.allTransactions).toEqual([expect.objectContaining({
        description: 'Streaming',
        recurringPaymentId: 'rp-1',
        recurringOccurrenceDate: '2026-08-01',
        amount: -50,
        isPendingSync: true,
      })])
      expect(settleOccurrence).not.toHaveBeenCalled()
    } finally {
      Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: originalOnline })
    }
  })
// The server retires a spending guide as part of the same write that restricts a category to
  // money in, so the projection has to say so too — otherwise the limit stays on screen with
  // nothing watching it, and a queued limit edit folded into this op is refused outright.
  it('drops a spending guide when a category is restricted to money in', async () => {
    mockHappyApi()
    vi.spyOn(api, 'fetchCategories').mockResolvedValue([
      { id: 'cat-1', name: 'Food', type: 'outflow', cycleLimit: 250 },
    ] as any)
    vi.spyOn(api, 'fetchBootstrap').mockResolvedValue({
      month: 'July',
      year: 2026,
      dashboard,
      insights,
      transactions: [],
      recurringPayments: [],
      categories: [{ id: 'cat-1', name: 'Food', type: 'outflow', cycleLimit: 250 }],
      wishlist: [],
      autocomplete: [],
      walletBalance: 100,
    } as any)

    const originalOnline = navigator.onLine
    try {
      const { result } = renderFinancialData()
      await waitFor(() => expect(result.current.allCategories).toHaveLength(1))
      Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: false })
      act(() => window.dispatchEvent(new Event('offline')))

      act(() => {
        result.current.handleUpdateCategoryType('cat-1', 'inflow')
      })

      await waitFor(() => expect(result.current.allCategories[0].cycleLimit).toBeNull())
      expect(result.current.pendingOps).toEqual([expect.objectContaining({
        entity: 'category',
        type: 'update',
        targetId: 'cat-1',
        payload: expect.objectContaining({ type: 'inflow', cycleLimit: null }),
      })])
    } finally {
      Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: originalOnline })
    }
  })
})
