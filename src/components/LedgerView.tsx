import { useState, useMemo, useEffect, useCallback, useRef } from 'react'

import type { Transaction, TransactionCategory } from '../types'
import type { PagedTransactionResult } from '../lib/api'
import type { ReceiptScanResult } from '../lib/api'
import { Plus, Download, X } from 'lucide-react'
import { CustomSelect } from './ui/CustomSelect'
import { CycleSkeleton } from './ui/Skeleton'
import { Button } from './ui/Button'
import { Card } from './ui/Card'
import { lockBodyScroll, unlockBodyScroll } from '../lib/scrollLock'
import { formatCurrencyVal } from '../lib/utils'
import { downloadCsvBlob, downloadCsvRows, toFilename } from '../lib/csvExport'
import { useIsMobile } from '../lib/useIsMobile'
import { getCycleRangeDates, getStartOfNCyclesAgo, formatDateForApi } from '../lib/cycle'
import { getCycleLabelForDropdown, ordinal } from '../lib/cycleLabels'
import { matchesTransactionFilters, splitFilterSelections } from '../lib/transactionFilters'
import { calculateLedgerTotals } from '../lib/ledgerTotals'
import { useAppContext } from '../contexts/AppContext'
import { LedgerExportModal } from './ledger/LedgerExportModal'
import { DeleteTransactionModal, EditDisabledModal } from './ledger/LedgerDeleteModals'
import { LedgerPagination } from './ledger/LedgerPagination'
import { LedgerFilterBar } from './ledger/LedgerFilterBar'
import { LedgerTransactionList } from './ledger/LedgerTransactionList'
import { TransactionFormSheet, type TransactionFormHandle } from './ledger/TransactionFormSheet'

const transactionSortKey = (t: Transaction) => t.postedAt || `${t.date}T00:00:00.000Z`

const LEDGER_BUCKETS = ['Essentials', 'Growth', 'Stability', 'Rewards', 'Income']

interface LedgerViewProps {
  transactions: Transaction[]
  autocompleteSuggestions?: import('../types').AutocompleteSuggestion[]
  onAddTransaction: (transaction: Omit<Transaction, 'id'>) => Promise<void> | void
  onDeleteTransaction: (id: string) => Promise<void> | void
  onUpdateTransaction?: (id: string, transaction: Omit<Transaction, 'id'>) => Promise<void> | void
  hideSensitive?: boolean
  categories: TransactionCategory[]
  selectedMonth: string
  selectedYear: number
  availableYears: number[]
  cycleDay: number
  onSelectPeriod: (month: string, year: number) => void
  incomingCategory: string | null
  incomingSearch?: string | null
  incomingDate?: string | null
  incomingTxType?: 'inflow' | 'outflow' | 'transfer' | null
  highlightedTxId?: string | null
  onClearIncomingFilters?: () => void
  showAllCycles: boolean
  onClearAllCycles: () => void
  cyclesRange?: 'monthly' | '3month' | '6month' | 'yearly'
  currency?: string
  autoOpenAddForm?: boolean
  onResetAutoOpen?: () => void
  stabilityBalance?: number
  stabilityTarget?: number
  essentialsAlloc?: number
  growthAlloc?: number
  stabilityAlloc?: number
  rewardsAlloc?: number
  stabilityOverflowRedirect?: string
  onFetchPagedTransactions?: (params: {
    page: number
    pageSize: number
    search?: string
    ledgerCategories?: string[]
    categories?: string[]
    txType?: 'inflow' | 'outflow' | 'transfer' | null
    startDate?: string
    endDate?: string
  }) => Promise<PagedTransactionResult>
  onFetchTransactionById?: (id: string) => Promise<Transaction>
  onExportTransactions?: (params: {
    search?: string
    ledgerCategories?: string[]
    categories?: string[]
    txType?: 'inflow' | 'outflow' | 'transfer' | null
    startDate?: string
    endDate?: string
  }) => Promise<{ blob: Blob; filename: string }>
  onShowAlert?: (message: string, title?: string) => void
  activeSyncId?: string | null
  deletingTxId?: string | null
  onStartEditPending?: (id: string | null) => void
  isSwitchingCycle?: boolean
  receiptScanDraft?: { jobId: string; result: ReceiptScanResult } | null
  onReceiptScanStarted?: (scanId: string) => void
  onReceiptScanCleared?: (scanId: string) => void | Promise<void>
  onAddFormOpenChange?: (open: boolean) => void
  activeScanJobIds?: string[]
  failedScanJob?: { jobId: string; errorMessage: string } | null
  aiDraft?: { nonce: number; fields: Record<string, unknown> } | null
  aiEditDraft?: { nonce: number; id: string; changes: Record<string, unknown> } | null
  aiExportRequest?: { nonce: number } | null
  onAiDraftConsumed?: () => void
  onAiEditDraftConsumed?: () => void
  onAiExportRequestConsumed?: () => void
}

export const LedgerView: React.FC<LedgerViewProps> = ({
  transactions,
  autocompleteSuggestions = [],
  onAddTransaction,
  onDeleteTransaction,
  onUpdateTransaction,
  hideSensitive: hideSensitiveProp,
  categories,
  selectedMonth,
  selectedYear,
  availableYears,
  cycleDay,
  onSelectPeriod,
  incomingCategory,
  incomingSearch,
  incomingDate,
  incomingTxType,
  highlightedTxId,
  onClearIncomingFilters,
  showAllCycles,
  onClearAllCycles,
  cyclesRange,
  currency: currencyProp,
  autoOpenAddForm,
  onResetAutoOpen,
  stabilityBalance = 0,
  stabilityTarget = 10000,
  essentialsAlloc = 0.5,
  growthAlloc = 0.25,
  stabilityAlloc = 0.15,
  rewardsAlloc = 0.1,
  stabilityOverflowRedirect = 'Split: Growth 50%, Rewards 50%',
  onFetchPagedTransactions,
  onFetchTransactionById,
  onExportTransactions,
  onShowAlert,
  activeSyncId: activeSyncIdProp,
  deletingTxId: deletingTxIdProp,
  onStartEditPending,
  isSwitchingCycle = false,
  receiptScanDraft = null,
  onReceiptScanStarted,
  onReceiptScanCleared,
  onAddFormOpenChange,
  activeScanJobIds = [],
  failedScanJob = null,
  aiDraft = null,
  aiEditDraft = null,
  aiExportRequest = null,
  onAiDraftConsumed,
  onAiEditDraftConsumed,
  onAiExportRequestConsumed
}) => {
  const app = useAppContext()
  const hideSensitive = hideSensitiveProp ?? app.hideSensitive
  const currency = currencyProp ?? app.currency
  const activeSyncId = activeSyncIdProp ?? app.activeSyncId
  const deletingTxId = deletingTxIdProp ?? app.deletingId
  const isMobile = useIsMobile(768)

  // The transaction add/edit form is fully owned by TransactionFormSheet; the
  // parent drives it imperatively (row edit clicks, the header button) and
  // mirrors only its open flag for the header button's label.
  const formRef = useRef<TransactionFormHandle>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const handleAddFormOpenChange = useCallback((open: boolean) => {
    setIsFormOpen(open)
    onAddFormOpenChange?.(open)
  }, [onAddFormOpenChange])

  // Delete + split-edit-blocked modals
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null)
  const [showEditDisabledModal, setShowEditDisabledModal] = useState(false)

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedFilters, setSelectedFilters] = useState<string[]>([])
  const [selectedDateFilter, setSelectedDateFilter] = useState<string | null>(null)
  const [selectedTxTypeFilter, setSelectedTxTypeFilter] = useState<'inflow' | 'outflow' | 'transfer' | null>(null)
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false)

  // Pagination states (Defaults: page size 10, current page 1)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Server-side paged all-cycles state
  const [serverResult, setServerResult] = useState<PagedTransactionResult | null>(null)
  const [serverIsFetching, setServerIsFetching] = useState(false)
  const isInitialFetchDone = useRef(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportIsFetching, setExportIsFetching] = useState(false)
  useEffect(() => {
    if (!aiExportRequest) return
    if (!hideSensitive) setShowExportModal(true)
    onAiExportRequestConsumed?.()
  }, [aiExportRequest?.nonce])
  // Pending (uncommitted) states -- only applied on Search/Apply button click
  const [pendingSearchTerm, setPendingSearchTerm] = useState('')
  const [pendingFilters, setPendingFilters] = useState<string[]>([])
  // Applied (committed) states -- what the backend has actually received
  const [appliedSearch, setAppliedSearch] = useState('')
  const [appliedFilters, setAppliedFilters] = useState<string[]>([])
  const [appliedTxTypeFilter, setAppliedTxTypeFilter] = useState<'inflow' | 'outflow' | 'transfer' | null>(null)

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

  // Transaction ids whose sync op just finished (isPendingSync already false) but
  // whose effect isn't reflected in `serverResult` yet -- that snapshot is a
  // separate fetch (below) that only starts once the whole queue drain finishes,
  // so there's a real gap between "confirmed by server" and "serverResult knows
  // it". Kept covered by the optimistic overlay (see filteredPendingTransactions)
  // until the next successful runServerFetch, instead of dropping out the moment
  // isPendingSync flips and showing whatever stale value serverResult still has.
  const [recentlySyncedIds, setRecentlySyncedIds] = useState<Set<string>>(new Set())

  const runServerFetch = useCallback(async (opts: {
    page: number
    search: string
    filters: string[]
    txType: 'inflow' | 'outflow' | 'transfer' | null
    pSize: number
  }) => {
    if (!onFetchPagedTransactions) return
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
        endDate: allCyclesRange?.endDate
      })
      setServerResult(result)
      // A fresh fetch is authoritative for everything it covers -- whatever was
      // "not yet reconciled" now is, so the overlay can stand down.
      setRecentlySyncedIds(new Set())
    } finally {
      setServerIsFetching(false)
    }
  }, [onFetchPagedTransactions, allCyclesRange])

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
      setPageSize(100)  // Default 100 for server mode -- covers most users' full history on page 1
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
    // activeSyncId moves off an id the instant that op's dispatch finishes (each op
    // in a batch gets its own turn as activeSyncId before the next one starts) --
    // that id's isPendingSync flips false right away, well before serverResult is
    // refetched below. Keep it in the overlay until then.
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
    prevActiveSyncId.current = activeSyncId
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
    const isLedgerCategory = LEDGER_BUCKETS.includes(filterName);
    const groupFilters = isLedgerCategory
      ? LEDGER_BUCKETS
      : categories.map(c => c.name);

    const updateFilterList = (prev: string[]) => {
      let next;
      if (prev.includes(filterName)) {
        next = prev.filter(f => f !== filterName);
      } else {
        next = [...prev, filterName];
      }

      // Check if all filters in the group are now selected
      const groupSelectedCount = next.filter(f => groupFilters.includes(f)).length;
      if (groupSelectedCount === groupFilters.length) {
        // Deselect all filters in this group
        next = next.filter(f => !groupFilters.includes(f));
      }
      return next;
    };

    if (showAllCycles) {
      // In server mode: toggle pending filters only
      setPendingFilters(prev => updateFilterList(prev));
    } else {
      setSelectedFilters(prev => updateFilterList(prev));
    }
  }

  const handleClearFilters = () => {
    if (showAllCycles) {
      setPendingFilters([])
      setAppliedFilters([])
      setCurrentPage(1)
      runServerFetch({ page: 1, search: appliedSearch, filters: [], txType: appliedTxTypeFilter, pSize: pageSize })
    } else {
      setSelectedFilters([])
    }
  }

  const handleApplyFilters = () => {
    setAppliedFilters(pendingFilters)
    setCurrentPage(1)
    setIsFilterDropdownOpen(false)
    runServerFetch({ page: 1, search: appliedSearch, filters: pendingFilters, txType: appliedTxTypeFilter, pSize: pageSize })
  }

  const handleServerSearch = () => {
    setAppliedSearch(pendingSearchTerm)
    setCurrentPage(1)
    runServerFetch({ page: 1, search: pendingSearchTerm, filters: appliedFilters, txType: appliedTxTypeFilter, pSize: pageSize })
  }

  // Toggle dropdown on click out & lock body scrolling while filter dropdown is open.
  // Uses the shared ref-counted lock so it composes with the mobile filter
  // BottomSheet (same open flag) instead of fighting it over body styles.
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

  const sourceTransactions = useMemo(() => transactions, [transactions])

  const pendingTransactions = useMemo(() => {
    return transactions.filter(t => t.isPendingSync || recentlySyncedIds.has(String(t.id)))
  }, [transactions, recentlySyncedIds])

  const filteredPendingTransactions = useMemo(() => {
    if (!showAllCycles) return []

    const { buckets: selectedBuckets, categories: selectedCategories } = splitFilterSelections(appliedFilters)

    return pendingTransactions.filter(t => {
      // Date range filter (specific to the all-cycles list)
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
    }).sort((a, b) => {
      const dateDiff = transactionSortKey(b).localeCompare(transactionSortKey(a))
      if (dateDiff !== 0) return dateDiff
      return b.id.localeCompare(a.id)
    })
  }, [pendingTransactions, showAllCycles, appliedSearch, appliedFilters, appliedTxTypeFilter, allCyclesRange])

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    // Group filters by their type (Ledger Categories vs Categories)
    const { buckets: selectedBuckets, categories: selectedCategories } = splitFilterSelections(selectedFilters)

    return sourceTransactions.filter(t => {
      // Exact-day date filter (specific to the current-cycle list)
      if (selectedDateFilter && t.date !== selectedDateFilter) return false

      return matchesTransactionFilters(t, {
        search: searchTerm,
        buckets: selectedBuckets,
        categories: selectedCategories,
        txType: selectedTxTypeFilter,
      })
    }).sort((a, b) => {
      const dateDiff = transactionSortKey(b).localeCompare(transactionSortKey(a))
      if (dateDiff !== 0) return dateDiff

      const aPending = a.isPendingSync ? 1 : 0
      const bPending = b.isPendingSync ? 1 : 0
      if (bPending !== aPending) {
        return bPending - aPending
      }

      return b.id.localeCompare(a.id)
    })
  }, [sourceTransactions, searchTerm, selectedFilters, selectedDateFilter, selectedTxTypeFilter])

  const paginatedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    return filteredTransactions.slice(startIndex, startIndex + pageSize)
  }, [filteredTransactions, currentPage, pageSize])

  // In server mode use the items from server with prepended matching pending transactions; in client mode use local pagination
  const displayTransactions = useMemo(() => {
    if (showAllCycles && serverResult) {
      return [...filteredPendingTransactions, ...serverResult.items]
    }
    return paginatedTransactions
  }, [showAllCycles, serverResult, filteredPendingTransactions, paginatedTransactions])

  const totalPages = Math.ceil(filteredTransactions.length / pageSize) || 1

  // Clamp currentPage whenever the underlying data set shrinks or changes out
  // from under it (switching to a cycle with fewer pages, deleting the last
  // items on the final page) — otherwise the pager gets stuck on an
  // out-of-range page showing "No transactions" until manually navigated.
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

        const timer = setTimeout(() => {
          const rowEl = document.getElementById(`tx-row-${highlightedTxId}`)
          if (rowEl) {
            rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
            rowEl.classList.add('bg-blue-500/10', 'ring-2', 'ring-blue-500/30', 'dark:bg-blue-500/20')
            const clearTimer = setTimeout(() => {
              rowEl.classList.remove('bg-blue-500/10', 'ring-2', 'ring-blue-500/30', 'dark:bg-blue-500/20')
              onClearIncomingFilters?.()
            }, 3000)
            return () => clearTimeout(clearTimer)
          }
        }, 300)
        return () => clearTimeout(timer)
      }
    }
  }, [highlightedTxId, filteredTransactions, pageSize, onClearIncomingFilters])

  const formatCurrency = (val: number) => {
    return formatCurrencyVal(val, currency)
  }

  const formatSensitive = (val: number) => {
    return (
      <span className={hideSensitive ? 'blur-sm select-none pointer-events-none inline-block transition-[filter] duration-200' : 'transition-[filter] duration-200'}>
        {formatCurrency(val)}
      </span>
    )
  }

  const pageTotals = useMemo(() => calculateLedgerTotals(displayTransactions), [displayTransactions])

  // Stable handler identities for the memoized ledger rows. Edit delegates to
  // the form's imperative handle; delete routes through a live ref so the row
  // gets a constant function reference across renders and React.memo can skip
  // re-rendering them (this project disables react-hooks/exhaustive-deps).
  const handleDeleteClickRef = useRef(handleDeleteClick)
  useEffect(() => {
    handleDeleteClickRef.current = handleDeleteClick
  })
  const onStartEditStable = useCallback((t: Transaction) => formRef.current?.startEdit(t), [])
  const onDeleteClickStable = useCallback((t: Transaction) => handleDeleteClickRef.current(t), [])
  const onSplitEditBlockedStable = useCallback(() => setShowEditDisabledModal(true), [])

  const isServerMode = showAllCycles && !!serverResult

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
    // Match what's actually rendered on the page (displayTransactions),
    // which prepends pending/unsynced rows in server mode.
    const rows = isServerMode ? [...filteredPendingTransactions, ...(serverResult?.items || [])] : paginatedTransactions
    downloadCsvRows(rows, getPageExportFilename(rows))
    setShowExportModal(false)
  }

  const handleExportAll = async () => {
    if (hideSensitive) return
    if (isServerMode && onExportTransactions) {
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
        if (onShowAlert) {
          onShowAlert('Failed to export transactions.', 'Export Error')
        } else {
          alert('Failed to export transactions.')
        }
      } finally {
        setExportIsFetching(false)
      }
      return
    }
    downloadCsvRows(filteredTransactions, getExportAllFilename())
    setShowExportModal(false)
  }

  if (isSwitchingCycle) {
    return <CycleSkeleton variant="ledger" />
  }

  return (
    <div className="space-y-6 soft-rise">

      {/* Header section with total and actions */}
      <Card className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-bold text-foreground">Financial Ledger</h2>

            {/* Cycle Selector */}
            <div className="flex items-center gap-1.5 select-none w-full sm:w-auto">
              <CustomSelect
                value={selectedMonth}
                onChange={(val) => onSelectPeriod(String(val), selectedYear)}
                options={['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(m => ({
                  value: m,
                  label: getCycleLabelForDropdown(m, selectedYear, cycleDay)
                }))}
                className="flex-1 sm:w-56 sm:flex-initial"
              />
              <CustomSelect
                value={selectedYear}
                onChange={(val) => onSelectPeriod(selectedMonth, Number(val))}
                options={availableYears.map(y => ({
                  value: y,
                  label: y.toString()
                }))}
                className="w-20 sm:w-28 shrink-0"
                align="right"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Comprehensive posting of all accounts and transactional balances for the currently selected cycle.</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center md:w-auto md:gap-3">
          <button
            onClick={() => setShowExportModal(true)}
            disabled={hideSensitive}
            className={`flex flex-1 items-center justify-center gap-2 whitespace-nowrap px-4 py-2.5 rounded-xl border border-border font-medium text-xs transition duration-200 md:flex-initial ${
              hideSensitive
                ? 'opacity-40 cursor-not-allowed bg-background text-muted-foreground'
                : 'bg-background hover:bg-muted text-foreground cursor-pointer'
            }`}
            title={hideSensitive ? 'CSV Export disabled in blur mode' : 'Export CSV'}
          >
            <Download className="size-3.5 text-muted-foreground" />
            Export CSV
          </button>
          <Button
            variant="primary"
            size="lg"
            onClick={() => {
              if (isFormOpen) {
                formRef.current?.close()
              } else {
                formRef.current?.open()
              }
            }}
            className="flex-1 whitespace-nowrap rounded-xl text-xs shadow-lg shadow-blue-600/10 hover:shadow-blue-600/20 duration-200 md:flex-initial"
          >
            {isFormOpen ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
            {isFormOpen ? 'Cancel' : 'Post Transaction'}
          </Button>
        </div>
      </Card>

      {/* Dashboard navigation filter banner */}
      {(() => {
        // Derive the banner from the LIVE applied/selected filters, never from the incoming
        // navigation props: those are only the initial intent and don't change when the user
        // unticks a filter, which left a stale "filtered by Stability" hanging around. In
        // all-cycles (server) mode the applied* state is authoritative; otherwise selected*.
        const activeCategoryFilters = showAllCycles ? appliedFilters : selectedFilters
        const activeTxType = showAllCycles ? appliedTxTypeFilter : selectedTxTypeFilter
        const activeSearch = showAllCycles ? appliedSearch : searchTerm
        const activeDate = selectedDateFilter
        const hasAnyFilter = activeCategoryFilters.length > 0 || !!activeTxType || !!activeSearch || !!activeDate
        if (!showAllCycles && !hasAnyFilter) return null

        const parts: string[] = []
        if (showAllCycles) {
          if (cyclesRange === '3month') parts.push("last 3 cycles")
          else if (cyclesRange === '6month') parts.push("last 6 cycles")
          else if (cyclesRange === 'yearly') parts.push(`full year ${selectedYear}`)
          else parts.push("all cycles")
        } else {
          parts.push("current cycle")
        }

        const filterDetails: string[] = []
        const selectedBuckets = activeCategoryFilters.filter(f => LEDGER_BUCKETS.includes(f))
        const selectedCats = activeCategoryFilters.filter(f => !LEDGER_BUCKETS.includes(f))

        if (selectedBuckets.length > 0) {
          const names = selectedBuckets.map(b => `"${b}"`).join(' and ')
          filterDetails.push(`ledger category ${names}`)
        }
        if (selectedCats.length > 0) {
          const names = selectedCats.map(c => `"${c}"`).join(' and ')
          filterDetails.push(`category ${names}`)
        }
        if (activeDate) {
          const d = new Date(activeDate)
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
          const formattedDate = isNaN(d.getTime()) ? activeDate : `${monthNames[d.getMonth()]} ${ordinal(d.getDate())}, ${d.getFullYear()}`
          filterDetails.push(`date ${formattedDate}`)
        }
        if (activeTxType) {
          filterDetails.push(activeTxType === 'inflow' ? "inflows only" : "outflows only")
        }
        if (activeSearch) {
          filterDetails.push(`search "${activeSearch}"`)
        }

        const label = filterDetails.length > 0
          ? `Showing ${parts.join(', ')} — filtered by ${filterDetails.join(' & ')}`
          : `Showing ${parts.join(', ')}`

        return (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-blue-500/8 border border-blue-500/20 text-xs animate-in fade-in duration-200">
          <div className="flex min-w-0 items-center gap-2 text-blue-500 font-medium leading-relaxed">
            <span className="size-1.5 rounded-full bg-blue-500 shrink-0 animate-pulse" />
            {label}
          </div>
          <button
            onClick={() => {
              onClearIncomingFilters?.()
              onClearAllCycles?.()
              setSelectedFilters([])
              setSelectedDateFilter(null)
              setSelectedTxTypeFilter(null)
              setSearchTerm('')
              setPendingFilters([])
              setAppliedFilters([])
              setAppliedSearch('')
              setAppliedTxTypeFilter(null)
            }}
            className="flex shrink-0 items-center gap-1 whitespace-nowrap text-blue-500/70 hover:text-blue-500 text-[10px] font-semibold transition cursor-pointer"
          >
            <X className="size-3" /> Clear filter
          </button>
        </div>
        )
      })()}

      {/* Post Transaction / Edit form (bottom sheet on mobile) */}
      <TransactionFormSheet
        ref={formRef}
        categories={categories}
        currency={currency}
        hideSensitive={hideSensitive}
        autocompleteSuggestions={autocompleteSuggestions}
        transactions={transactions}
        essentialsAlloc={essentialsAlloc}
        growthAlloc={growthAlloc}
        stabilityAlloc={stabilityAlloc}
        rewardsAlloc={rewardsAlloc}
        stabilityBalance={stabilityBalance}
        stabilityTarget={stabilityTarget}
        stabilityOverflowRedirect={stabilityOverflowRedirect}
        onAddTransaction={onAddTransaction}
        onUpdateTransaction={onUpdateTransaction}
        onStartEditPending={onStartEditPending}
        onAddFormOpenChange={handleAddFormOpenChange}
        autoOpenAddForm={autoOpenAddForm}
        onResetAutoOpen={onResetAutoOpen}
        receiptScanDraft={receiptScanDraft}
        onReceiptScanStarted={onReceiptScanStarted}
        onReceiptScanCleared={onReceiptScanCleared}
        activeScanJobIds={activeScanJobIds}
        failedScanJob={failedScanJob}
        aiDraft={aiDraft}
        aiEditDraft={aiEditDraft}
        onAiDraftConsumed={onAiDraftConsumed}
        onAiEditDraftConsumed={onAiEditDraftConsumed}
        onFetchTransactionById={onFetchTransactionById}
        onShowAlert={onShowAlert}
      />

      <LedgerFilterBar
        showAllCycles={showAllCycles}
        isMobile={isMobile}
        serverIsFetching={serverIsFetching}
        categories={categories}
        pendingSearchTerm={pendingSearchTerm}
        onPendingSearchChange={setPendingSearchTerm}
        onServerSearch={handleServerSearch}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        isFilterDropdownOpen={isFilterDropdownOpen}
        onFilterDropdownOpenChange={setIsFilterDropdownOpen}
        appliedFilters={appliedFilters}
        pendingFilters={pendingFilters}
        selectedFilters={selectedFilters}
        onToggleFilter={handleToggleFilter}
        onClearFilters={handleClearFilters}
        onApplyFilters={handleApplyFilters}
      />

      <LedgerTransactionList
        transactions={displayTransactions}
        listKey={`${selectedMonth}-${selectedYear}-${showAllCycles}-${currentPage}`}
        hideSensitive={hideSensitive}
        currency={currency}
        serverIsFetching={serverIsFetching}
        pageTotals={pageTotals}
        isTxDeleting={isTxDeleting}
        isTxSyncing={isTxSyncing}
        onStartEdit={onStartEditStable}
        onDeleteClick={onDeleteClickStable}
        onSplitEditBlocked={onSplitEditBlockedStable}
        formatSensitive={formatSensitive}
      />

      {/* Unified Pagination Controls */}
      <LedgerPagination
        currentPage={currentPage}
        pageSize={pageSize}
        totalItems={isServerMode ? serverResult!.total : filteredTransactions.length}
        totalPages={isServerMode ? (Math.ceil(serverResult!.total / pageSize) || 1) : totalPages}
        serverIsFetching={isServerMode && serverIsFetching}
        onPageChange={setCurrentPage}
        onPageSizeChange={(size) => {
          setPageSize(size)
          setCurrentPage(1)
        }}
      />

      <LedgerExportModal
        isOpen={showExportModal}
        exportIsFetching={exportIsFetching}
        onClose={() => setShowExportModal(false)}
        onExportPage={handleExportPage}
        onExportAll={handleExportAll}
      />

      <DeleteTransactionModal
        isOpen={showDeleteModal}
        transaction={txToDelete}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        formatSensitive={formatSensitive}
      />

      <EditDisabledModal
        isOpen={showEditDisabledModal}
        onClose={() => setShowEditDisabledModal(false)}
      />
    </div>
  )
}
