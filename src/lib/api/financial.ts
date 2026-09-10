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
import { deobfuscateActiveRecurringPayment, deobfuscateAmount, obfuscateAmount } from './amounts'
import { cachedGet, invalidateCache, jsonBody, request, requestVoid } from './client'

/** Optional insight money field: absent and null both mean "not known", never zero. */
const optionalInsightAmount = (value: string | number | null | undefined): number | undefined =>
  value == null ? undefined : deobfuscateAmount(value)

export function fetchDashboard(
  month?: string,
  year?: number,
  signal?: AbortSignal,
  persistSelection = true,
  summaryOnly = false,
): Promise<DashboardCore> {
  const params = new URLSearchParams()
  if (month) params.append('month', month)
  if (year) params.append('year', year.toString())
  if (!persistSelection) params.append('persistSelection', 'false')
  if (summaryOnly) params.append('summaryOnly', 'true')
  const query = params.size ? `?${params}` : ''

  return cachedGet(`dashboard:${month || ''}:${year || ''}:${persistSelection}:${summaryOnly}`, async () => {
    const data = await request<WireDashboardData>(`/financial/dashboard${query}`, {
      errorMessage: 'Failed to fetch dashboard data',
    })
    return mapDashboardCore(data, month, year)
  }, { signal })
}

/**
 * Wire -> domain mapping for the dashboard payload (mostly amount deobfuscation).
 *
 * Exported so /api/bootstrap can decode its embedded dashboard slice with exactly this
 * logic instead of a parallel copy; the bootstrap endpoint returns the same payload the
 * dashboard endpoint does, and this keeps that true on the client side too.
 */
export function mapDashboardCore(data: WireDashboardData, month?: string, year?: number): DashboardCore {
  return {
      ...data,
      setting: {
        ...data.setting,
        selectedMonth: month || data.setting.selectedMonth,
        selectedYear: year || data.setting.selectedYear,
        targetStabilityFund: deobfuscateAmount(data.setting.targetStabilityFund),
      },
      categories: (data.categories || []).map((category: WireCategorySummary) => ({
        ...category,
        target: deobfuscateAmount(category.target),
        incomeAllocated: deobfuscateAmount(category.incomeAllocated),
        budget: deobfuscateAmount(category.budget),
        netChange: deobfuscateAmount(category.netChange),
        spent: deobfuscateAmount(category.spent),
        remaining: deobfuscateAmount(category.remaining),
        accounts: (category.accounts || []).map(account => ({
          ...account,
          remaining: deobfuscateAmount(account.remaining),
        })),
      })),
      stats: {
        ...data.stats,
        totalBalance: deobfuscateAmount(data.stats.totalBalance),
        monthlyIncome: deobfuscateAmount(data.stats.monthlyIncome),
        monthlyInflow: deobfuscateAmount(data.stats.monthlyInflow),
        monthlyExpenses: deobfuscateAmount(data.stats.monthlyExpenses),
        activeRecurringTotal: deobfuscateAmount(data.stats.activeRecurringTotal),
      },
      activeRecurringPayments: (data.activeRecurringPayments || []).map(
        (payment: WireActiveRecurringPayment) => deobfuscateActiveRecurringPayment(payment),
      ),
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
      todayPlanInsights: {
        unpaidRecurringCount: data.todayPlanInsights?.unpaidRecurringCount || 0,
        unpaidRecurringTotal: deobfuscateAmount(data.todayPlanInsights?.unpaidRecurringTotal),
        unpaidEssentialsTotal: deobfuscateAmount(data.todayPlanInsights?.unpaidEssentialsTotal),
        nonRecurringEssentialsSpent: deobfuscateAmount(data.todayPlanInsights?.nonRecurringEssentialsSpent),
        nonRecurringEssentialsDailyAverage: deobfuscateAmount(data.todayPlanInsights?.nonRecurringEssentialsDailyAverage),
        projectedEssentialsEndingBalance: deobfuscateAmount(data.todayPlanInsights?.projectedEssentialsEndingBalance),
      },
      stabilityRecovery: data.stabilityRecovery
        ? {
          isActive: Boolean(data.stabilityRecovery.isActive),
          target: deobfuscateAmount(data.stabilityRecovery.target),
          currentBalance: deobfuscateAmount(data.stabilityRecovery.currentBalance),
          outstandingShortfall: deobfuscateAmount(data.stabilityRecovery.outstandingShortfall),
          openingOutstanding: data.stabilityRecovery.openingOutstanding == null
            ? undefined
            : deobfuscateAmount(data.stabilityRecovery.openingOutstanding),
          openingOldestDate: data.stabilityRecovery.openingOldestDate ?? undefined,
          openingObligations: (data.stabilityRecovery.openingObligations ?? []).map(obligation => ({
            transactionId: obligation.transactionId,
            originalAmount: deobfuscateAmount(obligation.originalAmount),
            remainingAmount: deobfuscateAmount(obligation.remainingAmount),
            date: obligation.date ?? undefined,
          })),
          recoveryCohorts: (data.stabilityRecovery.recoveryCohorts ?? []).map(cohort => ({
            originCycleKey: cohort.originCycleKey,
            fromDate: cohort.fromDate,
            transactionCount: cohort.transactionCount,
            remainingShortfall: deobfuscateAmount(cohort.remainingShortfall),
            cyclesRemaining: cohort.cyclesRemaining,
            requiredThisCycle: deobfuscateAmount(cohort.requiredThisCycle),
            isOverdue: Boolean(cohort.isOverdue),
            isDeferred: Boolean(cohort.isDeferred),
          })),
          cyclesRemaining: data.stabilityRecovery.cyclesRemaining || 0,
          requiredThisCycle: deobfuscateAmount(data.stabilityRecovery.requiredThisCycle),
          toppedUpThisCycle: deobfuscateAmount(data.stabilityRecovery.toppedUpThisCycle),
          outstandingThisCycle: deobfuscateAmount(data.stabilityRecovery.outstandingThisCycle),
          isOverdue: Boolean(data.stabilityRecovery.isOverdue),
          isDeferred: Boolean(data.stabilityRecovery.isDeferred),
          lastDrawdownCycleKey: data.stabilityRecovery.lastDrawdownCycleKey,
          recoveryFromDate: data.stabilityRecovery.recoveryFromDate ?? undefined,
          markedTotal: deobfuscateAmount(data.stabilityRecovery.markedTotal),
          repaidTotal: deobfuscateAmount(data.stabilityRecovery.repaidTotal),
          essentialsCommitted: deobfuscateAmount(data.stabilityRecovery.essentialsCommitted),
          rewardsCommitted: deobfuscateAmount(data.stabilityRecovery.rewardsCommitted),
          suggestedDraws: data.stabilityRecovery.suggestedDraws || [],
        }
        : undefined,
      categoryLimitProgress: (data.categoryLimitProgress || []).map(progress => ({
        ...progress,
        limit: deobfuscateAmount(progress.limit),
        spent: deobfuscateAmount(progress.spent),
        remaining: deobfuscateAmount(progress.remaining),
        pendingCommitted: deobfuscateAmount(progress.pendingCommitted),
        projectedSpend: deobfuscateAmount(progress.projectedSpend),
      })),
      recurringAccountShortfalls: (data.recurringAccountShortfalls || []).map(shortfall => ({
        ...shortfall,
        amount: deobfuscateAmount(shortfall.amount),
        accountBalance: deobfuscateAmount(shortfall.accountBalance),
        shortfall: deobfuscateAmount(shortfall.shortfall),
      })),
      ...(data.cycleSummaryInsights && {
        cycleSummaryInsights: {
          largestExpenseDescription: data.cycleSummaryInsights.largestExpenseDescription ?? undefined,
          // A cycle with no expenses sends these fields as JSON null rather than omitting them.
          // Running a null through deobfuscateAmount yields 0, which the insights card then
          // renders as a real "$0.00 per day" instead of "Unavailable".
          largestExpenseAmount: optionalInsightAmount(data.cycleSummaryInsights.largestExpenseAmount),
          biggestDayDate: data.cycleSummaryInsights.biggestDayDate ?? undefined,
          biggestDayTotal: optionalInsightAmount(data.cycleSummaryInsights.biggestDayTotal),
          avgDailySpend: optionalInsightAmount(data.cycleSummaryInsights.avgDailySpend),
          cycleLengthDays: data.cycleSummaryInsights.cycleLengthDays,
          velocityFirstHalf: optionalInsightAmount(data.cycleSummaryInsights.velocityFirstHalf),
          velocitySecondHalf: optionalInsightAmount(data.cycleSummaryInsights.velocitySecondHalf),
          noSpendDays: data.cycleSummaryInsights.noSpendDays,
          transactionCount: data.cycleSummaryInsights.transactionCount,
          committedSpend: deobfuscateAmount(data.cycleSummaryInsights.committedSpend),
          discretionarySpend: deobfuscateAmount(data.cycleSummaryInsights.discretionarySpend),
        }
      })
  }
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
    return mapDashboardInsights(data)
  }, { signal })
}

/** Wire -> domain mapping for the insights payload. Shared with the bootstrap decoder. */
export function mapDashboardInsights(data: WireDashboardInsights): DashboardInsights {
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
