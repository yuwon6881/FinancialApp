import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import type { LedgerAccount, Transaction } from '../../../types'
import type { PagedTransactionResult } from '../../../lib/api'
import { getCycleRangeDates, getStartOfNCyclesAgo, formatDateForApi, MONTH_NAMES } from '../../../lib/cycle'
import { getCycleLabelForDropdown } from '../../../lib/cycleLabels'
import { matchesTransactionFilters, splitFilterSelections, LEDGER_BUCKETS as LEDGER_BUCKET_VALUES, type TransactionLinkFilter } from '../../../lib/transactionFilters'
import { downloadCsvBlob, downloadCsvRows, toFilename } from '../../../lib/csvExport'
import { compareTransactions, type TransactionSort } from '../../../lib/transactionOrdering'
import { ledgerRouteSearch, updateAppSearch, type LedgerRouteRange } from '../../../lib/appLocation'
import { getLedgerTransactionRowElement } from '../../../lib/ledgerTransactionTarget'
import { createLedgerSyncStatus } from './ledgerSyncStatus'
import type { SensitivePreferenceStatus } from '../../../app/useAppPreferences'
import { financialDate } from '../../../lib/financialDate'
import { useHighlightedElement } from '../../ui/useHighlightedElement'

export interface UseLedgerViewOptions {
  transactions: Transaction[]
  accounts?: LedgerAccount[]
  categories: any[]
  selectedMonth: string
  selectedYear: number
  cycleDay: number
  isMobile: boolean
  incomingCategory?: string | null | undefined
  incomingFilters?: string[] | undefined
  incomingSearch?: string | null | undefined
  incomingDate?: string | null | undefined
  incomingStartDate?: string | null | undefined
  incomingEndDate?: string | null | undefined
  incomingMinAmount?: string | null | undefined
  incomingMaxAmount?: string | null | undefined
  incomingRecurringFilter?: TransactionLinkFilter | undefined
  incomingWishlistFilter?: TransactionLinkFilter | undefined
  incomingTxType?: 'inflow' | 'outflow' | 'transfer' | null | undefined
  highlightedTxId?: string | null | undefined
  isSwitchingCycle?: boolean
  onClearIncomingFilters?: () => void
  /**
   * Drops just the highlight (state + `?tx=`) once it has faded. Separate from
   * `onClearIncomingFilters` because a highlight arriving alongside filters — an AI
   * "edit the Netflix charge and show me it" — must not take those filters down with it.
   */
  onClearHighlightedTx?: () => void
  showAllCycles: boolean
  cyclesRange?: 'monthly' | '3month' | '6month' | 'yearly'
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
  onFetchPagedTransactions?: (params: any) => Promise<PagedTransactionResult>
  onExportTransactions?: (params: any) => Promise<{ blob: Blob; filename: string }>
  onShowAlert?: (message: string, title?: string) => void
  activeSyncId?: string | null
  activeSyncIds?: ReadonlyArray<string>
  deletingTxId?: string | null
  onDeleteTransaction: (id: string, transaction?: Transaction, attachedDocumentIdsToDelete?: number[]) => Promise<void> | void
  onAiExportRequestConsumed?: () => void
  aiExportRequest?: any
  hideSensitive: boolean
  sensitivePreferenceStatus?: SensitivePreferenceStatus
  formRef: React.RefObject<any>
  preferredPageSize?: number
  preferredSortOrder?: TransactionSort
}

const LEDGER_BUCKETS: readonly string[] = LEDGER_BUCKET_VALUES
type LedgerTxType = 'inflow' | 'outflow' | 'transfer' | null
const parseAmountFilter = (value: string): number | undefined => {
  if (!value.trim()) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}
const laterDate = (first?: string | null, second?: string | null) => {
  if (!first) return second || undefined
  if (!second) return first
  return first > second ? first : second
}
const earlierDate = (first?: string | null, second?: string | null) => {
  if (!first) return second || undefined
  if (!second) return first
  return first < second ? first : second
}
export function useLedgerView(options: UseLedgerViewOptions) {
  const {
    transactions,
    accounts,
    categories,
    selectedMonth,
    selectedYear,
    cycleDay,
    isMobile,
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
    isSwitchingCycle,
    onClearIncomingFilters,
    onClearHighlightedTx,
    showAllCycles,
    cyclesRange,
    onRouteStateChange,
    onFetchPagedTransactions,
    onExportTransactions,
    onShowAlert,
    activeSyncId,
    activeSyncIds,
    deletingTxId,
    onDeleteTransaction,
    onAiExportRequestConsumed,
    aiExportRequest,
    hideSensitive,
    sensitivePreferenceStatus,
    formRef,
    preferredPageSize,
    preferredSortOrder,
  } = options

  // Search & Filter state
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
  // Pagination states
  const [currentPage, setCurrentPage] = useState(() => {
    if (highlightedTxId) {
      const index = transactions.findIndex(t => t.id === highlightedTxId)
      if (index !== -1) {
        return Math.floor(index / 10) + 1
      }
    }
    return 1
  })
  const [currentCyclePageSize, setCurrentCyclePageSize] = useState(preferredPageSize ?? 10)
  const [allCyclesPageSize, setAllCyclesPageSize] = useState(100)
  const pageSize = showAllCycles ? allCyclesPageSize : currentCyclePageSize
  const setPageSize = useCallback((size: number) => {
    if (showAllCycles) setAllCyclesPageSize(size)
    else setCurrentCyclePageSize(size)
  }, [showAllCycles])
  const [sortOrder, setSortOrder] = useState<TransactionSort>(preferredSortOrder ?? 'date-desc')
  // Server-side state
  const [serverResult, setServerResult] = useState<PagedTransactionResult | null>(null)
  const [serverIsFetching, setServerIsFetching] = useState(false)
  // A fetch whose answer will be a different set of rows (a page turn, a new page size, new
  // filters, a new sort). The rows on screen already contradict the pagination footer the moment
  // such a fetch starts, so the list shows loading placeholders instead of the superseded page.
  // Background revalidations (post-sync, post-delete) keep their rows and only spin the footer.
  const [serverIsReplacingRows, setServerIsReplacingRows] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const isInitialFetchDone = useRef(false)
  const wasAllCyclesRef = useRef(false)
  const fetchSequenceRef = useRef(0)
  const fetchAbortRef = useRef<AbortController | null>(null)
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportIsFetching, setExportIsFetching] = useState(false)
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

  // Every filter above seeds from its `incoming*` prop only on mount, which is enough when the
  // ledger is entered from another tab (the view remounts). It is not enough for a request made
  // while the ledger is already on screen — an Ask AI "filter to purchases over 200" would set the
  // incoming props and change nothing. Re-seed whenever the incoming set actually changes, so a
  // navigation-with-filters is applied in place too. The signature guard keeps a user's own
  // subsequent edits from being reverted by an unrelated re-render.
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
  // Delete transaction state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null)
  const [attachedDocumentIds, setAttachedDocumentIds] = useState<number[]>([])
  const [alsoDeleteDocuments, setAlsoDeleteDocuments] = useState(false)
  const [areAttachedDocumentsLoading, setAreAttachedDocumentsLoading] = useState(false)
  const deleteDocumentLookupRef = useRef(0)
  const [showEditDisabledModal, setShowEditDisabledModal] = useState(false)
  const [editBlockedTransaction, setEditBlockedTransaction] = useState<Transaction | null>(null)

  useEffect(() => {
    if (!hideSensitive) return
    deleteDocumentLookupRef.current += 1
    setShowExportModal(false)
    setShowDeleteModal(false)
    setTxToDelete(null)
    setAttachedDocumentIds([])
    setAlsoDeleteDocuments(false)
    setAreAttachedDocumentsLoading(false)
    setShowEditDisabledModal(false)
    setEditBlockedTransaction(null)
    if (sensitivePreferenceStatus !== 'pending') formRef.current?.handleCloseForm()
  }, [hideSensitive, sensitivePreferenceStatus, formRef])

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
    txType: LedgerTxType
    startDate: string
    endDate: string
    minAmount: string
    maxAmount: string
    recurringFilter: TransactionLinkFilter
    wishlistFilter: TransactionLinkFilter
    sort: TransactionSort
    pSize: number
    /** Revalidation of the same query: keep the current rows on screen while it runs. */
    background?: boolean
  }) => {
    if (!onFetchPagedTransactions) return
    const sequence = ++fetchSequenceRef.current
    fetchAbortRef.current?.abort()
    const controller = new AbortController()
    fetchAbortRef.current = controller
    setServerIsFetching(true)
    setServerIsReplacingRows(!opts.background)
    setServerError(null)
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
        startDate: laterDate(allCyclesRange?.startDate, opts.startDate),
        endDate: earlierDate(allCyclesRange?.endDate, opts.endDate),
        minAmount: parseAmountFilter(opts.minAmount),
        maxAmount: parseAmountFilter(opts.maxAmount),
        recurringFilter: opts.recurringFilter,
        wishlistFilter: opts.wishlistFilter,
        sort: opts.sort,
        signal: controller.signal,
      })
      if (sequence !== fetchSequenceRef.current || controller.signal.aborted) return
      setServerResult(result)
      setRecentlySyncedIds(new Set())
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error(error)
        setServerError('Could not load saved transactions. Check your connection and try again.')
      }
    } finally {
      if (sequence === fetchSequenceRef.current) {
        setServerIsFetching(false)
        setServerIsReplacingRows(false)
      }
    }
  }, [onFetchPagedTransactions, allCyclesRange])
  useEffect(() => () => fetchAbortRef.current?.abort(), [])
  // Trigger initial server fetch when entering all-cycles mode
  useEffect(() => {
    if (showAllCycles && onFetchPagedTransactions) {
      if (wasAllCyclesRef.current) return
      wasAllCyclesRef.current = true
      const initialFilters = incomingFilters ?? (incomingCategory ? [incomingCategory] : [])
      const initialTxType = incomingTxType || null
      const initialSearch = incomingSearch || ''
      const initialStartDate = incomingStartDate ?? incomingDate ?? ''
      const initialEndDate = incomingEndDate ?? incomingDate ?? ''
      const initialMinAmount = incomingMinAmount || ''
      const initialMaxAmount = incomingMaxAmount || ''
      const initialRecurringFilter = incomingRecurringFilter ?? 'all'
      const initialWishlistFilter = incomingWishlistFilter ?? 'all'

      setPendingSearchTerm(initialSearch)
      setPendingFilters(initialFilters)
      setPendingStartDate(initialStartDate)
      setPendingEndDate(initialEndDate)
      setPendingMinAmount(initialMinAmount)
      setPendingMaxAmount(initialMaxAmount)
      setPendingRecurringFilter(initialRecurringFilter)
      setPendingWishlistFilter(initialWishlistFilter)
      setPendingTxTypeFilter(initialTxType)
      setAppliedSearch(initialSearch)
      setAppliedFilters(initialFilters)
      setAppliedStartDate(initialStartDate)
      setAppliedEndDate(initialEndDate)
      setAppliedMinAmount(initialMinAmount)
      setAppliedMaxAmount(initialMaxAmount)
      setAppliedRecurringFilter(initialRecurringFilter)
      setAppliedWishlistFilter(initialWishlistFilter)
      setAppliedTxTypeFilter(initialTxType)
      setCurrentPage(1)
      isInitialFetchDone.current = false
      runServerFetch({
        page: 1,
        search: initialSearch,
        filters: initialFilters,
        txType: initialTxType,
        startDate: initialStartDate,
        endDate: initialEndDate,
        minAmount: initialMinAmount,
        maxAmount: initialMaxAmount,
        recurringFilter: initialRecurringFilter,
        wishlistFilter: initialWishlistFilter,
        sort: sortOrder,
        pSize: allCyclesPageSize,
      })
        .finally(() => {
          isInitialFetchDone.current = true
        })
    } else {
      wasAllCyclesRef.current = false
      setServerResult(null)
      setServerError(null)
      setServerIsReplacingRows(false)
      isInitialFetchDone.current = false
    }
  }, [showAllCycles, onFetchPagedTransactions, runServerFetch, allCyclesRange, incomingCategory, incomingFilters, incomingTxType, incomingSearch, incomingDate, incomingStartDate, incomingEndDate, incomingMinAmount, incomingMaxAmount, incomingRecurringFilter, incomingWishlistFilter, sortOrder, allCyclesPageSize])

  useEffect(() => {
    if (showAllCycles && onFetchPagedTransactions && isInitialFetchDone.current) {
      runServerFetch({
        page: currentPage,
        search: appliedSearch,
        filters: appliedFilters,
        txType: appliedTxTypeFilter,
        startDate: appliedStartDate,
        endDate: appliedEndDate,
        minAmount: appliedMinAmount,
        maxAmount: appliedMaxAmount,
        recurringFilter: appliedRecurringFilter,
        wishlistFilter: appliedWishlistFilter,
        sort: sortOrder,
        pSize: pageSize,
      })
    }
  }, [currentPage, pageSize, showAllCycles, onFetchPagedTransactions, runServerFetch, appliedSearch, appliedFilters, appliedTxTypeFilter, appliedStartDate, appliedEndDate, appliedMinAmount, appliedMaxAmount, appliedRecurringFilter, appliedWishlistFilter, allCyclesRange, sortOrder])

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
      runServerFetch({
        page: currentPage,
        search: appliedSearch,
        filters: appliedFilters,
        txType: appliedTxTypeFilter,
        startDate: appliedStartDate,
        endDate: appliedEndDate,
        minAmount: appliedMinAmount,
        maxAmount: appliedMaxAmount,
        recurringFilter: appliedRecurringFilter,
        wishlistFilter: appliedWishlistFilter,
        sort: sortOrder,
        pSize: pageSize,
        background: true,
      })
    }
    prevActiveSyncId.current = activeSyncId || null
  }, [activeSyncId, showAllCycles, currentPage, appliedSearch, appliedFilters, appliedTxTypeFilter, appliedStartDate, appliedEndDate, appliedMinAmount, appliedMaxAmount, appliedRecurringFilter, appliedWishlistFilter, pageSize, onFetchPagedTransactions, runServerFetch, sortOrder])

  // Re-fetch server result when deletingTxId transitions from non-null to null (delete completed)
  const prevDeletingTxId = useRef<string | null>(null)
  useEffect(() => {
    if (showAllCycles && prevDeletingTxId.current !== null && deletingTxId === null && onFetchPagedTransactions && isInitialFetchDone.current) {
      runServerFetch({
        page: currentPage,
        search: appliedSearch,
        filters: appliedFilters,
        txType: appliedTxTypeFilter,
        startDate: appliedStartDate,
        endDate: appliedEndDate,
        minAmount: appliedMinAmount,
        maxAmount: appliedMaxAmount,
        recurringFilter: appliedRecurringFilter,
        wishlistFilter: appliedWishlistFilter,
        sort: sortOrder,
        pSize: pageSize,
        background: true,
      })
    }
    prevDeletingTxId.current = deletingTxId || null
  }, [deletingTxId, showAllCycles, currentPage, appliedSearch, appliedFilters, appliedTxTypeFilter, appliedStartDate, appliedEndDate, appliedMinAmount, appliedMaxAmount, appliedRecurringFilter, appliedWishlistFilter, pageSize, onFetchPagedTransactions, runServerFetch, sortOrder])

  // Reset back to page 1 when search inputs or active filters are updated (client-side mode only)
  const prevFilterSignatureRef = useRef<string | null>(null)
  useEffect(() => {
    const currentSignature = JSON.stringify([
      searchTerm, selectedFilters, selectedStartDate, selectedEndDate,
      selectedMinAmount, selectedMaxAmount, selectedRecurringFilter,
      selectedWishlistFilter, selectedTxTypeFilter, showAllCycles,
    ])
    if (prevFilterSignatureRef.current === null) {
      prevFilterSignatureRef.current = currentSignature
      return
    }
    if (prevFilterSignatureRef.current !== currentSignature) {
      prevFilterSignatureRef.current = currentSignature
      if (!showAllCycles) {
        setCurrentPage(1)
      }
    }
  }, [searchTerm, selectedFilters, selectedStartDate, selectedEndDate, selectedMinAmount, selectedMaxAmount, selectedRecurringFilter, selectedWishlistFilter, selectedTxTypeFilter, showAllCycles])


  // Keep the visible ledger state addressable. Typing and local filter changes
  // replace the current history entry; explicit cross-view navigation still
  // creates its own Back/Forward entry in useCycleNavigation.
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

  const retryServerFetch = () => runServerFetch({
    page: currentPage, search: appliedSearch, filters: appliedFilters,
    txType: appliedTxTypeFilter, startDate: appliedStartDate, endDate: appliedEndDate,
    minAmount: appliedMinAmount, maxAmount: appliedMaxAmount,
    recurringFilter: appliedRecurringFilter, wishlistFilter: appliedWishlistFilter,
    sort: sortOrder, pSize: pageSize,
  })

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

  const handleDeleteClick = (t: Transaction) => {
    if (hideSensitive) return
    const transactionId = t.id.includes('-split-') ? t.id.split('-split-')[0] : t.id
    const lookupId = ++deleteDocumentLookupRef.current
    setTxToDelete(t)
    setAttachedDocumentIds([])
    setAlsoDeleteDocuments(false)
    setAreAttachedDocumentsLoading(true)
    setShowDeleteModal(true)
    void import('../../../lib/api/documents')
      .then(({ listAllDocumentsForTransaction }) => listAllDocumentsForTransaction(transactionId))
      .then(documents => {
        if (deleteDocumentLookupRef.current === lookupId) {
          setAttachedDocumentIds(documents.map(document => document.id))
        }
      })
      .catch(() => {
        if (deleteDocumentLookupRef.current === lookupId) {
          onShowAlert?.(
            'Attached documents could not be checked. Deleting the transaction will still keep every vault document.',
            'Document Vault',
          )
        }
      })
      .finally(() => {
        if (deleteDocumentLookupRef.current === lookupId) {
          setAreAttachedDocumentsLoading(false)
        }
      })
  }

  const handleConfirmDelete = async () => {
    if (!txToDelete) return

    let deleteId = txToDelete.id
    if (txToDelete.id.includes('-split-')) {
      deleteId = txToDelete.id.split('-split-')[0]
    }

    // The documents are handed over rather than deleted here, and the deletion runs only once the
    // queued transaction delete has actually synced. Deleting the files first meant an irreversible
    // action ran ahead of a reversible one: a queued delete that later failed permanently left the
    // transaction on screen with its evidence already destroyed. Files are the one thing in this
    // flow that cannot be recreated, so they go last.
    await onDeleteTransaction(deleteId, txToDelete, alsoDeleteDocuments ? attachedDocumentIds : undefined)
    setShowDeleteModal(false)
    setTxToDelete(null)
    setAttachedDocumentIds([])
    setAlsoDeleteDocuments(false)
  }

  const handleCancelDelete = () => {
    deleteDocumentLookupRef.current += 1
    setShowDeleteModal(false)
    setTxToDelete(null)
    setAttachedDocumentIds([])
    setAlsoDeleteDocuments(false)
    setAreAttachedDocumentsLoading(false)
  }

  const { isDeleting: isTxDeleting, isSyncing: isTxSyncing } = useMemo(() => createLedgerSyncStatus({
    transactions,
    activeSyncId,
    activeSyncIds,
    deletingTxId,
  }), [activeSyncId, activeSyncIds, deletingTxId, transactions])

  const pendingTransactions = useMemo(() => {
    return transactions.filter(t => t.isPendingSync || recentlySyncedIds.has(String(t.id)))
  }, [transactions, recentlySyncedIds])

  const filteredPendingTransactions = useMemo(() => {
    if (!showAllCycles) return []

    const { buckets: selectedBuckets, categories: selectedCategories } = splitFilterSelections(appliedFilters)

    return pendingTransactions.filter(t => {
      return matchesTransactionFilters(t, {
        search: appliedSearch,
        buckets: selectedBuckets,
        categories: selectedCategories,
        txType: appliedTxTypeFilter,
        startDate: laterDate(allCyclesRange?.startDate, appliedStartDate),
        endDate: earlierDate(allCyclesRange?.endDate, appliedEndDate),
        minAmount: parseAmountFilter(appliedMinAmount),
        maxAmount: parseAmountFilter(appliedMaxAmount),
        recurringFilter: appliedRecurringFilter,
        wishlistFilter: appliedWishlistFilter,
      })
    }).sort((a, b) => compareTransactions(a, b, sortOrder))
  }, [pendingTransactions, showAllCycles, appliedSearch, appliedFilters, appliedTxTypeFilter, appliedStartDate, appliedEndDate, appliedMinAmount, appliedMaxAmount, appliedRecurringFilter, appliedWishlistFilter, allCyclesRange, sortOrder])

  const filteredTransactions = useMemo(() => {
    const { buckets: selectedBuckets, categories: selectedCategories } = splitFilterSelections(selectedFilters)
    const activeMonthIndex = MONTH_NAMES.indexOf(selectedMonth) + 1
    const activeCycleRange = activeMonthIndex > 0
      ? getCycleRangeDates(selectedYear, activeMonthIndex, cycleDay)
      : null
    const cycleStartDate = activeCycleRange ? formatDateForApi(activeCycleRange.start) : undefined
    const cycleEndDate = activeCycleRange ? formatDateForApi(activeCycleRange.end) : undefined

    return transactions.filter(t => matchesTransactionFilters(t, {
        search: searchTerm,
        buckets: selectedBuckets,
        categories: selectedCategories,
        txType: selectedTxTypeFilter,
        startDate: laterDate(cycleStartDate, selectedStartDate),
        endDate: earlierDate(cycleEndDate, selectedEndDate),
        minAmount: parseAmountFilter(selectedMinAmount),
        maxAmount: parseAmountFilter(selectedMaxAmount),
        recurringFilter: selectedRecurringFilter,
        wishlistFilter: selectedWishlistFilter,
      })).sort((a, b) => compareTransactions(a, b, sortOrder))
  }, [transactions, searchTerm, selectedFilters, selectedStartDate, selectedEndDate, selectedMinAmount, selectedMaxAmount, selectedRecurringFilter, selectedWishlistFilter, selectedTxTypeFilter, selectedMonth, selectedYear, cycleDay, sortOrder])

  const paginatedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    return filteredTransactions.slice(startIndex, startIndex + pageSize)
  }, [filteredTransactions, currentPage, pageSize])

  const displayTransactions = useMemo(() => {
    if (showAllCycles) {
      // Rows from the query that is being replaced are withdrawn immediately, so nothing on screen
      // (or reachable by export, selection, or a row action) belongs to a page the user left.
      if (!serverResult || serverIsReplacingRows) return []
      const syncingIds = new Set(filteredPendingTransactions.map(transaction => String(transaction.id)))
      return serverResult.items.filter(transaction => !syncingIds.has(String(transaction.id)))
    }
    return paginatedTransactions
  }, [showAllCycles, serverResult, serverIsReplacingRows, filteredPendingTransactions, paginatedTransactions])

  const totalPages = Math.ceil(filteredTransactions.length / pageSize) || 1

  useEffect(() => {
    if (!showAllCycles && currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [totalPages, showAllCycles, currentPage])

  useEffect(() => {
    if (showAllCycles && serverResult) {
      const serverTotalPages = Math.ceil(serverResult.total / pageSize) || 1
      if (currentPage > serverTotalPages) {
        setCurrentPage(serverTotalPages)
      }
    }
  }, [serverResult, showAllCycles, currentPage, pageSize])

  // Page selection for highlighted transaction (if target is on a different page)
  useEffect(() => {
    if (!highlightedTxId) return
    const index = filteredTransactions.findIndex(t => t.id === highlightedTxId)
    if (index !== -1) {
      const targetPage = Math.floor(index / pageSize) + 1
      setCurrentPage(prev => (prev !== targetPage ? targetPage : prev))
    }
  }, [highlightedTxId, filteredTransactions, pageSize])

  // Page selection stays Ledger-specific, but the reveal and arrival cue are shared with every
  // other global-search destination. The resolver picks the one responsive row actually mounted.
  useHighlightedElement(highlightedTxId ?? null, onClearHighlightedTx, {
    ready: !isSwitchingCycle,
    resolveElement: () => highlightedTxId
      ? getLedgerTransactionRowElement(highlightedTxId, isMobile)
      : null,
  })

  const handleDeleteClickRef = useRef(handleDeleteClick)
  useEffect(() => {
    handleDeleteClickRef.current = handleDeleteClick
  })
  const onStartEditStable = useCallback((t: Transaction) => formRef.current?.handleStartEdit(t), [formRef])
  const onDuplicateStable = useCallback((t: Transaction) => formRef.current?.openWithDraft({
    description: t.description,
    amount: t.amount,
    date: financialDate(),
    category: t.category,
    ledgerCategory: t.ledgerCategory,
    txType: t.amount < 0 ? 'outflow' : 'inflow',
    accountId: t.accountId,
  }), [formRef])
  const onAddTransactionStable = useCallback(() => formRef.current?.openFresh(), [formRef])
  const onDeleteClickStable = useCallback((t: Transaction) => handleDeleteClickRef.current(t), [])
  const onEditBlockedStable = useCallback((transaction: Transaction) => {
    setEditBlockedTransaction(transaction)
    setShowEditDisabledModal(true)
  }, [])

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
  }, [onClearIncomingFilters])

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
    if (appliedStartDate || appliedEndDate) {
      parts.push(`Dates ${appliedStartDate || 'Any'} to ${appliedEndDate || 'Any'}`)
    }
    if (appliedMinAmount || appliedMaxAmount) {
      parts.push(`Amounts ${appliedMinAmount || '0'} to ${appliedMaxAmount || 'Any'}`)
    }
    if (appliedRecurringFilter === 'only') parts.push('Recurring')
    else if (appliedRecurringFilter === 'exclude') parts.push('Without Recurring')
    if (appliedWishlistFilter === 'only') parts.push('Reward Purchases')
    else if (appliedWishlistFilter === 'exclude') parts.push('Without Reward Purchases')
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
    if (showAllCycles && (!serverResult || serverIsReplacingRows)) {
      onShowAlert?.('Load the saved transactions before exporting this page.', 'Export Not Ready')
      return
    }
    const rows = showAllCycles && serverResult ? displayTransactions : paginatedTransactions
    downloadCsvRows(rows, getPageExportFilename(rows), accounts)
    setShowExportModal(false)
  }

  const handleExportAll = async () => {
    if (hideSensitive) return
    if (showAllCycles && filteredPendingTransactions.length > 0) {
      onShowAlert?.('Wait for the matching transactions to finish syncing before exporting the entire result.', 'Export Not Ready')
      return
    }
    if (showAllCycles && onExportTransactions) {
      setExportIsFetching(true)
      try {
        const buckets = appliedFilters.filter(f => LEDGER_BUCKETS.includes(f))
        const cats = appliedFilters.filter(f => !LEDGER_BUCKETS.includes(f))
        const result = await onExportTransactions({
          search: appliedSearch || undefined,
          ledgerCategories: buckets.length > 0 ? buckets : undefined,
          categories: cats.length > 0 ? cats : undefined,
          txType: appliedTxTypeFilter || null,
          startDate: laterDate(allCyclesRange?.startDate, appliedStartDate),
          endDate: earlierDate(allCyclesRange?.endDate, appliedEndDate),
          minAmount: parseAmountFilter(appliedMinAmount),
          maxAmount: parseAmountFilter(appliedMaxAmount),
          recurringFilter: appliedRecurringFilter,
          wishlistFilter: appliedWishlistFilter,
          sort: sortOrder,
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
    downloadCsvRows(filteredTransactions, getExportAllFilename(), accounts)
    setShowExportModal(false)
  }

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
    currentPage, setCurrentPage, pageSize, setPageSize, sortOrder, setSortOrder,
    serverResult, serverIsFetching, serverIsReplacingRows, serverError, retryServerFetch,
    showExportModal, setShowExportModal, exportIsFetching,
    pendingSearchTerm, setPendingSearchTerm,
    pendingFilters, setPendingFilters,
    pendingStartDate, setPendingStartDate,
    pendingEndDate, setPendingEndDate,
    pendingMinAmount, setPendingMinAmount,
    pendingMaxAmount, setPendingMaxAmount,
    pendingRecurringFilter, setPendingRecurringFilter,
    pendingWishlistFilter, setPendingWishlistFilter,
    pendingTxTypeFilter, setPendingTxTypeFilter,
    appliedSearch, appliedFilters, appliedStartDate, appliedEndDate,
    appliedMinAmount, appliedMaxAmount, appliedRecurringFilter,
    appliedWishlistFilter, appliedTxTypeFilter,
    syncingTransactions: filteredPendingTransactions,
    hasMatchingPendingTransactions: filteredPendingTransactions.length > 0,
    showDeleteModal, txToDelete,
    attachedDocumentCount: attachedDocumentIds.length,
    alsoDeleteDocuments, setAlsoDeleteDocuments, areAttachedDocumentsLoading,
    showEditDisabledModal, setShowEditDisabledModal, editBlockedTransaction,
    displayTransactions, totalPages, filteredTransactions, isTxDeleting, isTxSyncing,
    onStartEditStable, onDuplicateStable, onAddTransactionStable,
    onDeleteClickStable, onEditBlockedStable,
    handleToggleFilter, handleClearFilters, handleApplyFilters,
    handleServerSearch, handleClearServerSearch,
    handleDeleteClick, handleConfirmDelete, handleCancelDelete,
    handleExportPage, handleExportAll, handleResetFilters,
  }
}
