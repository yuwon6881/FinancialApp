import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import type { PagedTransactionResult } from '../../../lib/api'
import { getCycleRangeDates, getStartOfNCyclesAgo, formatDateForApi } from '../../../lib/cycle'
import type { TransactionSort } from '../../../lib/transactionOrdering'
import type { TransactionLinkFilter, TransactionSearchMode } from '../../../lib/transactionFilters'
import {
  LEDGER_BUCKETS,
  parseAmountFilter,
  laterDate,
  earlierDate,
  type LedgerTxType,
} from './ledgerViewTypes'

export interface UseLedgerServerDataOptions {
  showAllCycles: boolean
  cyclesRange?: 'monthly' | '3month' | '6month' | 'yearly' | 'all'
  selectedMonth: string
  selectedYear: number
  cycleDay: number
  allCyclesPageSize: number
  pageSize: number
  currentPage: number
  setCurrentPage: (page: number | ((prev: number) => number)) => void
  sortOrder: TransactionSort
  activeSyncId?: string | null
  deletingTxId?: string | null
  onFetchPagedTransactions?: (params: any) => Promise<PagedTransactionResult>
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
  appliedSearch: string
  appliedSearchMode: TransactionSearchMode
  appliedFilters: string[]
  appliedStartDate: string
  appliedEndDate: string
  appliedMinAmount: string
  appliedMaxAmount: string
  appliedRecurringFilter: TransactionLinkFilter
  appliedWishlistFilter: TransactionLinkFilter
  appliedTxTypeFilter: LedgerTxType
  setPendingSearchTerm: (term: string) => void
  setPendingFilters: (filters: string[]) => void
  setPendingStartDate: (date: string) => void
  setPendingEndDate: (date: string) => void
  setPendingMinAmount: (amount: string) => void
  setPendingMaxAmount: (amount: string) => void
  setPendingRecurringFilter: (filter: TransactionLinkFilter) => void
  setPendingWishlistFilter: (filter: TransactionLinkFilter) => void
  setPendingTxTypeFilter: (type: LedgerTxType) => void
  setAppliedSearch: (term: string) => void
  setAppliedFilters: (filters: string[]) => void
  setAppliedStartDate: (date: string) => void
  setAppliedEndDate: (date: string) => void
  setAppliedMinAmount: (amount: string) => void
  setAppliedMaxAmount: (amount: string) => void
  setAppliedRecurringFilter: (filter: TransactionLinkFilter) => void
  setAppliedWishlistFilter: (filter: TransactionLinkFilter) => void
  setAppliedTxTypeFilter: (type: LedgerTxType) => void
}

export function useLedgerServerData(options: UseLedgerServerDataOptions) {
  const {
    showAllCycles,
    cyclesRange,
    selectedMonth,
    selectedYear,
    cycleDay,
    allCyclesPageSize,
    pageSize,
    currentPage,
    setCurrentPage,
    sortOrder,
    activeSyncId,
    deletingTxId,
    onFetchPagedTransactions,
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
    appliedSearch,
    appliedSearchMode,
    appliedFilters,
    appliedStartDate,
    appliedEndDate,
    appliedMinAmount,
    appliedMaxAmount,
    appliedRecurringFilter,
    appliedWishlistFilter,
    appliedTxTypeFilter,
    setPendingSearchTerm,
    setPendingFilters,
    setPendingStartDate,
    setPendingEndDate,
    setPendingMinAmount,
    setPendingMaxAmount,
    setPendingRecurringFilter,
    setPendingWishlistFilter,
    setPendingTxTypeFilter,
    setAppliedSearch,
    setAppliedFilters,
    setAppliedStartDate,
    setAppliedEndDate,
    setAppliedMinAmount,
    setAppliedMaxAmount,
    setAppliedRecurringFilter,
    setAppliedWishlistFilter,
    setAppliedTxTypeFilter,
  } = options

  const [serverResult, setServerResult] = useState<PagedTransactionResult | null>(null)
  const [serverIsFetching, setServerIsFetching] = useState(false)
  const [serverIsReplacingRows, setServerIsReplacingRows] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [recentlySyncedIds, setRecentlySyncedIds] = useState<Set<string>>(new Set())

  const isInitialFetchDone = useRef(false)
  const wasAllCyclesRef = useRef(false)
  const fetchSequenceRef = useRef(0)
  const fetchAbortRef = useRef<AbortController | null>(null)

  const allCyclesRange = useMemo(() => {
    if (!showAllCycles) return null
    if (!cyclesRange || cyclesRange === 'monthly' || cyclesRange === 'all') return null
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
      endDate: formatDateForApi(endDate),
    }
  }, [showAllCycles, cyclesRange, selectedMonth, selectedYear, cycleDay])

  const runServerFetch = useCallback(async (opts: {
    page: number
    search: string
    searchMode?: TransactionSearchMode
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
        searchMode: opts.searchMode ?? 'contains',
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
        searchMode: appliedSearchMode,
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
  }, [showAllCycles, onFetchPagedTransactions, runServerFetch, allCyclesRange, incomingCategory, incomingFilters, incomingTxType, incomingSearch, incomingDate, incomingStartDate, incomingEndDate, incomingMinAmount, incomingMaxAmount, incomingRecurringFilter, incomingWishlistFilter, sortOrder, allCyclesPageSize, setPendingSearchTerm, setPendingFilters, setPendingStartDate, setPendingEndDate, setPendingMinAmount, setPendingMaxAmount, setPendingRecurringFilter, setPendingWishlistFilter, setPendingTxTypeFilter, setAppliedSearch, setAppliedFilters, setAppliedStartDate, setAppliedEndDate, setAppliedMinAmount, setAppliedMaxAmount, setAppliedRecurringFilter, setAppliedWishlistFilter, setAppliedTxTypeFilter, setCurrentPage])

  useEffect(() => {
    if (showAllCycles && onFetchPagedTransactions && isInitialFetchDone.current) {
      runServerFetch({
        page: currentPage,
        search: appliedSearch,
        searchMode: appliedSearchMode,
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
  }, [currentPage, pageSize, showAllCycles, onFetchPagedTransactions, runServerFetch, appliedSearch, appliedSearchMode, appliedFilters, appliedTxTypeFilter, appliedStartDate, appliedEndDate, appliedMinAmount, appliedMaxAmount, appliedRecurringFilter, appliedWishlistFilter, allCyclesRange, sortOrder])

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
        searchMode: appliedSearchMode,
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
        searchMode: appliedSearchMode,
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

  const retryServerFetch = useCallback(() => runServerFetch({
    page: currentPage, search: appliedSearch, filters: appliedFilters,
    txType: appliedTxTypeFilter, startDate: appliedStartDate, endDate: appliedEndDate,
    minAmount: appliedMinAmount, maxAmount: appliedMaxAmount,
    recurringFilter: appliedRecurringFilter, wishlistFilter: appliedWishlistFilter,
    sort: sortOrder, pSize: pageSize,
  }), [currentPage, appliedSearch, appliedFilters, appliedTxTypeFilter, appliedStartDate, appliedEndDate, appliedMinAmount, appliedMaxAmount, appliedRecurringFilter, appliedWishlistFilter, sortOrder, pageSize, runServerFetch])

  return {
    serverResult,
    serverIsFetching,
    serverIsReplacingRows,
    serverError,
    recentlySyncedIds,
    allCyclesRange,
    runServerFetch,
    retryServerFetch,
  }
}
