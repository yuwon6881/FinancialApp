import { useState, useEffect, useCallback } from 'react'
import type { TransactionLinkFilter } from '../../../lib/transactionFilters'
import { ledgerRouteSearch, updateAppSearch, type LedgerRouteRange } from '../../../lib/appLocation'
import {
  LEDGER_BUCKETS,
  type LedgerTxType,
} from './ledgerViewTypes'

export interface UseLedgerFiltersOptions {
  categories: any[]
  incomingCategory?: string | null
  incomingFilters?: string[]
  incomingSearch?: string | null
  incomingDate?: string | null
  incomingStartDate?: string | null
  incomingEndDate?: string | null
  incomingMinAmount?: string | null
  incomingMaxAmount?: string | null
  incomingRecurringFilter?: TransactionLinkFilter
  incomingWishlistFilter?: TransactionLinkFilter
  incomingTxType?: LedgerTxType
  highlightedTxId?: string | null
  showAllCycles: boolean
  cyclesRange?: 'monthly' | '3month' | '6month' | 'yearly'
  onClearIncomingFilters?: () => void
  onRouteStateChange?: (state: {
    filters: string[]
    search: string
    startDate: string
    endDate: string
    minAmount: string
    maxAmount: string
    recurringFilter: TransactionLinkFilter
    wishlistFilter: TransactionLinkFilter
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
    incomingDate,
    incomingStartDate,
    incomingEndDate,
    incomingMinAmount,
    incomingMaxAmount,
    incomingRecurringFilter,
    incomingWishlistFilter,
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

  const [searchTerm, setSearchTerm] = useState(incomingSearch || '')
  const [selectedFilters, setSelectedFilters] = useState<string[]>(initialFilters)
  const [selectedStartDate, setSelectedStartDate] = useState(initialStartDate)
  const [selectedEndDate, setSelectedEndDate] = useState(initialEndDate)
  const [selectedMinAmount, setSelectedMinAmount] = useState(incomingMinAmount || '')
  const [selectedMaxAmount, setSelectedMaxAmount] = useState(incomingMaxAmount || '')
  const [selectedRecurringFilter, setSelectedRecurringFilter] = useState<TransactionLinkFilter>(initialRecurringFilter)
  const [selectedWishlistFilter, setSelectedWishlistFilter] = useState<TransactionLinkFilter>(initialWishlistFilter)
  const [selectedTxTypeFilter, setSelectedTxTypeFilter] = useState<LedgerTxType>(incomingTxType || null)
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false)

  const [pendingSearchTerm, setPendingSearchTerm] = useState(incomingSearch || '')
  const [pendingFilters, setPendingFilters] = useState<string[]>(initialFilters)
  const [pendingStartDate, setPendingStartDate] = useState(initialStartDate)
  const [pendingEndDate, setPendingEndDate] = useState(initialEndDate)
  const [pendingMinAmount, setPendingMinAmount] = useState(incomingMinAmount || '')
  const [pendingMaxAmount, setPendingMaxAmount] = useState(incomingMaxAmount || '')
  const [pendingRecurringFilter, setPendingRecurringFilter] = useState<TransactionLinkFilter>(initialRecurringFilter)
  const [pendingWishlistFilter, setPendingWishlistFilter] = useState<TransactionLinkFilter>(initialWishlistFilter)
  const [pendingTxTypeFilter, setPendingTxTypeFilter] = useState<LedgerTxType>(incomingTxType || null)

  const [appliedSearch, setAppliedSearch] = useState(incomingSearch || '')
  const [appliedFilters, setAppliedFilters] = useState<string[]>(initialFilters)
  const [appliedStartDate, setAppliedStartDate] = useState(initialStartDate)
  const [appliedEndDate, setAppliedEndDate] = useState(initialEndDate)
  const [appliedMinAmount, setAppliedMinAmount] = useState(incomingMinAmount || '')
  const [appliedMaxAmount, setAppliedMaxAmount] = useState(incomingMaxAmount || '')
  const [appliedRecurringFilter, setAppliedRecurringFilter] = useState<TransactionLinkFilter>(initialRecurringFilter)
  const [appliedWishlistFilter, setAppliedWishlistFilter] = useState<TransactionLinkFilter>(initialWishlistFilter)
  const [appliedTxTypeFilter, setAppliedTxTypeFilter] = useState<LedgerTxType>(incomingTxType || null)

  const incomingFilterSignature = JSON.stringify([
    initialFilters, incomingSearch || '', initialStartDate, initialEndDate,
    incomingMinAmount || '', incomingMaxAmount || '',
    initialRecurringFilter, initialWishlistFilter, incomingTxType || null,
  ])
  const [appliedIncomingSignature, setAppliedIncomingSignature] = useState(incomingFilterSignature)
  if (appliedIncomingSignature !== incomingFilterSignature) {
    setAppliedIncomingSignature(incomingFilterSignature)
    setSearchTerm(incomingSearch || '')
    setSelectedFilters(initialFilters)
    setSelectedStartDate(initialStartDate)
    setSelectedEndDate(initialEndDate)
    setSelectedMinAmount(incomingMinAmount || '')
    setSelectedMaxAmount(incomingMaxAmount || '')
    setSelectedRecurringFilter(initialRecurringFilter)
    setSelectedWishlistFilter(initialWishlistFilter)
    setSelectedTxTypeFilter(incomingTxType || null)
    setPendingSearchTerm(incomingSearch || '')
    setPendingFilters(initialFilters)
    setPendingStartDate(initialStartDate)
    setPendingEndDate(initialEndDate)
    setPendingMinAmount(incomingMinAmount || '')
    setPendingMaxAmount(incomingMaxAmount || '')
    setPendingRecurringFilter(initialRecurringFilter)
    setPendingWishlistFilter(initialWishlistFilter)
    setPendingTxTypeFilter(incomingTxType || null)
    setAppliedSearch(incomingSearch || '')
    setAppliedFilters(initialFilters)
    setAppliedStartDate(initialStartDate)
    setAppliedEndDate(initialEndDate)
    setAppliedMinAmount(incomingMinAmount || '')
    setAppliedMaxAmount(incomingMaxAmount || '')
    setAppliedRecurringFilter(initialRecurringFilter)
    setAppliedWishlistFilter(initialWishlistFilter)
    setAppliedTxTypeFilter(incomingTxType || null)
    if (!highlightedTxId) {
      setCurrentPage(1)
    }
  }

  // Keep the visible ledger state addressable
  useEffect(() => {
    if (typeof window === 'undefined' || window.location.pathname !== '/ledger') return
    const routeState = showAllCycles
      ? {
          filters: appliedFilters,
          search: appliedSearch,
          startDate: appliedStartDate,
          endDate: appliedEndDate,
          minAmount: appliedMinAmount,
          maxAmount: appliedMaxAmount,
          recurringFilter: appliedRecurringFilter,
          wishlistFilter: appliedWishlistFilter,
          txType: appliedTxTypeFilter,
        }
      : {
          filters: selectedFilters,
          search: searchTerm,
          startDate: selectedStartDate,
          endDate: selectedEndDate,
          minAmount: selectedMinAmount,
          maxAmount: selectedMaxAmount,
          recurringFilter: selectedRecurringFilter,
          wishlistFilter: selectedWishlistFilter,
          txType: selectedTxTypeFilter,
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
  }, [showAllCycles, cyclesRange, highlightedTxId, searchTerm, selectedFilters, selectedStartDate, selectedEndDate, selectedMinAmount, selectedMaxAmount, selectedRecurringFilter, selectedWishlistFilter, selectedTxTypeFilter, appliedSearch, appliedFilters, appliedStartDate, appliedEndDate, appliedMinAmount, appliedMaxAmount, appliedRecurringFilter, appliedWishlistFilter, appliedTxTypeFilter, onRouteStateChange])

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

  const handleClearFilters = () => {
    if (showAllCycles) {
      setPendingFilters([])
      setPendingStartDate('')
      setPendingEndDate('')
      setPendingMinAmount('')
      setPendingMaxAmount('')
      setPendingRecurringFilter('all')
      setPendingWishlistFilter('all')
      setPendingTxTypeFilter(null)
      setAppliedFilters([])
      setAppliedStartDate('')
      setAppliedEndDate('')
      setAppliedMinAmount('')
      setAppliedMaxAmount('')
      setAppliedRecurringFilter('all')
      setAppliedWishlistFilter('all')
      setAppliedTxTypeFilter(null)
      setCurrentPage(1)
    } else {
      setSelectedFilters([])
      setSelectedStartDate('')
      setSelectedEndDate('')
      setSelectedMinAmount('')
      setSelectedMaxAmount('')
      setSelectedRecurringFilter('all')
      setSelectedWishlistFilter('all')
      setSelectedTxTypeFilter(null)
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
    setAppliedTxTypeFilter(pendingTxTypeFilter)
    setCurrentPage(1)
    setIsFilterDropdownOpen(false)
  }

  const handleServerSearch = () => {
    const normalized = pendingSearchTerm.trim()
    setPendingSearchTerm(normalized)
    setAppliedSearch(normalized)
    setCurrentPage(1)
  }

  const handleClearServerSearch = () => {
    setPendingSearchTerm('')
    setAppliedSearch('')
    setCurrentPage(1)
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
    setSelectedTxTypeFilter(null)
    setSearchTerm('')
    setPendingSearchTerm('')
    setPendingFilters([])
    setPendingStartDate('')
    setPendingEndDate('')
    setPendingMinAmount('')
    setPendingMaxAmount('')
    setPendingRecurringFilter('all')
    setPendingWishlistFilter('all')
    setPendingTxTypeFilter(null)
    setAppliedFilters([])
    setAppliedStartDate('')
    setAppliedEndDate('')
    setAppliedMinAmount('')
    setAppliedMaxAmount('')
    setAppliedRecurringFilter('all')
    setAppliedWishlistFilter('all')
    setAppliedSearch('')
    setAppliedTxTypeFilter(null)
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
    searchTerm, setSearchTerm,
    selectedFilters, setSelectedFilters,
    selectedStartDate, setSelectedStartDate,
    selectedEndDate, setSelectedEndDate,
    selectedMinAmount, setSelectedMinAmount,
    selectedMaxAmount, setSelectedMaxAmount,
    selectedRecurringFilter, setSelectedRecurringFilter,
    selectedWishlistFilter, setSelectedWishlistFilter,
    selectedTxTypeFilter, setSelectedTxTypeFilter,
    isFilterDropdownOpen, setIsFilterDropdownOpen,
    pendingSearchTerm, setPendingSearchTerm,
    pendingFilters, setPendingFilters,
    pendingStartDate, setPendingStartDate,
    pendingEndDate, setPendingEndDate,
    pendingMinAmount, setPendingMinAmount,
    pendingMaxAmount, setPendingMaxAmount,
    pendingRecurringFilter, setPendingRecurringFilter,
    pendingWishlistFilter, setPendingWishlistFilter,
    pendingTxTypeFilter, setPendingTxTypeFilter,
    appliedSearch, setAppliedSearch,
    appliedFilters, setAppliedFilters,
    appliedStartDate, setAppliedStartDate,
    appliedEndDate, setAppliedEndDate,
    appliedMinAmount, setAppliedMinAmount,
    appliedMaxAmount, setAppliedMaxAmount,
    appliedRecurringFilter, setAppliedRecurringFilter,
    appliedWishlistFilter, setAppliedWishlistFilter,
    appliedTxTypeFilter, setAppliedTxTypeFilter,
    handleToggleFilter,
    handleClearFilters,
    handleApplyFilters,
    handleServerSearch,
    handleClearServerSearch,
    handleResetFilters,
  }
}
