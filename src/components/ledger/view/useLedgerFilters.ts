import { useState, useEffect, useCallback } from 'react'
import {
  type TransactionLinkFilter,
  type TransactionSearchMode,
  type TransactionTypeFilterOption,
  type StabilityReloadFilter,
  parseTxTypes,
} from '../../../lib/transactionFilters'
import { ledgerRouteSearch, updateAppSearch, type LedgerRouteRange } from '../../../lib/appLocation'
import {
  LEDGER_BUCKETS,
  type LedgerTxType,
  type LedgerReloadFilter,
} from './ledgerViewTypes'

export interface UseLedgerFiltersOptions {
  categories: any[]
  incomingCategory?: string | null
  incomingFilters?: string[]
  incomingSearch?: string | null
  incomingSearchMode?: TransactionSearchMode
  incomingDate?: string | null
  incomingStartDate?: string | null
  incomingEndDate?: string | null
  incomingMinAmount?: string | null
  incomingMaxAmount?: string | null
  incomingRecurringFilter?: TransactionLinkFilter
  incomingWishlistFilter?: TransactionLinkFilter
  incomingReloadFilter?: LedgerReloadFilter
  incomingAccountIds?: string[]
  incomingTxType?: LedgerTxType
  highlightedTxId?: string | null
  showAllCycles: boolean
  cyclesRange?: 'monthly' | '3month' | '6month' | 'yearly' | 'all'
  onClearIncomingFilters?: () => void
  onRouteStateChange?: (state: {
    filters: string[]
    search: string
    searchMode: TransactionSearchMode
    startDate: string
    endDate: string
    minAmount: string
    maxAmount: string
    recurringFilter: TransactionLinkFilter
    wishlistFilter: TransactionLinkFilter
    reloadFilter: LedgerReloadFilter
    accountIds: string[]
    txType: LedgerTxType
    showAllCycles: boolean
    range: LedgerRouteRange
  }) => void
  setCurrentPage: (page: number | ((prev: number) => number)) => void
}

export function useLedgerFilters(options: UseLedgerFiltersOptions) {
  const {
    categories,
    incomingCategory,
    incomingFilters,
    incomingSearch,
    incomingSearchMode = 'contains',
    incomingDate,
    incomingStartDate,
    incomingEndDate,
    incomingMinAmount,
    incomingMaxAmount,
    incomingRecurringFilter,
    incomingWishlistFilter,
    incomingReloadFilter,
    incomingAccountIds,
    incomingTxType,
    highlightedTxId,
    showAllCycles,
    cyclesRange,
    onClearIncomingFilters,
    onRouteStateChange,
    setCurrentPage,
  } = options

  const initialFilters = incomingFilters ?? (incomingCategory ? [incomingCategory] : [])
  const initialStartDate = incomingStartDate ?? incomingDate ?? ''
  const initialEndDate = incomingEndDate ?? incomingDate ?? ''
  const initialRecurringFilter: TransactionLinkFilter = incomingRecurringFilter ?? 'all'
  const initialWishlistFilter: TransactionLinkFilter = incomingWishlistFilter ?? 'all'
  const initialReloadFilter: StabilityReloadFilter = incomingReloadFilter ?? 'all'
  const initialAccountIds = incomingAccountIds ?? []
  const initialTxType: TransactionTypeFilterOption[] = parseTxTypes(incomingTxType)

  const [searchTerm, setSearchTerm] = useState(incomingSearch || '')
  const [searchMode, setSearchMode] = useState<TransactionSearchMode>(incomingSearchMode)
  const [selectedFilters, setSelectedFilters] = useState<string[]>(initialFilters)
  const [selectedStartDate, setSelectedStartDate] = useState(initialStartDate)
  const [selectedEndDate, setSelectedEndDate] = useState(initialEndDate)
  const [selectedMinAmount, setSelectedMinAmount] = useState(incomingMinAmount || '')
  const [selectedMaxAmount, setSelectedMaxAmount] = useState(incomingMaxAmount || '')
  const [selectedRecurringFilter, setSelectedRecurringFilter] = useState<TransactionLinkFilter>(initialRecurringFilter)
  const [selectedWishlistFilter, setSelectedWishlistFilter] = useState<TransactionLinkFilter>(initialWishlistFilter)
  const [selectedReloadFilter, setSelectedReloadFilter] = useState<StabilityReloadFilter>(initialReloadFilter)
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>(initialAccountIds)
  const [selectedTxTypeFilter, setSelectedTxTypeFilter] = useState<TransactionTypeFilterOption[]>(initialTxType)
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false)

  const [pendingSearchTerm, setPendingSearchTerm] = useState(incomingSearch || '')
  const [pendingSearchMode, setPendingSearchMode] = useState<TransactionSearchMode>(incomingSearchMode)
  const [pendingFilters, setPendingFilters] = useState<string[]>(initialFilters)
  const [pendingStartDate, setPendingStartDate] = useState(initialStartDate)
  const [pendingEndDate, setPendingEndDate] = useState(initialEndDate)
  const [pendingMinAmount, setPendingMinAmount] = useState(incomingMinAmount || '')
  const [pendingMaxAmount, setPendingMaxAmount] = useState(incomingMaxAmount || '')
  const [pendingRecurringFilter, setPendingRecurringFilter] = useState<TransactionLinkFilter>(initialRecurringFilter)
  const [pendingWishlistFilter, setPendingWishlistFilter] = useState<TransactionLinkFilter>(initialWishlistFilter)
  const [pendingReloadFilter, setPendingReloadFilter] = useState<StabilityReloadFilter>(initialReloadFilter)
  const [pendingAccountIds, setPendingAccountIds] = useState<string[]>(initialAccountIds)
  const [pendingTxTypeFilter, setPendingTxTypeFilter] = useState<TransactionTypeFilterOption[]>(initialTxType)

  const [appliedSearch, setAppliedSearch] = useState(incomingSearch || '')
  const [appliedSearchMode, setAppliedSearchMode] = useState<TransactionSearchMode>(incomingSearchMode)
  const [appliedFilters, setAppliedFilters] = useState<string[]>(initialFilters)
  const [appliedStartDate, setAppliedStartDate] = useState(initialStartDate)
  const [appliedEndDate, setAppliedEndDate] = useState(initialEndDate)
  const [appliedMinAmount, setAppliedMinAmount] = useState(incomingMinAmount || '')
  const [appliedMaxAmount, setAppliedMaxAmount] = useState(incomingMaxAmount || '')
  const [appliedRecurringFilter, setAppliedRecurringFilter] = useState<TransactionLinkFilter>(initialRecurringFilter)
  const [appliedWishlistFilter, setAppliedWishlistFilter] = useState<TransactionLinkFilter>(initialWishlistFilter)
  const [appliedReloadFilter, setAppliedReloadFilter] = useState<StabilityReloadFilter>(initialReloadFilter)
  const [appliedAccountIds, setAppliedAccountIds] = useState<string[]>(initialAccountIds)
  const [appliedTxTypeFilter, setAppliedTxTypeFilter] = useState<TransactionTypeFilterOption[]>(initialTxType)

  const incomingFilterSignature = JSON.stringify([
    initialFilters, incomingSearch || '', incomingSearchMode, initialStartDate, initialEndDate,
    incomingMinAmount || '', incomingMaxAmount || '',
    initialRecurringFilter, initialWishlistFilter, initialReloadFilter, initialAccountIds, initialTxType,
  ])
  const [appliedIncomingSignature, setAppliedIncomingSignature] = useState(incomingFilterSignature)
  if (appliedIncomingSignature !== incomingFilterSignature) {
    setAppliedIncomingSignature(incomingFilterSignature)
    setSearchTerm(incomingSearch || '')
    setSearchMode(incomingSearchMode)
    setSelectedFilters(initialFilters)
    setSelectedStartDate(initialStartDate)
    setSelectedEndDate(initialEndDate)
    setSelectedMinAmount(incomingMinAmount || '')
    setSelectedMaxAmount(incomingMaxAmount || '')
    setSelectedRecurringFilter(initialRecurringFilter)
    setSelectedWishlistFilter(initialWishlistFilter)
    setSelectedReloadFilter(initialReloadFilter)
    setSelectedAccountIds(initialAccountIds)
    setSelectedTxTypeFilter(initialTxType)
    setPendingSearchTerm(incomingSearch || '')
    setPendingSearchMode(incomingSearchMode)
    setPendingFilters(initialFilters)
    setPendingStartDate(initialStartDate)
    setPendingEndDate(initialEndDate)
    setPendingMinAmount(incomingMinAmount || '')
    setPendingMaxAmount(incomingMaxAmount || '')
    setPendingRecurringFilter(initialRecurringFilter)
    setPendingWishlistFilter(initialWishlistFilter)
    setPendingReloadFilter(initialReloadFilter)
    setPendingAccountIds(initialAccountIds)
    setPendingTxTypeFilter(initialTxType)
    setAppliedSearch(incomingSearch || '')
    setAppliedSearchMode(incomingSearchMode)
    setAppliedFilters(initialFilters)
    setAppliedStartDate(initialStartDate)
    setAppliedEndDate(initialEndDate)
    setAppliedMinAmount(incomingMinAmount || '')
    setAppliedMaxAmount(incomingMaxAmount || '')
    setAppliedRecurringFilter(initialRecurringFilter)
    setAppliedWishlistFilter(initialWishlistFilter)
    setAppliedReloadFilter(initialReloadFilter)
    setAppliedAccountIds(initialAccountIds)
    setAppliedTxTypeFilter(initialTxType)
    if (!highlightedTxId) {
      setCurrentPage(1)
    }
  }

  // Keep the visible ledger state addressable
  useEffect(() => {
    if (typeof window === 'undefined' || window.location.pathname !== '/ledger') return
    const formatTxTypes = (types: TransactionTypeFilterOption[]): string | null => {
      if (types.length === 0 || types.length === 3) return null
      return types.join(',')
    }

    const routeState = showAllCycles
      ? {
          filters: appliedFilters,
          search: appliedSearch,
          searchMode: appliedSearchMode,
          startDate: appliedStartDate,
          endDate: appliedEndDate,
          minAmount: appliedMinAmount,
          maxAmount: appliedMaxAmount,
          recurringFilter: appliedRecurringFilter,
          wishlistFilter: appliedWishlistFilter,
          reloadFilter: appliedReloadFilter,
          accountIds: appliedAccountIds,
          txType: formatTxTypes(appliedTxTypeFilter),
        }
      : {
          filters: selectedFilters,
          search: searchTerm,
          searchMode,
          startDate: selectedStartDate,
          endDate: selectedEndDate,
          minAmount: selectedMinAmount,
          maxAmount: selectedMaxAmount,
          recurringFilter: selectedRecurringFilter,
          wishlistFilter: selectedWishlistFilter,
          reloadFilter: selectedReloadFilter,
          accountIds: selectedAccountIds,
          txType: formatTxTypes(selectedTxTypeFilter),
        }
    updateAppSearch(ledgerRouteSearch({
      ...routeState,
      showAllCycles,
      range: cyclesRange || 'monthly',
      highlightedTxId: highlightedTxId || null,
    }))
    onRouteStateChange?.({
      ...routeState,
      showAllCycles,
      range: cyclesRange || 'monthly',
    })
  }, [showAllCycles, cyclesRange, highlightedTxId, searchTerm, searchMode, selectedFilters, selectedStartDate, selectedEndDate, selectedMinAmount, selectedMaxAmount, selectedRecurringFilter, selectedWishlistFilter, selectedReloadFilter, selectedAccountIds, selectedTxTypeFilter, appliedSearch, appliedSearchMode, appliedFilters, appliedStartDate, appliedEndDate, appliedMinAmount, appliedMaxAmount, appliedRecurringFilter, appliedWishlistFilter, appliedReloadFilter, appliedAccountIds, appliedTxTypeFilter, onRouteStateChange])

  const handleToggleFilter = (filterName: string) => {
    const isLedgerCategory = LEDGER_BUCKETS.includes(filterName)
    const groupFilters = isLedgerCategory
      ? LEDGER_BUCKETS
      : categories.map(c => c.name)

    const updateFilterList = (prev: string[]) => {
      let next
      if (prev.includes(filterName)) {
        next = prev.filter(f => f !== filterName)
      } else {
        next = [...prev, filterName]
      }

      const groupSelectedCount = next.filter(f => groupFilters.includes(f)).length
      if (groupSelectedCount === groupFilters.length) {
        next = next.filter(f => !groupFilters.includes(f))
      }
      return next
    }

    if (showAllCycles) {
      setPendingFilters(prev => updateFilterList(prev))
    } else {
      setSelectedFilters(prev => updateFilterList(prev))
    }
  }

  const handleToggleTxType = (type: TransactionTypeFilterOption | null) => {
    const update = (prev: TransactionTypeFilterOption[]): TransactionTypeFilterOption[] => {
      if (!type) return []
      let next: TransactionTypeFilterOption[]
      if (prev.includes(type)) {
        next = prev.filter(t => t !== type)
      } else {
        next = [...prev, type]
      }
      if (next.length >= 3) return []
      return next
    }
    if (showAllCycles) {
      setPendingTxTypeFilter(prev => update(prev))
    } else {
      setSelectedTxTypeFilter(prev => update(prev))
    }
  }

  const handleToggleReloadFilter = (filter: StabilityReloadFilter) => {
    if (showAllCycles) {
      setPendingReloadFilter(filter)
    } else {
      setSelectedReloadFilter(filter)
    }
  }

  const handleToggleAccount = (accountId: string) => {
    const toggle = (ids: string[]) => ids.includes(accountId)
      ? ids.filter(id => id !== accountId)
      : [...ids, accountId]
    if (showAllCycles) setPendingAccountIds(toggle)
    else setSelectedAccountIds(toggle)
  }

  const handleClearFilters = () => {
    if (showAllCycles) {
      setPendingFilters([])
      setPendingStartDate('')
      setPendingEndDate('')
      setPendingMinAmount('')
      setPendingMaxAmount('')
      setPendingRecurringFilter('all')
      setPendingWishlistFilter('all')
      setPendingReloadFilter('all')
      setPendingAccountIds([])
      setPendingTxTypeFilter([])
      setAppliedFilters([])
      setAppliedStartDate('')
      setAppliedEndDate('')
      setAppliedMinAmount('')
      setAppliedMaxAmount('')
      setAppliedRecurringFilter('all')
      setAppliedWishlistFilter('all')
      setAppliedReloadFilter('all')
      setAppliedAccountIds([])
      setAppliedTxTypeFilter([])
      setCurrentPage(1)
    } else {
      setSelectedFilters([])
      setSelectedStartDate('')
      setSelectedEndDate('')
      setSelectedMinAmount('')
      setSelectedMaxAmount('')
      setSelectedRecurringFilter('all')
      setSelectedWishlistFilter('all')
      setSelectedReloadFilter('all')
      setSelectedAccountIds([])
      setSelectedTxTypeFilter([])
    }
  }

  const handleApplyFilters = () => {
    setAppliedFilters(pendingFilters)
    setAppliedStartDate(pendingStartDate)
    setAppliedEndDate(pendingEndDate)
    setAppliedMinAmount(pendingMinAmount)
    setAppliedMaxAmount(pendingMaxAmount)
    setAppliedRecurringFilter(pendingRecurringFilter)
    setAppliedWishlistFilter(pendingWishlistFilter)
    setAppliedReloadFilter(pendingReloadFilter)
    setAppliedAccountIds(pendingAccountIds)
    setAppliedTxTypeFilter(pendingTxTypeFilter)
    setCurrentPage(1)
    setIsFilterDropdownOpen(false)
  }

  const handleServerSearch = () => {
    const normalized = pendingSearchTerm.trim()
    setPendingSearchTerm(normalized)
    setAppliedSearch(normalized)
    setAppliedSearchMode(pendingSearchMode)
    setCurrentPage(1)
  }

  const handleClearServerSearch = () => {
    setPendingSearchTerm('')
    setAppliedSearch('')
    setCurrentPage(1)
  }

  // All-cycles search is submitted, not live, but a match-mode switch made while a search is
  // already on screen is meant to change those rows now: leaving it pending until the next
  // Search press reads as a toggle that does nothing.
  const handlePendingSearchModeChange = (mode: TransactionSearchMode) => {
    setPendingSearchMode(mode)
    if (appliedSearch) {
      setAppliedSearchMode(mode)
      setCurrentPage(1)
    }
  }

  const handleResetFilters = useCallback(() => {
    onClearIncomingFilters?.()
    setSelectedFilters([])
    setSelectedStartDate('')
    setSelectedEndDate('')
    setSelectedMinAmount('')
    setSelectedMaxAmount('')
    setSelectedRecurringFilter('all')
    setSelectedWishlistFilter('all')
    setSelectedReloadFilter('all')
    setSelectedAccountIds([])
    setSelectedTxTypeFilter([])
    setSearchTerm('')
    setPendingSearchTerm('')
    setPendingFilters([])
    setPendingStartDate('')
    setPendingEndDate('')
    setPendingMinAmount('')
    setPendingMaxAmount('')
    setPendingRecurringFilter('all')
    setPendingWishlistFilter('all')
    setPendingReloadFilter('all')
    setPendingAccountIds([])
    setPendingTxTypeFilter([])
    setAppliedFilters([])
    setAppliedStartDate('')
    setAppliedEndDate('')
    setAppliedMinAmount('')
    setAppliedMaxAmount('')
    setAppliedRecurringFilter('all')
    setAppliedWishlistFilter('all')
    setAppliedReloadFilter('all')
    setAppliedAccountIds([])
    setAppliedSearch('')
    setSearchMode('contains')
    setPendingSearchMode('contains')
    setAppliedSearchMode('contains')
    setAppliedTxTypeFilter([])
    setCurrentPage(1)
  }, [onClearIncomingFilters, setCurrentPage])

  useEffect(() => {
    if (!isFilterDropdownOpen) return
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.ledger-filter-dropdown, [data-floating-overlay]')) {
        setIsFilterDropdownOpen(false)
      }
    }
    document.addEventListener('click', handleClick)
    return () => {
      document.removeEventListener('click', handleClick)
    }
  }, [isFilterDropdownOpen])

  return {
    searchTerm, setSearchTerm, searchMode, setSearchMode,
    selectedFilters, setSelectedFilters,
    selectedStartDate, setSelectedStartDate,
    selectedEndDate, setSelectedEndDate,
    selectedMinAmount, setSelectedMinAmount,
    selectedMaxAmount, setSelectedMaxAmount,
    selectedRecurringFilter, setSelectedRecurringFilter,
    selectedWishlistFilter, setSelectedWishlistFilter,
    selectedReloadFilter, setSelectedReloadFilter,
    selectedAccountIds, setSelectedAccountIds,
    selectedTxTypeFilter, setSelectedTxTypeFilter,
    isFilterDropdownOpen, setIsFilterDropdownOpen,
    pendingSearchTerm, setPendingSearchTerm, pendingSearchMode, setPendingSearchMode,
    pendingFilters, setPendingFilters,
    pendingStartDate, setPendingStartDate,
    pendingEndDate, setPendingEndDate,
    pendingMinAmount, setPendingMinAmount,
    pendingMaxAmount, setPendingMaxAmount,
    pendingRecurringFilter, setPendingRecurringFilter,
    pendingWishlistFilter, setPendingWishlistFilter,
    pendingReloadFilter, setPendingReloadFilter,
    pendingAccountIds, setPendingAccountIds,
    pendingTxTypeFilter, setPendingTxTypeFilter,
    appliedSearch, setAppliedSearch, appliedSearchMode, setAppliedSearchMode,
    appliedFilters, setAppliedFilters,
    appliedStartDate, setAppliedStartDate,
    appliedEndDate, setAppliedEndDate,
    appliedMinAmount, setAppliedMinAmount,
    appliedMaxAmount, setAppliedMaxAmount,
    appliedRecurringFilter, setAppliedRecurringFilter,
    appliedWishlistFilter, setAppliedWishlistFilter,
    appliedReloadFilter, setAppliedReloadFilter,
    appliedAccountIds, setAppliedAccountIds,
    appliedTxTypeFilter, setAppliedTxTypeFilter,
    handleToggleFilter,
    handleToggleTxType,
    handleToggleReloadFilter,
    handleToggleAccount,
    handleClearFilters,
    handleApplyFilters,
    handleServerSearch,
    handleClearServerSearch,
    handlePendingSearchModeChange,
    handleResetFilters,
  }
}
