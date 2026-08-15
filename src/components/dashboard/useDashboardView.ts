import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  ActiveRecurringPayment,
  CategorySummary,
  DashboardData,
  LedgerAccount,
  SavingsGoal,
  Transaction,
  WishlistItem,
} from '../../types'
import type { LedgerAccountReconcileInput } from '../../lib/api/accounts'
import { createFinalId } from '../../lib/outbox'
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
  transaction?: Omit<Transaction, 'id'>
  transactions: Array<Omit<Transaction, 'id'>>
  reconciliation?: LedgerAccountReconcileInput
  accountAdjustments: Array<{ id: string; name: string; current: number; target: number; diff: number }>
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
  onReconcileAccounts?: (input: LedgerAccountReconcileInput) => Promise<void> | void
}

export function useDashboardView(options: UseDashboardViewOptions) {
  const {
    dashboardData,
    wishlist,
    savingsGoals = [],
    hideSensitive,
    hideBalanceAmounts,
    onAddBalanceAdjustment,
    onReconcileAccounts,
  } = options

  // Active wishlist item for dashboard progress display
  const activeWishlistItem = useMemo(() => getActiveWishlistItem(wishlist), [wishlist])

  // Balance adjustment modal state
  const [adjustingCategory, setAdjustingCategory] = useState<CategorySummary | null>(null)
  const [newBalanceInput, setNewBalanceInput] = useState<string>('')
  const [accountBalanceInputs, setAccountBalanceInputs] = useState<Record<string, string>>({})
  const [balanceErrors, setBalanceErrors] = useState<Record<string, string>>({})
  const [adjustmentDescription, setAdjustmentDescription] = useState<string>('Balance Adjustment')
  const [pendingBalanceAdjustment, setPendingBalanceAdjustment] = useState<PendingBalanceAdjustment | null>(null)

  useEffect(() => {
    if (!hideSensitive) return
    setAdjustingCategory(null)
    setNewBalanceInput('')
    setAccountBalanceInputs({})
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
    if (adjustingCategory.accounts?.length) {
      return adjustingCategory.accounts.every(account => {
        if (account.isArchived) return true
        const raw = accountBalanceInputs[account.id]
        if (raw === undefined || raw === '') return true
        const val = parseFloat(raw)
        return !Number.isNaN(val) && Math.abs(val - account.remaining) < 0.005
      })
    }
    const val = parseFloat(newBalanceInput)
    return !Number.isNaN(val) && Math.abs(val - adjustingCategory.remaining) < 0.005
  }, [adjustingCategory, newBalanceInput, accountBalanceInputs])

  const adjustmentPreviewDiff = useMemo(() => {
    if (!adjustingCategory) return 0
    if (adjustingCategory.accounts?.length) {
      return adjustingCategory.accounts.reduce((sum, account) => {
        if (account.isArchived) return sum
        const raw = accountBalanceInputs[account.id]
        const val = raw !== undefined && raw !== '' ? parseFloat(raw) : account.remaining
        return sum + (Number.isNaN(val) ? 0 : val - account.remaining)
      }, 0)
    }
    const targetVal = parseFloat(newBalanceInput)
    return Number.isNaN(targetVal) ? 0 : targetVal - adjustingCategory.remaining
  }, [adjustingCategory, newBalanceInput, accountBalanceInputs])

  const openBalanceAdjustment = (category: CategorySummary) => {
    setAdjustingCategory(category)
    setNewBalanceInput(category.remaining.toFixed(2))
    const initialAccountInputs: Record<string, string> = {}
    if (category.accounts?.length) {
      for (const account of category.accounts) {
        initialAccountInputs[account.id] = account.remaining.toFixed(2)
      }
    }
    setAccountBalanceInputs(initialAccountInputs)
    setAdjustmentDescription('Balance Adjustment')
    setBalanceErrors({})
  }

  const handleCloseAdjustBalance = () => {
    setAdjustingCategory(null)
    setNewBalanceInput('')
    setAccountBalanceInputs({})
    setBalanceErrors({})
  }

  const handleBalanceInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewBalanceInput(maskCurrencyInput(e.target.value, newBalanceInput))
    if (balanceErrors.balance) {
      setBalanceErrors(prev => {
        const next = { ...prev }
        delete next.balance
        return next
      })
    }
  }

  const handleAccountBalanceInputChange = (accountId: string, value: string) => {
    const masked = maskCurrencyInput(value, accountBalanceInputs[accountId] ?? '')
    setAccountBalanceInputs(prev => ({ ...prev, [accountId]: masked }))
    if (balanceErrors[accountId]) {
      setBalanceErrors(prev => {
        const next = { ...prev }
        delete next[accountId]
        return next
      })
    }
  }

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAdjustmentDescription(e.target.value)
    if (balanceErrors.description) {
      setBalanceErrors(prev => {
        const next = { ...prev }
        delete next.description
        return next
      })
    }
  }

  const prepareBalanceAdjustment = () => {
    if (!adjustingCategory) return

    const newErrors: Record<string, string> = {}
    if (!adjustmentDescription.trim()) {
      newErrors.description = 'Description is required.'
    }

    const accounts = adjustingCategory.accounts ?? []
    const accountTargets = accounts.map(account => ({
      ...account,
      target: parseFloat(accountBalanceInputs[account.id] ?? ''),
    }))
    if (accounts.length) {
      for (const account of accountTargets) {
        if (!account.isArchived && Number.isNaN(account.target)) {
          newErrors[account.id] = 'Enter a valid balance amount.'
        }
      }
    } else {
      const targetVal = parseFloat(newBalanceInput)
      if (Number.isNaN(targetVal)) newErrors.balance = 'Please enter a valid balance amount.'
    }

    if (Object.keys(newErrors).length > 0) {
      setBalanceErrors(newErrors)
      return
    }
    setBalanceErrors({})

    const activeAccountTargets = accountTargets.filter(account => !account.isArchived)
    const accountAdjustments = activeAccountTargets.map(account => ({
      id: account.id,
      name: account.name,
      current: account.remaining,
      target: account.target,
      diff: account.target - account.remaining,
    })).filter(account => Math.abs(account.diff) >= 0.005)
    const currentAccountTotal = accounts.length
      ? accountTargets.reduce((sum, account) => sum + account.remaining, 0)
      : adjustingCategory.remaining
    const targetVal = accounts.length
      ? accountTargets.reduce((sum, account) => sum + (account.isArchived ? account.remaining : account.target), 0)
      : parseFloat(newBalanceInput)
    const diff = targetVal - currentAccountTotal
    if (accounts.length > 0 && accountAdjustments.length === 0) {
      setAdjustingCategory(null)
      return
    }
    if (accounts.length === 0 && Math.abs(diff) < 0.005) {
      setAdjustingCategory(null)
      return
    }

    const now = new Date()
    const y = now.getFullYear()
    const mo = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    const dateStr = `${y}-${mo}-${d}`

    const transactions = accounts.length
      ? accountAdjustments.map(account => ({
        description: `${adjustmentDescription.trim() || 'Balance Adjustment'} — ${account.name}`,
        amount: account.diff,
        category: 'Adjustment',
        ledgerCategory: adjustingCategory.name,
        excludeFromAutocomplete: true,
        isAccountBalanceAdjustment: true,
        stabilityReloadIntent: adjustingCategory.name === 'Stability' ? 'NotRequired' as const : undefined,
        accountId: account.id,
        date: dateStr,
      }))
      : [{
        description: adjustmentDescription.trim() || 'Balance Adjustment',
        amount: diff,
        category: 'Adjustment',
        ledgerCategory: adjustingCategory.name,
        excludeFromAutocomplete: true,
        date: dateStr,
      }]

    const isLedgerBucket = (['Essentials', 'Growth', 'Stability', 'Rewards'] as const)
      .includes(adjustingCategory.name as LedgerAccount['bucket'])
    const reconciliation = accounts.length > 0 && isLedgerBucket
      ? {
          operationId: createFinalId('ledgerAccountReconcile'),
          bucket: adjustingCategory.name as LedgerAccount['bucket'],
          expectedBucketTotal: currentAccountTotal,
          description: adjustmentDescription.trim() || 'Balance Adjustment',
          targets: accountTargets.map(account => ({
            id: account.id,
            name: account.name,
            isArchived: account.isArchived === true,
            expectedCurrent: account.remaining,
            target: account.isArchived ? account.remaining : account.target,
          })),
        }
      : undefined

    setPendingBalanceAdjustment({
      transaction: accounts.length ? undefined : transactions[0],
      transactions,
      reconciliation,
      accountAdjustments,
      categoryName: adjustingCategory.name,
      currentBalance: currentAccountTotal,
      targetBalance: targetVal,
      diff
    })
    setAdjustingCategory(null)
  }

  const cancelBalanceAdjustment = () => setPendingBalanceAdjustment(null)

  const confirmBalanceAdjustment = () => {
    if (!pendingBalanceAdjustment) return
    setPendingBalanceAdjustment(null)
    if (pendingBalanceAdjustment.reconciliation) {
      void onReconcileAccounts?.(pendingBalanceAdjustment.reconciliation)
      return
    }
    for (const transaction of pendingBalanceAdjustment.transactions) {
      void onAddBalanceAdjustment?.(transaction)
    }
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
    adjustingCategory,
    newBalanceInput,
    accountBalanceInputs,
    balanceErrors,
    adjustmentDescription,
    pendingBalanceAdjustment,
    isAdjustmentUnchanged,
    adjustmentPreviewDiff,
    openBalanceAdjustment,
    handleCloseAdjustBalance,
    handleBalanceInputChange,
    handleAccountBalanceInputChange,
    handleDescriptionChange,
    prepareBalanceAdjustment,
    cancelBalanceAdjustment,
    confirmBalanceAdjustment,
  }
}
