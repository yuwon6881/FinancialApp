import type { DashboardCore, DashboardInsights } from '../../types'
import type {
  WireActiveRecurringPayment,
  WireCategoryBreakdown,
  WireCategorySummary,
  WireDashboardData,
  WireDashboardInsights,
  WirePendingNotification,
  WireTrendPoint,
} from '../apiTypes'
import { deobfuscateAmount, obfuscateAmount } from './amounts'
import { cachedGet, invalidateCache, jsonBody, request, requestVoid } from './client'

export function fetchDashboard(month?: string, year?: number, signal?: AbortSignal): Promise<DashboardCore> {
  const params = new URLSearchParams()
  if (month) params.append('month', month)
  if (year) params.append('year', year.toString())
  const query = params.size ? `?${params}` : ''

  return cachedGet(`dashboard:${month || ''}:${year || ''}`, async () => {
    const data = await request<WireDashboardData>(`/financial/dashboard${query}`, {
      errorMessage: 'Failed to fetch dashboard data',
    })
    return {
      ...data,
      setting: {
        ...data.setting,
        targetStabilityFund: deobfuscateAmount(data.setting.targetStabilityFund),
      },
      categories: (data.categories || []).map((category: WireCategorySummary) => ({
        ...category,
        target: deobfuscateAmount(category.target),
        budget: deobfuscateAmount(category.budget),
        netChange: deobfuscateAmount(category.netChange),
        remaining: deobfuscateAmount(category.remaining),
      })),
      stats: {
        ...data.stats,
        totalBalance: deobfuscateAmount(data.stats.totalBalance),
        monthlyIncome: deobfuscateAmount(data.stats.monthlyIncome),
        monthlyInflow: deobfuscateAmount(data.stats.monthlyInflow),
        monthlyExpenses: deobfuscateAmount(data.stats.monthlyExpenses),
        activeRecurringTotal: deobfuscateAmount(data.stats.activeRecurringTotal),
      },
      activeRecurringPayments: (data.activeRecurringPayments || []).map((payment: WireActiveRecurringPayment) => ({
        ...payment,
        amount: deobfuscateAmount(payment.amount),
      })),
      trendPoints: (data.trendPoints || []).map((point: WireTrendPoint) => ({
        ...point,
        balance: deobfuscateAmount(point.balance),
      })),
      last3TrendPoints: (data.last3TrendPoints || []).map((point: WireTrendPoint) => ({
        ...point,
        balance: deobfuscateAmount(point.balance),
      })),
      last6TrendPoints: (data.last6TrendPoints || []).map((point: WireTrendPoint) => ({
        ...point,
        balance: deobfuscateAmount(point.balance),
      })),
      pendingNotifications: (data.pendingNotifications || []).map((notification: WirePendingNotification) => ({
        ...notification,
        amount: deobfuscateAmount(notification.amount),
      })),
      monthlyCategoryBreakdown: (data.monthlyCategoryBreakdown || []).map((category: WireCategoryBreakdown) => ({
        ...category,
        amount: deobfuscateAmount(category.amount),
      })),
    }
  }, { signal })
}

export function fetchDashboardInsights(month?: string, year?: number, signal?: AbortSignal): Promise<DashboardInsights> {
  const params = new URLSearchParams()
  if (month) params.append('month', month)
  if (year) params.append('year', year.toString())
  const query = params.size ? `?${params}` : ''

  return cachedGet(`dashboard-insights:${month || ''}:${year || ''}`, async () => {
    const data = await request<WireDashboardInsights>(`/financial/dashboard/insights${query}`, {
      errorMessage: 'Failed to fetch dashboard insights',
    })
    const mapBreakdown = (items: WireCategoryBreakdown[]) => (items || []).map(item => ({
      ...item,
      amount: deobfuscateAmount(item.amount),
    }))
    return {
      last3CategoryBreakdown: mapBreakdown(data.last3CategoryBreakdown),
      last6CategoryBreakdown: mapBreakdown(data.last6CategoryBreakdown),
      yearlyCategoryBreakdown: mapBreakdown(data.yearlyCategoryBreakdown),
      pastThreeMonthsRewardsAverage: deobfuscateAmount(data.pastThreeMonthsRewardsAverage),
      hasRewardsHistory: data.hasRewardsHistory,
      availableYears: data.availableYears || [new Date().getFullYear()],
    }
  }, { signal })
}

export async function fetchWalletBalance(signal?: AbortSignal): Promise<number> {
  const data = await request<{ totalBalance: string | number }>('/financial/wallet-balance', {
    signal,
    errorMessage: 'Failed to fetch wallet balance',
  })
  return deobfuscateAmount(data.totalBalance)
}

export async function updateSettings(settings: {
  targetStabilityFund: number
  essentialsAlloc: number
  growthAlloc: number
  stabilityAlloc: number
  rewardsAlloc: number
  cycleDay: number
  darkMode?: boolean | null
  hideSensitive?: boolean
  currency?: string
  stabilityOverflowRedirect?: string
}): Promise<void> {
  await requestVoid('/financial/settings', {
    method: 'PUT',
    ...jsonBody({ ...settings, targetStabilityFund: obfuscateAmount(settings.targetStabilityFund) }),
    errorMessage: 'Failed to update financial settings',
  })
  invalidateCache()
}

export async function updateDarkMode(darkMode: boolean): Promise<void> {
  await requestVoid('/financial/dark-mode', {
    method: 'PUT',
    ...jsonBody({ darkMode }),
    errorMessage: 'Failed to persist dark mode preference',
  })
  invalidateCache()
}

export async function updateHideSensitive(hideSensitive: boolean): Promise<void> {
  await requestVoid('/financial/hide-sensitive', {
    method: 'PUT',
    ...jsonBody({ hideSensitive }),
    errorMessage: 'Failed to persist hide sensitive preference',
  })
  invalidateCache()
}

// Persist which cycle the user has acknowledged an end-of-cycle summary for. A null/empty
// key clears the marker. Mirrors the dark-mode/hide-sensitive lightweight preference writers.
export async function updateSummarySeen(cycleKey: string | null): Promise<void> {
  await requestVoid('/financial/summary-seen', {
    method: 'PUT',
    ...jsonBody({ cycleKey }),
    errorMessage: 'Failed to persist end-of-cycle summary state',
  })
  invalidateCache()
}

export async function selectPeriod(selectedMonth: string, selectedYear: number): Promise<void> {
  await requestVoid('/financial/select-period', {
    method: 'POST',
    ...jsonBody({ selectedMonth, selectedYear }),
    errorMessage: 'Failed to select active period',
  })
  invalidateCache()
}
