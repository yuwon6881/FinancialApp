import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import type { Transaction } from '../../../types'
import type { PagedTransactionResult } from '../../../lib/api'
import { getCycleRangeDates, getStartOfNCyclesAgo, formatDateForApi } from '../../../lib/cycle'
import { getCycleLabelForDropdown } from '../../../lib/cycleLabels'
import { matchesTransactionFilters, splitFilterSelections } from '../../../lib/transactionFilters'
import { downloadCsvBlob, downloadCsvRows, toFilename } from '../../../lib/csvExport'
import { lockBodyScroll, unlockBodyScroll } from '../../../lib/scrollLock'
import { compareTransactionsNewestFirst, mergeTransactionsNewestFirst } from '../../../lib/transactionOrdering'

export interface UseLedgerViewOptions {
  transactions: Transaction[]
  categories: any[]
  selectedMonth: string
  selectedYear: number
  cycleDay: number
  incomingCategory?: string | null | undefined
  incomingSearch?: string | null | undefined
  incomingDate?: string | null | undefined
  incomingTxType?: 'inflow' | 'outflow' | 'transfer' | null | undefined
  highlightedTxId?: string | null | undefined
  onClearIncomingFilters?: () => void
  showAllCycles: boolean
  onClearAllCycles: () => void
  cyclesRange?: 'monthly' | '3month' | '6month' | 'yearly'
  onFetchPagedTransactions?: (params: any) => Promise<PagedTransactionResult>
  onExportTransactions?: (params: any) => Promise<{ blob: Blob; filename: string }>
  onShowAlert?: (message: string, title?: string) => void
  activeSyncId?: string | null
  deletingTxId?: string | null
  onDeleteTransaction: (id: string) => Promise<void> | void
  onAiExportRequestConsumed?: () => void
  aiExportRequest?: any
  hideSensitive: boolean
  formRef: React.RefObject<any>
}

const LEDGER_BUCKETS = ['Essentials', 'Growth', 'Stability', 'Rewards', 'Income']

export function useLedgerView(options: UseLedgerViewOptions) {
  const {
    transactions,
    categories,
    selectedMonth,
    selectedYear,
    cycleDay,
    incomingCategory,
    incomingSearch,
    incomingDate,
    incomingTxType,
    highlightedTxId,
    onClearIncomingFilters,
    showAllCycles,
    onClearAllCycles,
    cyclesRange,
    onFetchPagedTransactions,
    onExportTransactions,
    onShowAlert,
    activeSyncId,
    deletingTxId,
    onDeleteTransaction,
    onAiExportRequestConsumed,
    aiExportRequest,
    hideSensitive,
    formRef,
  } = options

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedFilters, setSelectedFilters] = useState<string[]>([])
  const [selectedDateFilter, setSelectedDateFilter] = useState<string | null>(null)
  const [selectedTxTypeFilter, setSelectedTxTypeFilter] = useState<'inflow' | 'outflow' | 'transfer' | null>(null)
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false)

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Server-side state
  const [serverResult, setServerResult] = useState<PagedTransactionResult | null>(null)
  const [serverIsFetching, setServerIsFetching] = useState(false)
  const isInitialFetchDone = useRef(false)
  const fetchSequenceRef = useRef(0)
  const fetchAbortRef = useRef<AbortController | null>(null)
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportIsFetching, setExportIsFetching] = useState(false)

  const [pendingSearchTerm, setPendingSearchTerm] = useState('')
  const [pendingFilters, setPendingFilters] = useState<string[]>([])
  const [appliedSearch, setAppliedSearch] = useState('')
  const [appliedFilters, setAppliedFilters] = useState<string[]>([])
  const [appliedTxTypeFilter, setAppliedTxTypeFilter] = useState<'inflow' | 'outflow' | 'transfer' | null>(null)

  // Delete transaction state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null)
  const [showEditDisabledModal, setShowEditDisabledModal] = useState(false)

  // Synchronize AI export requests
  useEffect(() => {
    if (!aiExportRequest) return
    if (!hideSensitive) setShowExportModal(true)
    onAiExportRequestConsumed?.()
  }, [aiExportRequest?.nonce, hideSensitive, onAiExportRequestConsumed])

  const allCyclesRange = useMemo(() => {
    if (!showAllCycles) return null
    if (!cyclesRange || cyclesRange === 'monthly') return null
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const activeMonthIdx = monthNames.indexOf(selectedMonth) + 1
    if (activeMonthIdx <= 0) return null
    const activeYear = selectedYear

    let startDate: Date | null = null
    let endDate: Date | null = null

    if (cyclesRange === '3month') {
      startDate = getStartOfNCyclesAgo(activeYear, activeMonthIdx, cycleDay, 3)
      endDate = getCycleRangeDates(activeYear, activeMonthIdx, cycleDay).end
    } else if (cyclesRange === '6month') {
      startDate = getStartOfNCyclesAgo(activeYear, activeMonthIdx, cycleDay, 6)
      endDate = getCycleRangeDates(activeYear, activeMonthIdx, cycleDay).end
    } else if (cyclesRange === 'yearly') {
      startDate = getCycleRangeDates(activeYear, 1, cycleDay).start
      endDate = getCycleRangeDates(activeYear, 12, cycleDay).end
    }

    if (!startDate || !endDate) return null
    return {
      startDate: formatDateForApi(startDate),
      endDate: formatDateForApi(endDate)
    }
  }, [showAllCycles, cyclesRange, selectedMonth, selectedYear, cycleDay])

  const [recentlySyncedIds, setRecentlySyncedIds] = useState<Set<string>>(new Set())

  const runServerFetch = useCallback(async (opts: {
    page: number
    search: string
    filters: string[]
    txType: 'inflow' | 'outflow' | 'transfer' | null
    pSize: number
  }) => {
    if (!onFetchPagedTransactions) return
    const sequence = ++fetchSequenceRef.current
    fetchAbortRef.current?.abort()
    const controller = new AbortController()
    fetchAbortRef.current = controller
    setServerIsFetching(true)
    try {
      const buckets = opts.filters.filter(f => LEDGER_BUCKETS.includes(f))
      const cats = opts.filters.filter(f => !LEDGER_BUCKETS.includes(f))
      const result = await onFetchPagedTransactions({
        page: opts.page,
        pageSize: opts.pSize,
        search: opts.search || undefined,
        ledgerCategories: buckets.length > 0 ? buckets : undefined,
        categories: cats.length > 0 ? cats : undefined,
        txType: opts.txType || null,
        startDate: allCyclesRange?.startDate,
        endDate: allCyclesRange?.endDate,
        signal: controller.signal,
      })
      if (sequence !== fetchSequenceRef.current || controller.signal.aborted) return
      setServerResult(result)
      setRecentlySyncedIds(new Set())
    } catch (error) {
      if (!controller.signal.aborted) throw error
    } finally {
      if (sequence === fetchSequenceRef.current) setServerIsFetching(false)
    }
  }, [onFetchPagedTransactions, allCyclesRange])

  useEffect(() => () => fetchAbortRef.current?.abort(), [])

  // Trigger initial server fetch when entering all-cycles mode
  useEffect(() => {
    if (showAllCycles && onFetchPagedTransactions) {
      const initialFilters = incomingCategory ? [incomingCategory] : []
      const initialTxType = incomingTxType || null
      const initialSearch = incomingSearch || ''

      setPendingSearchTerm(initialSearch)
      setPendingFilters(initialFilters)
      setAppliedSearch(initialSearch)
      setAppliedFilters(initialFilters)
      setAppliedTxTypeFilter(initialTxType)
      setCurrentPage(1)
      setPageSize(100)
      isInitialFetchDone.current = false
      runServerFetch({ page: 1, search: initialSearch, filters: initialFilters, txType: initialTxType, pSize: 100 })
        .finally(() => {
          isInitialFetchDone.current = true
        })
    } else {
      setServerResult(null)
      isInitialFetchDone.current = false
    }
  }, [showAllCycles, onFetchPagedTransactions, runServerFetch, allCyclesRange, incomingCategory, incomingTxType, incomingSearch])

  // Re-fetch when page changes in server mode
  useEffect(() => {
    if (showAllCycles && onFetchPagedTransactions && isInitialFetchDone.current) {
      runServerFetch({ page: currentPage, search: appliedSearch, filters: appliedFilters, txType: appliedTxTypeFilter, pSize: pageSize })
    }
  }, [currentPage, pageSize, showAllCycles, onFetchPagedTransactions, runServerFetch, appliedSearch, appliedFilters, appliedTxTypeFilter, allCyclesRange])

  // Re-fetch server result when activeSyncId transitions from non-null to null (sync completed)
  const prevActiveSyncId = useRef<string | null>(null)
  useEffect(() => {
    if (prevActiveSyncId.current !== null && prevActiveSyncId.current !== activeSyncId) {
      const finishedId = prevActiveSyncId.current
      setRecentlySyncedIds(prev => {
        const next = new Set(prev)
        next.add(finishedId)
        return next
      })
    }
    if (showAllCycles && prevActiveSyncId.current !== null && activeSyncId === null && onFetchPagedTransactions && isInitialFetchDone.current) {
      runServerFetch({ page: currentPage, search: appliedSearch, filters: appliedFilters, txType: appliedTxTypeFilter, pSize: pageSize })
    }
    prevActiveSyncId.current = activeSyncId || null
  }, [activeSyncId, showAllCycles, currentPage, appliedSearch, appliedFilters, appliedTxTypeFilter, pageSize, onFetchPagedTransactions, runServerFetch])

  // Reset back to page 1 when search inputs or active filters are updated (client-side mode only)
  useEffect(() => {
    if (!showAllCycles) setCurrentPage(1)
  }, [searchTerm, selectedFilters, selectedDateFilter, selectedTxTypeFilter, showAllCycles])

  // Synchronize incoming filters from props
  useEffect(() => {
    if (incomingCategory) {
      setSelectedFilters([incomingCategory])
    } else {
      setSelectedFilters([])
    }
  }, [incomingCategory])

  useEffect(() => {
    setSearchTerm(incomingSearch || '')
  }, [incomingSearch])

  useEffect(() => {
    setSelectedDateFilter(incomingDate || null)
  }, [incomingDate])

  useEffect(() => {
    setSelectedTxTypeFilter(incomingTxType || null)
  }, [incomingTxType])

  // Toggle filter on or off
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
      setAppliedFilters([])
      setCurrentPage(1)
    } else {
      setSelectedFilters([])
    }
  }

  const handleApplyFilters = () => {
    setAppliedFilters(pendingFilters)
    setCurrentPage(1)
    setIsFilterDropdownOpen(false)
  }

  const handleServerSearch = () => {
    setAppliedSearch(pendingSearchTerm)
    setCurrentPage(1)
  }

  useEffect(() => {
    if (!isFilterDropdownOpen) return
    lockBodyScroll()
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.ledger-filter-dropdown')) {
        setIsFilterDropdownOpen(false)
      }
    }
    document.addEventListener('click', handleClick)
    return () => {
      unlockBodyScroll()
      document.removeEventListener('click', handleClick)
    }
  }, [isFilterDropdownOpen])

  const handleDeleteClick = (t: Transaction) => {
    if (hideSensitive) return
    setTxToDelete(t)
    setShowDeleteModal(true)
  }

  const handleConfirmDelete = async () => {
    if (!txToDelete) return

    let deleteId = txToDelete.id
    if (txToDelete.id.includes('-split-')) {
      deleteId = txToDelete.id.split('-split-')[0]
    }

    setShowDeleteModal(false)
    setTxToDelete(null)

    await onDeleteTransaction(deleteId)
  }

  const handleCancelDelete = () => {
    setShowDeleteModal(false)
    setTxToDelete(null)
  }

  const isTxDeleting = useCallback((txId: string) => {
    const txObj = transactions.find(t => t.id === txId)
    if (txObj && txObj.isPendingDelete) return true
    if (!deletingTxId) return false
    if (txId === deletingTxId) return true
    if (txId.startsWith(`${deletingTxId}-split-`)) return true
    if (txId.includes('-split-') && txId.split('-split-')[0] === deletingTxId) return true
    return false
  }, [deletingTxId, transactions])

  const isTxSyncing = useCallback((txId: string) => {
    if (!activeSyncId) return false
    if (txId === activeSyncId) return true
    if (txId === `wishlist-purchase-${activeSyncId}`) return true
    if (txId.startsWith(`${activeSyncId}-split-`)) return true
    if (txId.includes('-split-') && txId.split('-split-')[0] === activeSyncId) return true
    return false
  }, [activeSyncId])

  const pendingTransactions = useMemo(() => {
    return transactions.filter(t => t.isPendingSync || recentlySyncedIds.has(String(t.id)))
  }, [transactions, recentlySyncedIds])

  const filteredPendingTransactions = useMemo(() => {
    if (!showAllCycles) return []

    const { buckets: selectedBuckets, categories: selectedCategories } = splitFilterSelections(appliedFilters)

    return pendingTransactions.filter(t => {
      if (allCyclesRange) {
        const txDate = new Date(t.date)
        const startLimit = new Date(allCyclesRange.startDate)
        const endLimit = new Date(allCyclesRange.endDate)
        startLimit.setHours(0, 0, 0, 0)
        endLimit.setHours(23, 59, 59, 999)
        if (txDate < startLimit || txDate > endLimit) return false
      }

      return matchesTransactionFilters(t, {
        search: appliedSearch,
        buckets: selectedBuckets,
        categories: selectedCategories,
        txType: appliedTxTypeFilter,
      })
    }).sort(compareTransactionsNewestFirst)
  }, [pendingTransactions, showAllCycles, appliedSearch, appliedFilters, appliedTxTypeFilter, allCyclesRange])

  const filteredTransactions = useMemo(() => {
    const { buckets: selectedBuckets, categories: selectedCategories } = splitFilterSelections(selectedFilters)

    return transactions.filter(t => {
      if (selectedDateFilter && t.date !== selectedDateFilter) return false

      return matchesTransactionFilters(t, {
        search: searchTerm,
        buckets: selectedBuckets,
        categories: selectedCategories,
        txType: selectedTxTypeFilter,
      })
    }).sort(compareTransactionsNewestFirst)
  }, [transactions, searchTerm, selectedFilters, selectedDateFilter, selectedTxTypeFilter])

  const paginatedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    return filteredTransactions.slice(startIndex, startIndex + pageSize)
  }, [filteredTransactions, currentPage, pageSize])

  const displayTransactions = useMemo(() => {
    if (showAllCycles && serverResult) {
      return mergeTransactionsNewestFirst(serverResult.items, filteredPendingTransactions)
    }
    return paginatedTransactions
  }, [showAllCycles, serverResult, filteredPendingTransactions, paginatedTransactions])

  const totalPages = Math.ceil(filteredTransactions.length / pageSize) || 1

  useEffect(() => {
    if (!showAllCycles && currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [totalPages, showAllCycles, currentPage])

  // Handle highlighted transaction scroll into view and page calculation
  useEffect(() => {
    if (highlightedTxId) {
      const index = filteredTransactions.findIndex(t => t.id === highlightedTxId)
      if (index !== -1) {
        const targetPage = Math.floor(index / pageSize) + 1
        setCurrentPage(targetPage)

        let clearTimer: ReturnType<typeof setTimeout> | undefined
        const timer = setTimeout(() => {
          const rowEl = document.getElementById(`tx-row-${highlightedTxId}`)
          if (rowEl) {
            rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
            rowEl.classList.add('bg-blue-500/10', 'ring-2', 'ring-blue-500/30', 'dark:bg-blue-500/20')
            clearTimer = setTimeout(() => {
              rowEl.classList.remove('bg-blue-500/10', 'ring-2', 'ring-blue-500/30', 'dark:bg-blue-500/20')
              onClearIncomingFilters?.()
            }, 3000)
          }
        }, 300)
        return () => {
          clearTimeout(timer)
          if (clearTimer) clearTimeout(clearTimer)
          const rowEl = document.getElementById(`tx-row-${highlightedTxId}`)
          rowEl?.classList.remove('bg-blue-500/10', 'ring-2', 'ring-blue-500/30', 'dark:bg-blue-500/20')
        }
      }
    }
  }, [highlightedTxId, filteredTransactions, pageSize, onClearIncomingFilters])

  const handleDeleteClickRef = useRef(handleDeleteClick)
  useEffect(() => {
    handleDeleteClickRef.current = handleDeleteClick
  })
  const onStartEditStable = useCallback((t: Transaction) => formRef.current?.handleStartEdit(t), [formRef])
  const onDeleteClickStable = useCallback((t: Transaction) => handleDeleteClickRef.current(t), [])
  const onSplitEditBlockedStable = useCallback(() => setShowEditDisabledModal(true), [])

  const handleResetFilters = useCallback(() => {
    onClearIncomingFilters?.()
    onClearAllCycles()
    setSelectedFilters([])
    setSelectedDateFilter(null)
    setSelectedTxTypeFilter(null)
    setSearchTerm('')
    setPendingFilters([])
    setAppliedFilters([])
    setAppliedSearch('')
    setAppliedTxTypeFilter(null)
    setCurrentPage(1)
  }, [onClearIncomingFilters, onClearAllCycles])

  const getCycleRangeLabel = () => {
    if (cyclesRange === '3month') return 'Last 3 Cycles'
    if (cyclesRange === '6month') return 'Last 6 Cycles'
    if (cyclesRange === 'yearly') return `Full Year ${selectedYear}`
    return ''
  }

  const buildFilterLabel = () => {
    const buckets = appliedFilters.filter(f => LEDGER_BUCKETS.includes(f))
    const cats = appliedFilters.filter(f => !LEDGER_BUCKETS.includes(f))
    const categoryFilters = [...buckets, ...cats]
    const parts: string[] = []
    if (categoryFilters.length > 0) {
      const label = categoryFilters.join(' + ')
      parts.push(`${label} ${categoryFilters.length > 1 ? 'Categories' : 'Category'}`)
    }
    if (appliedTxTypeFilter) {
      parts.push(appliedTxTypeFilter === 'inflow' ? 'Inflows' : appliedTxTypeFilter === 'outflow' ? 'Outflows' : 'Transfers')
    }
    if (appliedSearch) {
      parts.push(`Search ${appliedSearch}`)
    }
    return parts.join(' ')
  }

  const getExportAllFilename = () => {
    if (!showAllCycles) {
      const cycleLabel = getCycleLabelForDropdown(selectedMonth, selectedYear, cycleDay)
      return `${toFilename(cycleLabel)}.csv`
    }

    const rangeLabel = getCycleRangeLabel()
    const filterLabel = buildFilterLabel()
    const title = rangeLabel
      ? (filterLabel ? `${rangeLabel} ${filterLabel} Records` : `${rangeLabel} Records`)
      : (filterLabel ? `All ${filterLabel} Records` : 'All Records')
    return `${toFilename(title)}.csv`
  }

  const getPageExportFilename = (rows: Transaction[]) => {
    if (rows.length === 0) {
      return `Ledger_Page_${currentPage}.csv`
    }
    const dates = rows.map(r => r.date)
    let minDate = dates[0]
    let maxDate = dates[0]
    for (const d of dates) {
      if (d < minDate) minDate = d
      if (d > maxDate) maxDate = d
    }
    const label = minDate === maxDate ? minDate : `${minDate}_to_${maxDate}`
    return `${toFilename(label)}.csv`
  }

  const handleExportPage = () => {
    if (hideSensitive) return
    const rows = showAllCycles && serverResult ? displayTransactions : paginatedTransactions
    downloadCsvRows(rows, getPageExportFilename(rows))
    setShowExportModal(false)
  }

  const handleExportAll = async () => {
    if (hideSensitive) return
    if (showAllCycles && serverResult && onExportTransactions) {
      setExportIsFetching(true)
      try {
        const buckets = appliedFilters.filter(f => LEDGER_BUCKETS.includes(f))
        const cats = appliedFilters.filter(f => !LEDGER_BUCKETS.includes(f))
        const result = await onExportTransactions({
          search: appliedSearch || undefined,
          ledgerCategories: buckets.length > 0 ? buckets : undefined,
          categories: cats.length > 0 ? cats : undefined,
          txType: appliedTxTypeFilter || null,
          startDate: allCyclesRange?.startDate,
          endDate: allCyclesRange?.endDate
        })
        downloadCsvBlob(result.blob, getExportAllFilename())
        setShowExportModal(false)
      } catch (err) {
        console.error(err)
        onShowAlert?.('Failed to export transactions.', 'Export Error')
      } finally {
        setExportIsFetching(false)
      }
      return
    }
    downloadCsvRows(filteredTransactions, getExportAllFilename())
    setShowExportModal(false)
  }

  return {
    searchTerm,
    setSearchTerm,
    selectedFilters,
    setSelectedFilters,
    selectedDateFilter,
    setSelectedDateFilter,
    selectedTxTypeFilter,
    setSelectedTxTypeFilter,
    isFilterDropdownOpen,
    setIsFilterDropdownOpen,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    serverResult,
    serverIsFetching,
    showExportModal,
    setShowExportModal,
    exportIsFetching,
    pendingSearchTerm,
    setPendingSearchTerm,
    pendingFilters,
    setPendingFilters,
    appliedSearch,
    appliedFilters,
    appliedTxTypeFilter,
    showDeleteModal,
    txToDelete,
    showEditDisabledModal,
    setShowEditDisabledModal,
    displayTransactions,
    totalPages,
    filteredTransactions,
    isTxDeleting,
    isTxSyncing,
    onStartEditStable,
    onDeleteClickStable,
    onSplitEditBlockedStable,
    handleToggleFilter,
    handleClearFilters,
    handleApplyFilters,
    handleServerSearch,
    handleDeleteClick,
    handleConfirmDelete,
    handleCancelDelete,
    handleExportPage,
    handleExportAll,
    handleResetFilters,
  }
}
