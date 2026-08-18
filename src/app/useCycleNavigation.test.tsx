import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../lib/api'
import { useCycleNavigation } from './useCycleNavigation'

vi.mock('../lib/api', () => ({ selectPeriod: vi.fn() }))
vi.mock('../lib/cache', () => ({
  getCachedDashboardPeriod: () => ({ month: 'Jun', year: 2026 }),
  getCachedCycleSnapshot: () => null,
}))

describe('useCycleNavigation', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/')
    vi.clearAllMocks()
  })

  it('invalidates the older cycle load as soon as a newer cycle is selected', async () => {
    const loadResolvers: Array<() => void> = []
    const committedCycles: string[] = []
    const loadAll = vi.fn((month?: string, _year?: number, _background?: boolean, shouldCommit?: () => boolean) => (
      new Promise<void>(resolve => loadResolvers.push(() => {
        if (shouldCommit?.() !== false && month) committedCycles.push(month)
        resolve()
      }))
    ))
    vi.mocked(api.selectPeriod).mockResolvedValue(undefined)
    const { result } = renderHook(() => useCycleNavigation({
      loadAll,
      handleLogout: vi.fn(),
      markSessionLocked: vi.fn(),
      setDashboardData: vi.fn(),
      setTransactions: vi.fn(),
      setActiveTab: vi.fn(),
      setLedgerCyclesRange: vi.fn(),
    }))

    let firstSwitch!: Promise<void>
    await act(async () => {
      firstSwitch = result.current.handleSelectPeriod('Jul', 2026)
      await Promise.resolve()
    })
    expect(loadAll).toHaveBeenCalledTimes(1)

    let secondSwitch!: Promise<void>
    await act(async () => {
      secondSwitch = result.current.handleSelectPeriod('Aug', 2026)
      await Promise.resolve()
    })
    expect(loadAll).toHaveBeenCalledTimes(2)

    const firstCommitGuard = loadAll.mock.calls[0][3]
    const secondCommitGuard = loadAll.mock.calls[1][3]
    expect(firstCommitGuard?.()).toBe(false)
    expect(secondCommitGuard?.()).toBe(true)

    await act(async () => {
      loadResolvers.forEach(resolve => resolve())
      await Promise.all([firstSwitch, secondSwitch])
    })
    expect(committedCycles).toEqual(['Aug'])
  })

  it('switches to a claimed transaction cycle before opening and highlighting the ledger', async () => {
    vi.mocked(api.selectPeriod).mockResolvedValue(undefined)
    const loadAll = vi.fn().mockResolvedValue(undefined)
    const setActiveTab = vi.fn()
    const setLedgerCyclesRange = vi.fn()
    const { result } = renderHook(() => useCycleNavigation({
      loadAll,
      handleLogout: vi.fn(),
      markSessionLocked: vi.fn(),
      setDashboardData: vi.fn(),
      setTransactions: vi.fn(),
      setActiveTab,
      setLedgerCyclesRange,
    }))

    await act(async () => {
      result.current.handleNavigateToLedger({
        highlightedTxId: 'wishlist-tx-1',
        targetMonth: 'Jan',
        targetYear: 2026,
        range: 'monthly',
        showAllCycles: false,
      })
      await Promise.resolve()
    })

    expect(api.selectPeriod).toHaveBeenCalledWith('Jan', 2026)
    expect(setLedgerCyclesRange).toHaveBeenCalledWith('monthly')
    expect(setActiveTab).toHaveBeenCalledWith('ledger', expect.objectContaining({
      search: expect.objectContaining({ tx: 'wishlist-tx-1', all: null, range: null }),
    }))
    expect(result.current.highlightedTxId).toBe('wishlist-tx-1')
    expect(result.current.ledgerShowAllCycles).toBe(false)
  })

  it('persists cycle selection through the injected mutation queue', async () => {
    const persistPeriod = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useCycleNavigation({
      loadAll: vi.fn().mockResolvedValue(undefined),
      handleLogout: vi.fn(),
      markSessionLocked: vi.fn(),
      setDashboardData: vi.fn(),
      setTransactions: vi.fn(),
      setActiveTab: vi.fn(),
      setLedgerCyclesRange: vi.fn(),
      persistPeriod,
    }))

    await act(async () => result.current.handleSelectPeriod('Sep', 2026))

    expect(persistPeriod).toHaveBeenCalledWith('Sep', 2026)
    expect(api.selectPeriod).not.toHaveBeenCalled()
  })

  it('retains the applied Ledger route state for a later remount', () => {
    const setLedgerCyclesRange = vi.fn()
    const { result } = renderHook(() => useCycleNavigation({
      loadAll: vi.fn(),
      handleLogout: vi.fn(),
      markSessionLocked: vi.fn(),
      setDashboardData: vi.fn(),
      setTransactions: vi.fn(),
      setActiveTab: vi.fn(),
      setLedgerCyclesRange,
    }))

    act(() => result.current.syncLedgerRouteState({
      filters: ['Stability'],
      search: '',
      startDate: '2026-08-09',
      endDate: '2026-08-11',
      minAmount: '',
      maxAmount: '',
      recurringFilter: 'all',
      wishlistFilter: 'all',
      txType: null,
      showAllCycles: true,
      range: 'yearly',
    }))

    expect(result.current.ledgerIncomingFilters).toEqual(['Stability'])
    expect(result.current.ledgerIncomingStartDate).toBe('2026-08-09')
    expect(result.current.ledgerIncomingEndDate).toBe('2026-08-11')
    expect(result.current.ledgerShowAllCycles).toBe(true)
    expect(setLedgerCyclesRange).toHaveBeenLastCalledWith('yearly')
  })

  it('navigates to recurring loans tab with highlighted loan id', async () => {
    const setActiveTab = vi.fn()
    const { result } = renderHook(() => useCycleNavigation({
      loadAll: vi.fn(),
      handleLogout: vi.fn(),
      markSessionLocked: vi.fn(),
      setDashboardData: vi.fn(),
      setTransactions: vi.fn(),
      setActiveTab,
      setLedgerCyclesRange: vi.fn(),
    }))

    act(() => result.current.handleNavigateToLoan('loan-123'))

    expect(setActiveTab).toHaveBeenCalledWith('recurring', expect.objectContaining({
      search: { loan: 'loan-123', subscription: null },
    }))
    expect(result.current.highlightedLoanId).toBe('loan-123')

    act(() => result.current.clearHighlightedLoan())
    expect(result.current.highlightedLoanId).toBeNull()
  })
})
