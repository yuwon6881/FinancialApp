import { useState, useMemo, useEffect } from 'react'
import type { DashboardData, TransactionCategory } from '../../../types'
import { rebalanceAllocations, type AllocationKey } from '../../../lib/allocations'
import { getStartOfNCyclesAgo, getCycleRangeDates, formatDateForApi, getCurrentCycleYearAndMonth } from '../../../lib/cycle'
import * as api from '../../../lib/api'
import type { CategoryCleanupSuggestion } from '../../../lib/api'
import { getErrorMessage } from '../../../lib/errors'
import { focusFirstInvalidField } from '../../ui/formValidation'
import { useSyncStatus } from '../../../lib/useOptimisticList'
import { isSystemCategoryName } from '../../../lib/categoryFlow'

export interface UseSettingsViewOptions {
  dashboardData: DashboardData | null
  categoriesList: TransactionCategory[]
  darkMode: boolean
  hideSensitive: boolean
  onUpdateSettings: (settings: any) => void
  onAddCategory: (category: any) => void
  onDeleteCategory: (id: string) => void | Promise<void>
  onApplyCategoryCleanupSuggestion?: (suggestion: CategoryCleanupSuggestion, targetCategoryOverride?: string) => Promise<void> | void
  onToast: (message: string, title?: string, tone?: any) => void
  activeSyncId?: string | null
  activeSyncIds?: ReadonlyArray<string>
  deletingId?: string | null
}

const USAGE_LOOKBACK_CYCLES = 6
// A category used this many times or fewer (but at least once) over the lookback window is
// surfaced as a "rarely used" removal candidate. Above this, the exact count is noise for the
// decision at hand ("what can I safely remove?"), so we don't show it.
const RARELY_USED_MAX_COUNT = 2

export function useSettingsView(options: UseSettingsViewOptions) {
  const {
    dashboardData,
    categoriesList,
    darkMode,
    hideSensitive,
    onUpdateSettings,
    onAddCategory,
    onDeleteCategory,
    onApplyCategoryCleanupSuggestion,
    onToast,
    activeSyncId,
    activeSyncIds,
    deletingId,
  } = options

  const { isSyncing: isCatSyncing, isDeleting: isCatDeleting } = useSyncStatus(
    categoriesList,
    activeSyncIds?.length ? activeSyncIds : activeSyncId,
    deletingId,
  )

  const activeSettings = dashboardData?.setting || {
    targetStabilityFund: 10000,
    selectedMonth: 'Jun',
    selectedYear: 2026,
    essentialsAlloc: 0.5,
    growthAlloc: 0.25,
    stabilityAlloc: 0.15,
    rewardsAlloc: 0.1,
    cycleDay: 28,
    darkMode,
    hideSensitive,
    currency: 'USD'
  }

  const [targetInput, setTargetInput] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [essentialsAllocInput, setEssentialsAllocInput] = useState('')
  const [growthAllocInput, setGrowthAllocInput] = useState('')
  const [stabilityAllocInput, setStabilityAllocInput] = useState('')
  const [rewardsAllocInput, setRewardsAllocInput] = useState('')
  const [stabilityOverflowRedirectInput, setStabilityOverflowRedirectInput] = useState('Split: Growth 50%, Rewards 50%')
  const [cycleDayInput, setCycleDayInput] = useState('28')
  const [currencyInput, setCurrencyInput] = useState('USD')
  const [newCatName, setNewCatName] = useState('')
  const [lockedAllocations, setLockedAllocations] = useState<AllocationKey[]>([])
  const [globalAllocLock, setGlobalAllocLock] = useState(true)

  const toggleLock = (key: AllocationKey) => {
    setLockedAllocations(prev => {
      if (prev.includes(key)) return prev.filter(k => k !== key)
      if (prev.length >= 2) return prev
      return [...prev, key]
    })
  }

  const [showUsageDetails, setShowUsageDetails] = useState(false)
  const [categoriesOpen, setCategoriesOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768
    }
    return true
  })
  const [usageCounts, setUsageCounts] = useState<Map<string, number> | null>(null)
  const [usageError, setUsageError] = useState<string | null>(null)
  const [cleanupSuggestions, setCleanupSuggestions] = useState<CategoryCleanupSuggestion[]>([])
  const [cleanupReviewOpen, setCleanupReviewOpen] = useState(false)
  const [isReviewingCleanup, setIsReviewingCleanup] = useState(false)
  const [applyingCleanupId, setApplyingCleanupId] = useState<string | null>(null)
  const [cleanupReviewError, setCleanupReviewError] = useState<string | null>(null)
  const [consolidateTargets, setConsolidateTargets] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    setUsageCounts(null)
    setUsageError(null)
    const { year: activeYear, monthIndex: activeMonthIdx } = getCurrentCycleYearAndMonth(activeSettings.cycleDay)

    const startDate = getStartOfNCyclesAgo(activeYear, activeMonthIdx, activeSettings.cycleDay, USAGE_LOOKBACK_CYCLES)
    const endDate = getCycleRangeDates(activeYear, activeMonthIdx, activeSettings.cycleDay).end

    api.fetchCategoryUsage(formatDateForApi(startDate), formatDateForApi(endDate))
      .then(result => {
        if (!cancelled) setUsageCounts(new Map(result.map(item => [item.categoryKey, item.count])))
      })
      .catch(() => {
        if (!cancelled) setUsageError('Could not load category usage.')
      })
    return () => { cancelled = true }
  }, [activeSettings.cycleDay])

  useEffect(() => {
    setTargetInput(activeSettings.targetStabilityFund.toString())
    setEssentialsAllocInput((activeSettings.essentialsAlloc * 100).toString())
    setGrowthAllocInput((activeSettings.growthAlloc * 100).toString())
    setStabilityAllocInput((activeSettings.stabilityAlloc * 100).toString())
    setRewardsAllocInput((activeSettings.rewardsAlloc * 100).toString())
    setCycleDayInput(activeSettings.cycleDay.toString())
    setStabilityOverflowRedirectInput(activeSettings.stabilityOverflowRedirect || 'Split: Growth 50%, Rewards 50%')
    setCurrencyInput(activeSettings.currency || 'USD')
  }, [
    activeSettings.targetStabilityFund,
    activeSettings.essentialsAlloc,
    activeSettings.growthAlloc,
    activeSettings.stabilityAlloc,
    activeSettings.rewardsAlloc,
    activeSettings.cycleDay,
    activeSettings.stabilityOverflowRedirect,
    activeSettings.currency
  ])

  const allocSum = useMemo(() => {
    const e = parseFloat(essentialsAllocInput) || 0
    const g = parseFloat(growthAllocInput) || 0
    const s = parseFloat(stabilityAllocInput) || 0
    const r = parseFloat(rewardsAllocInput) || 0
    return Math.round(e + g + s + r)
  }, [essentialsAllocInput, growthAllocInput, stabilityAllocInput, rewardsAllocInput])

  const handleAllocationChange = (changedKey: AllocationKey, newValue: number) => {
    if (hideSensitive) return
    const current = {
      essentials: parseFloat(essentialsAllocInput) || 0,
      growth: parseFloat(growthAllocInput) || 0,
      stability: parseFloat(stabilityAllocInput) || 0,
      rewards: parseFloat(rewardsAllocInput) || 0
    }

    const newAlloc = rebalanceAllocations(current, changedKey, newValue, lockedAllocations)
    if (!newAlloc) return

    setEssentialsAllocInput(newAlloc.essentials.toString())
    setGrowthAllocInput(newAlloc.growth.toString())
    setStabilityAllocInput(newAlloc.stability.toString())
    setRewardsAllocInput(newAlloc.rewards.toString())
  }

  const handleSaveSettings = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (hideSensitive) return
    const newErrors: Record<string, string> = {}

    const target = parseFloat(targetInput)
    if (!targetInput.trim()) {
      newErrors.target = 'Target Stability Fund Limit is required.'
    } else if (isNaN(target) || target < 0) {
      newErrors.target = 'Please enter a valid target limit.'
    }

    if (!essentialsAllocInput.trim()) newErrors.essentials = 'Essentials allocation is required.'
    if (!growthAllocInput.trim()) newErrors.growth = 'Growth allocation is required.'
    if (!stabilityAllocInput.trim()) newErrors.stability = 'Stability allocation is required.'
    if (!rewardsAllocInput.trim()) newErrors.rewards = 'Rewards allocation is required.'

    if (allocSum !== 100) {
      newErrors.allocationSum = `Allocations must total exactly 100% (currently ${allocSum}%).`
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      focusFirstInvalidField(e.currentTarget)
      return
    }
    setErrors({})

    const parsedCycle = Number.parseInt(cycleDayInput, 10)
    const cycle = Number.isFinite(parsedCycle) ? Math.min(31, Math.max(1, parsedCycle)) : Number.NaN
    if (isNaN(cycle)) return

    onUpdateSettings({
      targetStabilityFund: target,
      essentialsAlloc: (parseFloat(essentialsAllocInput) || 0) / 100,
      growthAlloc: (parseFloat(growthAllocInput) || 0) / 100,
      stabilityAlloc: (parseFloat(stabilityAllocInput) || 0) / 100,
      rewardsAlloc: (parseFloat(rewardsAllocInput) || 0) / 100,
      stabilityOverflowRedirect: stabilityOverflowRedirectInput,
      cycleDay: cycle,
      currency: currencyInput
    })
  }

  const handleAddCategory = () => {
    if (hideSensitive) return
    const trimmed = newCatName.trim()
    if (!trimmed) return

    const lower = trimmed.toLowerCase()
    if (isSystemCategoryName(lower)) return
    if (categoriesList.some(c => c.name.trim().toLowerCase() === lower)) return

    onAddCategory({ name: trimmed })
    setNewCatName('')
  }

  const trimmedCatName = newCatName.trim()
  const isCatEmpty = trimmedCatName.length === 0
  const isCatDuplicate = useMemo(() => {
    if (isCatEmpty) return false
    return categoriesList.some(c => c.name.trim().toLowerCase() === trimmedCatName.toLowerCase())
  }, [categoriesList, trimmedCatName, isCatEmpty])

  const isCatReserved = useMemo(() => {
    const lower = trimmedCatName.toLowerCase()
    return isSystemCategoryName(lower)
  }, [trimmedCatName])

  const isCatValid = !isCatEmpty && !isCatDuplicate && !isCatReserved && !hideSensitive

  const [checkingDeleteId, setCheckingDeleteId] = useState<string | null>(null)
  const handleDeleteCategory = async (id: string) => {
    if (hideSensitive || checkingDeleteId) return
    // requestDeleteCategory looks up transaction usage before opening the
    // confirm modal, so surface a spinner on the row while that check runs.
    setCheckingDeleteId(id)
    try {
      await onDeleteCategory(id)
    } finally {
      setCheckingDeleteId(null)
    }
  }

  const handleAiCleanupReview = async () => {
    if (hideSensitive || isReviewingCleanup) return
    setCategoriesOpen(true)
    setCleanupReviewOpen(true)
    setCleanupReviewError(null)
    setIsReviewingCleanup(true)
    try {
      const result = await api.reviewCategoryCleanup()
      setCleanupSuggestions(result.suggestions)
      if (result.suggestions.length === 0) {
        onToast('AI did not find category cleanup changes worth proposing.', 'AI Review Complete', 'info')
      }
    } catch (err: unknown) {
      console.error(err)
      setCleanupReviewError(getErrorMessage(err, 'Could not review categories.'))
      onToast(getErrorMessage(err, 'Could not review categories.'), 'AI Review Failed', 'error')
    } finally {
      setIsReviewingCleanup(false)
    }
  }

  const handleApplyCleanupSuggestion = async (suggestion: CategoryCleanupSuggestion) => {
    if (hideSensitive || applyingCleanupId) return
    if (suggestion.type === 'consolidate' && !consolidateTargets[suggestion.id]) return
    setApplyingCleanupId(suggestion.id)
    try {
      await onApplyCategoryCleanupSuggestion?.(suggestion, consolidateTargets[suggestion.id])
      setCleanupSuggestions(prev => prev.filter(item => item.id !== suggestion.id))
      setConsolidateTargets(prev => {
        const next = { ...prev }
        delete next[suggestion.id]
        return next
      })
    } finally {
      setApplyingCleanupId(null)
    }
  }

  // Only show categories that the user can change and manage; the app-owned names
  // (Transfer, Adjustment) are hidden from the categories list.
  const editableCategories = categoriesList.filter(category => !isSystemCategoryName(category.name))
  const visibleCategories = editableCategories

  const categoryUsage = useMemo(() => {
    if (!usageCounts) return null

    const countByName = new Map<string, number>()
    for (const cat of visibleCategories) {
      countByName.set(cat.name.trim().toLowerCase(), 0)
    }

    for (const [key, count] of usageCounts) {
      if (countByName.has(key)) countByName.set(key, count)
    }

    return visibleCategories
      .map(cat => ({ category: cat, count: countByName.get(cat.name.trim().toLowerCase())! }))
      .sort((a, b) => a.count - b.count)
  }, [usageCounts, visibleCategories])

  const unusedCategoryCount = categoryUsage ? categoryUsage.filter(c => c.count === 0).length : 0
  const rarelyUsedCategoryCount = categoryUsage
    ? categoryUsage.filter(c => c.count > 0 && c.count <= RARELY_USED_MAX_COUNT).length
    : 0
  const isLoadingUsage = usageCounts === null && usageError === null

  return {
    activeSettings,
    targetInput,
    setTargetInput,
    errors,
    setErrors,
    essentialsAllocInput,
    growthAllocInput,
    stabilityAllocInput,
    rewardsAllocInput,
    stabilityOverflowRedirectInput,
    setStabilityOverflowRedirectInput,
    cycleDayInput,
    setCycleDayInput,
    currencyInput,
    setCurrencyInput,
    newCatName,
    setNewCatName,
    lockedAllocations,
    globalAllocLock,
    setGlobalAllocLock,
    toggleLock,
    showUsageDetails,
    setShowUsageDetails,
    categoriesOpen,
    setCategoriesOpen,
    isLoadingUsage,
    usageError,
    cleanupSuggestions,
    setCleanupSuggestions,
    cleanupReviewOpen,
    setCleanupReviewOpen,
    isReviewingCleanup,
    applyingCleanupId,
    cleanupReviewError,
    consolidateTargets,
    setConsolidateTargets,
    allocSum,
    handleAllocationChange,
    handleSaveSettings,
    handleAddCategory,
    isCatValid,
    isCatDuplicate,
    isCatReserved,
    handleDeleteCategory,
    checkingDeleteId,
    handleAiCleanupReview,
    handleApplyCleanupSuggestion,
    visibleCategories,
    editableCategories,
    categoryUsage,
    unusedCategoryCount,
    rarelyUsedCategoryCount,
    RARELY_USED_MAX_COUNT,
    USAGE_LOOKBACK_CYCLES,
    isCatSyncing,
    isCatDeleting,
    setEssentialsAllocInput,
    setGrowthAllocInput,
    setStabilityAllocInput,
    setRewardsAllocInput,
  }
}
