import { useCallback, useMemo } from 'react'
import type {
  DashboardData,
  SavingsGoal,
  WishlistItem,
} from '../../types'
import { getActiveWishlistItem } from '../../lib/wishlist'
import { calculateFreeRewardsBalance, pendingRecurringAmount } from '../../lib/freeRewards'
import { calculateEssentialsMetric, calculateGrowthMetric, calculateStabilityMetric } from '../../lib/financialPlanMetrics'
import {
  formatCompactSensitiveAmount,
  formatCurrencyAmount,
  formatSensitiveAmount,
} from './formatters'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export interface UseDashboardViewOptions {
  dashboardData: DashboardData | null
  wishlist: WishlistItem[]
  savingsGoals?: SavingsGoal[]
  hideSensitive: boolean
  hideBalanceAmounts: boolean
}

export function useDashboardView(options: UseDashboardViewOptions) {
  const {
    dashboardData,
    wishlist,
    savingsGoals = [],
    hideSensitive,
    hideBalanceAmounts,
  } = options

  // Active wishlist item for dashboard progress display
  const activeWishlistItem = useMemo(() => getActiveWishlistItem(wishlist), [wishlist])

  const years = useMemo<number[]>(() => {
    return dashboardData?.availableYears || [new Date().getFullYear()]
  }, [dashboardData])

  // Extract variables from dashboardData or fall back to defaults
  const activeSettings = useMemo(() => dashboardData?.setting || {
    targetStabilityFund: 10000.00,
    selectedMonth: 'Jun',
    selectedYear: 2026,
    essentialsAlloc: 0.50,
    growthAlloc: 0.25,
    stabilityAlloc: 0.15,
    rewardsAlloc: 0.10,
    cycleDay: 28,
    currency: 'USD'
  }, [dashboardData])

  const cycleLabel = dashboardData?.cycleLabel || 'Jun 28th ~ Jul 27th, 2026'

  const categories = useMemo(() => dashboardData?.categories || [
    { name: "Essentials", allocation: 0.50, target: 2000.00, incomeAllocated: 0, budget: 0, netChange: 0, remaining: 0 },
    { name: "Growth", allocation: 0.25, target: 1000.00, incomeAllocated: 0, budget: 0, netChange: 0, remaining: 0 },
    { name: "Stability", allocation: 0.15, target: 600.00, incomeAllocated: 0, budget: 2436.00, netChange: 0, remaining: 2436.00 },
    { name: "Rewards", allocation: 0.10, target: 400.00, incomeAllocated: 0, budget: 0, netChange: 0, remaining: 0 }
  ], [dashboardData])

  const stats = useMemo(() => dashboardData?.stats || {
    totalBalance: 2436.00,
    monthlyIncome: 0.00,
    monthlyInflow: 0.00,
    monthlyExpenses: 0.00,
    activeRecurringTotal: 29.50,
    growthPercentAchieved: 0.0,
    stabilityPercentReached: 0.2436
  }, [dashboardData])

  const activeRecurring = dashboardData?.activeRecurringPayments || []
  const todayPlanInsights = dashboardData?.todayPlanInsights || {
    unpaidRecurringCount: 0,
    unpaidRecurringTotal: 0,
    unpaidEssentialsTotal: 0,
    nonRecurringEssentialsSpent: 0,
    nonRecurringEssentialsDailyAverage: 0,
    projectedEssentialsEndingBalance: 0,
  }
  const categoryLimitProgress = dashboardData?.categoryLimitProgress || []
  const recurringAccountShortfalls = dashboardData?.recurringAccountShortfalls || []
  const areBalanceAmountsMasked = hideSensitive || hideBalanceAmounts

  const pendingDeductionsByCategory = useMemo(() => {
    const sums: Record<string, number> = {
      'Essentials': 0,
      'Growth': 0,
      'Stability': 0,
      'Rewards': 0
    }
    const rpList = dashboardData?.activeRecurringPayments
    ;(['Essentials', 'Growth', 'Stability', 'Rewards'] as const).forEach(bucket => {
      sums[bucket] = pendingRecurringAmount(rpList, bucket)
    })
    return sums
  }, [dashboardData?.activeRecurringPayments])

  const formatCurrency = useCallback(
    (val: number) => formatCurrencyAmount(val, activeSettings.currency),
    [activeSettings.currency]
  )

  const formatSensitive = useCallback(
    (val: number) => formatSensitiveAmount(val, hideSensitive, activeSettings.currency),
    [hideSensitive, activeSettings.currency]
  )

  const formatCompactSensitive = useCallback(
    (val: number) => formatCompactSensitiveAmount(val, hideSensitive, activeSettings.currency),
    [hideSensitive, activeSettings.currency]
  )

  // Growth Achieved
  const growthMetric = useMemo(() => {
    const growthCat = categories.find(c => c.name === 'Growth')
    const pending = pendingDeductionsByCategory['Growth'] || 0
    return calculateGrowthMetric(growthCat, pending)
  }, [categories, stats, pendingDeductionsByCategory])

  // Essentials Remaining
  const essentialsMetric = useMemo(() => {
    const essentialsCat = categories.find(c => c.name === 'Essentials')
    const pending = pendingDeductionsByCategory['Essentials'] || 0
    return calculateEssentialsMetric(essentialsCat, pending)
  }, [categories, pendingDeductionsByCategory])

  // Stability Reached
  const stabilityMetric = useMemo(() => {
    const stabilityCat = categories.find(c => c.name === 'Stability')
    const stabilityTarget = activeSettings.targetStabilityFund
    const pending = pendingDeductionsByCategory['Stability'] || 0
    return calculateStabilityMetric(stabilityCat, stabilityTarget, pending)
  }, [categories, activeSettings, pendingDeductionsByCategory])

  // Wishlist Goal Card (Shown when active goal exists)
  const wishlistGoal = useMemo(() => {
    if (!activeWishlistItem) return null
    const rewardsCategory = categories.find(c => c.name === 'Rewards')
    const pending = pendingDeductionsByCategory['Rewards'] || 0
    const rewardsBalance = calculateFreeRewardsBalance(rewardsCategory?.remaining ?? 0, savingsGoals, pending)
    const pct = Math.max(0, Math.min(100, (rewardsBalance / activeWishlistItem.price) * 100))
    const canAfford = rewardsBalance >= activeWishlistItem.price
    return { item: activeWishlistItem, rewardsBalance, pct, canAfford }
  }, [activeWishlistItem, categories, pendingDeductionsByCategory, savingsGoals])

  return {
    months: MONTHS,
    years,
    activeSettings,
    cycleLabel,
    categories,
    stats,
    activeRecurring,
    todayPlanInsights,
    categoryLimitProgress,
    recurringAccountShortfalls,
    areBalanceAmountsMasked,
    pendingDeductionsByCategory,
    activeWishlistItem,
    growthMetric,
    essentialsMetric,
    stabilityMetric,
    wishlistGoal,
    formatCurrency,
    formatSensitive,
    formatCompactSensitive,
  }
}
