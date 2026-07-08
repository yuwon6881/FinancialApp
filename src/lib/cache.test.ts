import { afterEach, describe, expect, it } from 'vitest'
import { CACHE_KEYS, getCachedDashboardData, getCachedDashboardPeriod, hasCachedDashboardData, setCachedJSON } from './cache'
import type { DashboardData } from '../types'

const dashboard: DashboardData = {
  setting: {
    targetStabilityFund: 10000,
    selectedMonth: 'Jul',
    selectedYear: 2026,
    essentialsAlloc: 0.5,
    growthAlloc: 0.25,
    stabilityAlloc: 0.15,
    rewardsAlloc: 0.1,
    cycleDay: 28,
    darkMode: true,
    hideSensitive: true,
    currency: 'USD',
  },
  cycleLabel: 'Jul 2026',
  categories: [],
  stats: {
    totalBalance: 123,
    monthlyIncome: 0,
    monthlyInflow: 0,
    monthlyExpenses: 0,
    activeRecurringTotal: 0,
    growthPercentAchieved: 0,
    essentialsPercentRemaining: 0,
    stabilityPercentReached: 0,
    pastThreeMonthsRewardsAverage: 0,
    hasRewardsHistory: false,
  },
  recentTransactions: [],
  activeRecurringPayments: [],
  trendPoints: [],
  last3TrendPoints: [],
  last6TrendPoints: [],
  pendingNotifications: [],
  monthlyCategoryBreakdown: [],
  last3CategoryBreakdown: [],
  last6CategoryBreakdown: [],
  yearlyCategoryBreakdown: [],
}

afterEach(() => {
  localStorage.clear()
})

describe('dashboard cache validation', () => {
  it('does not treat a stored null dashboard as cached data', () => {
    setCachedJSON(CACHE_KEYS.dashboardData, null)

    expect(hasCachedDashboardData()).toBe(false)
    expect(getCachedDashboardData()).toBeNull()
    expect(getCachedDashboardPeriod()).toEqual({})
  })

  it('does not treat malformed dashboard data as cached data', () => {
    setCachedJSON(CACHE_KEYS.dashboardData, { setting: { selectedMonth: '', selectedYear: '2026' } })

    expect(hasCachedDashboardData()).toBe(false)
    expect(getCachedDashboardData()).toBeNull()
  })

  it('returns valid cached dashboard data and its selected period', () => {
    setCachedJSON(CACHE_KEYS.dashboardData, dashboard)

    expect(hasCachedDashboardData()).toBe(true)
    expect(getCachedDashboardData()).toEqual(dashboard)
    expect(getCachedDashboardPeriod()).toEqual({ month: 'Jul', year: 2026 })
  })
})
