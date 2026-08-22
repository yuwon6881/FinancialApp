import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCurrentCycleDashboard } from './useCurrentCycleDashboard'
import * as api from '../lib/api'
import * as cache from '../lib/cache'
import { getCurrentCycleYearAndMonth, MONTH_NAMES } from '../lib/cycle'
import type { DashboardData } from '../types'

const CYCLE_DAY = 28
const current = getCurrentCycleYearAndMonth(CYCLE_DAY)
const currentMonth = MONTH_NAMES[current.monthIndex - 1]
// A cycle the user could have navigated to that is never the current one, whatever today's date is.
const pastMonth = MONTH_NAMES[(current.monthIndex + 5) % 12]
const pastYear = current.year - 1

// Only the fields this hook reads or merges; the rest of DashboardData is irrelevant here.
const dashboardFor = (month: string, year: number, rewardsBalance = 0): DashboardData => ({
  setting: { cycleDay: CYCLE_DAY, selectedMonth: month, selectedYear: year },
  stats: { rewardsBalance },
} as unknown as DashboardData)

const insightsResponse = {
  last3CategoryBreakdown: [],
  last6CategoryBreakdown: [],
  yearlyCategoryBreakdown: [],
  availableYears: [current.year],
  pastThreeMonthsRewardsAverage: 0,
  hasRewardsHistory: false,
}

let fetchDashboard: ReturnType<typeof vi.spyOn>
let fetchDashboardInsights: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  fetchDashboard = vi.spyOn(api, 'fetchDashboard')
    .mockResolvedValue(dashboardFor(currentMonth, current.year, 500) as never)
  fetchDashboardInsights = vi.spyOn(api, 'fetchDashboardInsights')
    .mockResolvedValue(insightsResponse as never)
  vi.spyOn(cache, 'getCachedCycleSnapshot').mockReturnValue(null)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useCurrentCycleDashboard', () => {
  it('reads the shared optimistic data without a request when the selected cycle is current', async () => {
    const optimistic = dashboardFor(currentMonth, current.year)
    const { result } = renderHook(() => useCurrentCycleDashboard({
      token: 'token',
      optimisticDashboardData: optimistic,
      hasQueuedWrites: false,
    }))

    await waitFor(() => expect(result.current.todayDashboardData).toBe(optimistic))
    expect(fetchDashboard).not.toHaveBeenCalled()
    expect(fetchDashboardInsights).not.toHaveBeenCalled()
    expect(result.current.isCurrentCycle).toBe(true)
    expect(result.current.isCurrentCycleLoading).toBe(false)
  })

  it('fetches the current cycle once while another cycle is selected, not per optimistic re-projection', async () => {
    const { result, rerender } = renderHook(
      (props: { data: DashboardData }) => useCurrentCycleDashboard({
        token: 'token',
        optimisticDashboardData: props.data,
        hasQueuedWrites: false,
      }),
      { initialProps: { data: dashboardFor(pastMonth, pastYear) } },
    )

    await waitFor(() => expect(result.current.todayDashboardData).not.toBeNull())
    expect(result.current.isCurrentCycle).toBe(false)
    expect(fetchDashboard).toHaveBeenCalledTimes(1)
    expect(fetchDashboard).toHaveBeenCalledWith(currentMonth, current.year, expect.anything(), false)

    // computeOptimisticDashboard mints a new object on every queued op, completion, and
    // completed-op expiry. None of those change which cycle Today needs, so none may re-fetch.
    rerender({ data: dashboardFor(pastMonth, pastYear) })
    rerender({ data: dashboardFor(pastMonth, pastYear) })

    expect(fetchDashboard).toHaveBeenCalledTimes(1)
    expect(fetchDashboardInsights).toHaveBeenCalledTimes(1)
  })

  it('waits for the queue to settle before refetching, then refetches once it does', async () => {
    const { result, rerender } = renderHook(
      (props: { queued: boolean }) => useCurrentCycleDashboard({
        token: 'token',
        optimisticDashboardData: dashboardFor(pastMonth, pastYear),
        hasQueuedWrites: props.queued,
      }),
      { initialProps: { queued: false } },
    )

    await waitFor(() => expect(result.current.todayDashboardData).not.toBeNull())
    expect(fetchDashboard).toHaveBeenCalledTimes(1)

    // A write is queued but has not reached the server. Fetching now would commit pre-write
    // figures onto a copy that carries no optimistic projection, then visibly jump.
    rerender({ queued: true })
    expect(fetchDashboard).toHaveBeenCalledTimes(1)
    expect(result.current.isCurrentCycleLoading).toBe(false)
    expect(result.current.isCurrentCycleStale).toBe(true)

    rerender({ queued: false })
    await waitFor(() => expect(fetchDashboard).toHaveBeenCalledTimes(2))
    expect(result.current.isCurrentCycleStale).toBe(false)
  })

  it('still fetches with writes queued when there is nothing to show yet', async () => {
    const { result } = renderHook(() => useCurrentCycleDashboard({
      token: 'token',
      optimisticDashboardData: dashboardFor(pastMonth, pastYear),
      hasQueuedWrites: true,
    }))

    // Stale beats an indefinite skeleton: the drain's own refresh corrects it moments later.
    expect(fetchDashboard).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(result.current.isCurrentCycleLoading).toBe(false))
    expect(result.current.todayDashboardData).not.toBeNull()
  })

  it('makes no request without a token', () => {
    renderHook(() => useCurrentCycleDashboard({
      token: null,
      optimisticDashboardData: dashboardFor(pastMonth, pastYear),
      hasQueuedWrites: false,
    }))

    expect(fetchDashboard).not.toHaveBeenCalled()
  })
})
