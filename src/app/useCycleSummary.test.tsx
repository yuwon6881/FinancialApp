import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { DashboardData } from '../types'
import { useCycleSummary } from './useCycleSummary'

const { fetchDashboard, fetchTransactions } = vi.hoisted(() => ({
  fetchDashboard: vi.fn((_args?: unknown) => new Promise<never>(() => {})),
  fetchTransactions: vi.fn(),
}))
vi.mock('../lib/api', () => ({
  fetchDashboard,
  fetchTransactions,
}))

const dashboard = (): DashboardData => ({
  setting: {
    selectedMonth: 'Aug', selectedYear: 2026, cycleDay: 1, currency: 'MYR',
    essentialsAlloc: .5, growthAlloc: .2, stabilityAlloc: .2, rewardsAlloc: .1,
    targetStabilityFund: 1000, darkMode: false, hideSensitive: false, lastSummaryCycleSeen: null,
  },
  cycleLabel: 'Aug 01 ~ Aug 31, 2026', categories: [], activeRecurringPayments: [],
  pendingNotifications: [], trendPoints: [], last3TrendPoints: [], last6TrendPoints: [],
  monthlyCategoryBreakdown: [], last3CategoryBreakdown: [], last6CategoryBreakdown: [],
  yearlyCategoryBreakdown: [], availableYears: [],
  stats: {
    totalBalance: 0, monthlyIncome: 0, monthlyInflow: 0, monthlyExpenses: 0,
    activeRecurringTotal: 0, growthPercentAchieved: 0, stabilityPercentReached: 0,
    pastThreeMonthsRewardsAverage: 0, hasRewardsHistory: false,
  },
  cycleSummaryInsights: {
    cycleLengthDays: 31, noSpendDays: 31, transactionCount: 0,
    committedSpend: 0, discretionarySpend: 0,
  },
} as DashboardData)

describe('useCycleSummary', () => {
  it('does not restart requests or hide selected-cycle data when optimistic state changes identity', async () => {
    fetchDashboard.mockClear()
    fetchTransactions.mockClear()
    const initial = dashboard()
    const { result, rerender } = renderHook(
      ({ optimistic }) => useCycleSummary({
        token: 'token', dashboardData: initial, optimisticDashboardData: optimistic,
        selectedTransactions: [], onMarkSummarySeen: vi.fn(),
      }),
      { initialProps: { optimistic: initial } },
    )

    act(() => result.current.openManual(8, 2026))
    await waitFor(() => expect(fetchDashboard).toHaveBeenCalledTimes(1))
    expect(result.current.data).toBe(initial)
    expect(result.current.isLoading).toBe(false)

    const refreshed = { ...initial, stats: { ...initial.stats, totalBalance: 10 } }
    rerender({ optimistic: refreshed })

    expect(fetchDashboard).toHaveBeenCalledTimes(1)
    expect(fetchTransactions).not.toHaveBeenCalled()
    expect(result.current.data).toBe(refreshed)
    expect(result.current.isLoading).toBe(false)
  })
})
