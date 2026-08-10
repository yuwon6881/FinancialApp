import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  ActiveRecurringPayment,
  CategorySummary,
  DashboardData,
  SavingsGoal,
  Transaction,
  WishlistItem,
} from '../../types'
import { maskCurrencyInput } from '../../lib/utils'
import { getActiveWishlistItem } from '../../lib/wishlist'
import { calculateFreeRewardsBalance } from '../../lib/freeRewards'
import { calculateEssentialsMetric, calculateGrowthMetric, calculateStabilityMetric } from '../../lib/financialPlanMetrics'
import {
  formatCompactSensitiveAmount,
  formatCurrencyAmount,
  formatSensitiveAmount,
} from './formatters'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export interface PendingBalanceAdjustment {
  transaction: Omit<Transaction, 'id'>
  categoryName: string
  currentBalance: number
  targetBalance: number
  diff: number
}

export interface UseDashboardViewOptions {
  dashboardData: DashboardData | null
  wishlist: WishlistItem[]
  savingsGoals?: SavingsGoal[]
  hideSensitive: boolean
  hideBalanceAmounts: boolean
  onAddBalanceAdjustment?: (newTx: Omit<Transaction, 'id'>) => Promise<void> | void
}

export function useDashboardView(options: UseDashboardViewOptions) {
  const {
    dashboardData,
    wishlist,
    savingsGoals = [],
    hideSensitive,
    hideBalanceAmounts,
    onAddBalanceAdjustment,
  } = options

  // Active wishlist item for dashboard progress display
  const activeWishlistItem = useMemo(() => getActiveWishlistItem(wishlist), [wishlist])

  // Balance adjustment modal state
  const [adjustingCategory, setAdjustingCategory] = useState<CategorySummary | null>(null)
  const [newBalanceInput, setNewBalanceInput] = useState<string>('')
  const [balanceErrors, setBalanceErrors] = useState<Record<string, string>>({})
  const [adjustmentDescription, setAdjustmentDescription] = useState<string>('Balance Adjustment')
  const [pendingBalanceAdjustment, setPendingBalanceAdjustment] = useState<PendingBalanceAdjustment | null>(null)

  useEffect(() => {
    if (!hideSensitive) return
    setAdjustingCategory(null)
    setNewBalanceInput('')
    setAdjustmentDescription('')
    setBalanceErrors({})
    setPendingBalanceAdjustment(null)
  }, [hideSensitive])

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

  const categories = useMemo<CategorySummary[]>(() => dashboardData?.categories || [
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
  const areBalanceAmountsMasked = hideSensitive || hideBalanceAmounts

  const pendingDeductionsByCategory = useMemo(() => {
    const sums: Record<string, number> = {
      'Essentials': 0,
      'Growth': 0,
      'Stability': 0,
      'Rewards': 0
    }
    const rpList = dashboardData?.activeRecurringPayments
    if (rpList) {
      rpList.forEach((rp: ActiveRecurringPayment) => {
        // Only a bill still awaiting action should be projected as an upcoming deduction --
        // isPaid alone is false for both "not yet paid" and "discarded", and a discarded bill
        // isn't coming out of the budget, so status is the only field that distinguishes them.
        if (rp.status === 'Pending') {
          const cat = rp.ledgerCategory || rp.category
          if (cat && sums[cat] !== undefined) {
            sums[cat] += rp.amount == null ? 0 : Math.abs(rp.amount)
          }
        }
      })
    }
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

  // Disable the review button while the entered target matches the current balance.
  const isAdjustmentUnchanged = useMemo(() => {
    if (!adjustingCategory) return false
    const targetVal = parseFloat(newBalanceInput)
    return !isNaN(targetVal) && Math.abs(targetVal - adjustingCategory.remaining) < 0.005
  }, [adjustingCategory, newBalanceInput])

  // The signed ledger entry the current input would produce, for the live preview.
  const adjustmentPreviewDiff = useMemo(() => {
    if (!adjustingCategory) return null
    const parsed = parseFloat(newBalanceInput)
    if (isNaN(parsed)) return null
    return parsed - adjustingCategory.remaining
  }, [adjustingCategory, newBalanceInput])

  const openBalanceAdjustment = (category: CategorySummary) => {
    if (hideSensitive) return
    setAdjustingCategory(category)
    setNewBalanceInput(category.remaining.toFixed(2))
    setAdjustmentDescription('Balance Adjustment')
    setBalanceErrors({})
  }

  const handleCloseAdjustBalance = () => {
    setAdjustingCategory(null)
    setNewBalanceInput('')
    setAdjustmentDescription('')
    setBalanceErrors({})
  }

  const handleBalanceInputChange = (rawValue: string) => {
    const val = maskCurrencyInput(rawValue, newBalanceInput)
    setNewBalanceInput(val)
    if (balanceErrors.balance) {
      setBalanceErrors(prev => ({ ...prev, balance: '' }))
    }
  }

  const handleDescriptionChange = (value: string) => {
    setAdjustmentDescription(value)
    if (balanceErrors.description) {
      setBalanceErrors(prev => ({ ...prev, description: '' }))
    }
  }

  const prepareBalanceAdjustment = () => {
    if (!adjustingCategory) return

    const targetVal = parseFloat(newBalanceInput)
    const newErrors: Record<string, string> = {}
    if (isNaN(targetVal)) {
      newErrors.balance = 'Please enter a valid balance amount.'
    }
    if (!adjustmentDescription.trim()) {
      newErrors.description = 'Description is required.'
    }

    if (Object.keys(newErrors).length > 0) {
      setBalanceErrors(newErrors)
      return
    }
    setBalanceErrors({})

    const diff = targetVal - adjustingCategory.remaining
    if (Math.abs(diff) < 0.005) {
      setAdjustingCategory(null)
      return
    }

    const now = new Date()
    const y = now.getFullYear()
    const mo = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    const dateStr = `${y}-${mo}-${d}`

    setPendingBalanceAdjustment({
      transaction: {
        description: adjustmentDescription.trim() || 'Balance Adjustment',
        amount: diff,
        category: 'Adjustment',
        ledgerCategory: adjustingCategory.name,
        date: dateStr
      },
      categoryName: adjustingCategory.name,
      currentBalance: adjustingCategory.remaining,
      targetBalance: targetVal,
      diff
    })
    setAdjustingCategory(null)
  }

  const cancelBalanceAdjustment = () => setPendingBalanceAdjustment(null)

  const confirmBalanceAdjustment = () => {
    if (!pendingBalanceAdjustment) return
    const tx = pendingBalanceAdjustment.transaction
    setPendingBalanceAdjustment(null)
    void onAddBalanceAdjustment?.(tx)
  }

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
    adjustingCategory,
    newBalanceInput,
    balanceErrors,
    adjustmentDescription,
    pendingBalanceAdjustment,
    isAdjustmentUnchanged,
    adjustmentPreviewDiff,
    openBalanceAdjustment,
    handleCloseAdjustBalance,
    handleBalanceInputChange,
    handleDescriptionChange,
    prepareBalanceAdjustment,
    cancelBalanceAdjustment,
    confirmBalanceAdjustment,
  }
}
