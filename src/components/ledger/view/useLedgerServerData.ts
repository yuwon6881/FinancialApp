import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import type { PagedTransactionResult } from '../../../lib/api'
import { getCycleRangeDates, getStartOfNCyclesAgo, formatDateForApi } from '../../../lib/cycle'
import type { TransactionSort } from '../../../lib/transactionOrdering'
import {
  type TransactionLinkFilter,
  type TransactionSearchMode,
  type TransactionTypeFilterOption,
  parseTxTypes,
} from '../../../lib/transactionFilters'
import {
  splitFilterSelections,
  parseAmountFilter,
  laterDate,
  earlierDate,
  type LedgerTxType,
  type LedgerReloadFilter,
} from './ledgerViewTypes'

interface ServerFetchCriteria {
  page: number
  search: string
  searchMode?: TransactionSearchMode
  filters: string[]
  txType: LedgerTxType
  reloadFilter?: LedgerReloadFilter
  accountIds: string[]
  startDate: string
  endDate: string
  minAmount: string
  maxAmount: string
  recurringFilter: TransactionLinkFilter
  wishlistFilter: TransactionLinkFilter
  sort: TransactionSort
  pSize: number
}

/**
 * Everything that changes which rows a server page should contain, as one comparable string.
 *
 * Arrays are joined rather than stringified so a reordered but equivalent selection does not read
 * as a change. background is deliberately absent: it changes how a fetch is presented, not what it
 * asks for, so a background revalidation must not be mistaken for new criteria.
 *
 * The dates signed are the *effective* bounds the request will carry, not the raw filter fields.
 * The scoped range ('3month'/'6month'/'yearly') and the selected cycle narrow those bounds without
 * touching any filter, so signing the raw fields made a year change — or a jump from the last 3
 * cycles to the last 6 — read as identical criteria and skip the refetch, leaving the previous
 * window's rows, total and page count on screen.
 */
function serverFetchSignature(
  criteria: ServerFetchCriteria,
  allCyclesRange: { startDate: string; endDate: string } | null,
): string {
  return JSON.stringify([
    criteria.page,
    criteria.pSize,
    criteria.sort,
    criteria.search,
    criteria.searchMode ?? "contains",
    [...criteria.filters].sort().join(","),
    parseTxTypes(criteria.txType).slice().sort().join(","),
    criteria.reloadFilter ?? "all",
    [...criteria.accountIds].sort().join(","),
    laterDate(allCyclesRange?.startDate, criteria.startDate) ?? "",
    earlierDate(allCyclesRange?.endDate, criteria.endDate) ?? "",
    criteria.minAmount,
    criteria.maxAmount,
    criteria.recurringFilter,
    criteria.wishlistFilter,
  ])
}

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
  incomingReloadFilter?: LedgerReloadFilter
  incomingAccountIds?: string[]
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
  appliedReloadFilter: LedgerReloadFilter
  appliedAccountIds: string[]
  appliedTxTypeFilter: TransactionTypeFilterOption[]
  setPendingSearchTerm: (term: string) => void
  setPendingFilters: (filters: string[]) => void
  setPendingStartDate: (date: string) => void
  setPendingEndDate: (date: string) => void
  setPendingMinAmount: (amount: string) => void
  setPendingMaxAmount: (amount: string) => void
  setPendingRecurringFilter: (filter: TransactionLinkFilter) => void
  setPendingWishlistFilter: (filter: TransactionLinkFilter) => void
  setPendingReloadFilter: (filter: LedgerReloadFilter) => void
  setPendingAccountIds: (ids: string[]) => void
  setPendingTxTypeFilter: (type: TransactionTypeFilterOption[] | ((prev: TransactionTypeFilterOption[]) => TransactionTypeFilterOption[])) => void
  setAppliedSearch: (term: string) => void
  setAppliedFilters: (filters: string[]) => void
  setAppliedStartDate: (date: string) => void
  setAppliedEndDate: (date: string) => void
  setAppliedMinAmount: (amount: string) => void
  setAppliedMaxAmount: (amount: string) => void
  setAppliedRecurringFilter: (filter: TransactionLinkFilter) => void
  setAppliedWishlistFilter: (filter: TransactionLinkFilter) => void
  setAppliedReloadFilter: (filter: LedgerReloadFilter) => void
  setAppliedAccountIds: (ids: string[]) => void
  setAppliedTxTypeFilter: (type: TransactionTypeFilterOption[] | ((prev: TransactionTypeFilterOption[]) => TransactionTypeFilterOption[])) => void
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
    incomingReloadFilter,
    incomingAccountIds,
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
    appliedReloadFilter,
    appliedAccountIds,
    appliedTxTypeFilter,
    setPendingSearchTerm,
    setPendingFilters,
    setPendingStartDate,
    setPendingEndDate,
    setPendingMinAmount,
    setPendingMaxAmount,
    setPendingRecurringFilter,
    setPendingWishlistFilter,
    setPendingReloadFilter,
    setPendingAccountIds,
    setPendingTxTypeFilter,
    setAppliedSearch,
    setAppliedFilters,
    setAppliedStartDate,
    setAppliedEndDate,
    setAppliedMinAmount,
    setAppliedMaxAmount,
    setAppliedRecurringFilter,
    setAppliedWishlistFilter,
    setAppliedReloadFilter,
    setAppliedAccountIds,
    setAppliedTxTypeFilter,
  } = options

  const [serverResult, setServerResult] = useState<PagedTransactionResult | null>(null)
  const [serverIsFetching, setServerIsFetching] = useState(false)
  const [serverIsReplacingRows, setServerIsReplacingRows] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [recentlySyncedIds, setRecentlySyncedIds] = useState<Set<string>>(new Set())

  // The signature of the criteria the newest fetch was issued for, written synchronously when the
  // request goes out. The refetch effect compares against it, which both dedupes the initial fetch
  // and — unlike the boolean flag this replaced — cannot swallow a filter applied while that first
  // request is still in flight. Flipping a ref inside .finally() causes no re-render, so the
  // effect never re-ran to notice the newer criteria.
  const lastFetchSignatureRef = useRef<string | null>(null)
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
    reloadFilter?: LedgerReloadFilter
    accountIds: string[]
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
    lastFetchSignatureRef.current = serverFetchSignature(opts, allCyclesRange)
    const sequence = ++fetchSequenceRef.current
    fetchAbortRef.current?.abort()
    const controller = new AbortController()
    fetchAbortRef.current = controller
    setServerIsFetching(true)
    setServerIsReplacingRows(!opts.background)
    setServerError(null)
    try {
      const { buckets, categories: cats } = splitFilterSelections(opts.filters)
      const result = await onFetchPagedTransactions({
        page: opts.page,
        pageSize: opts.pSize,
        search: opts.search || undefined,
        searchMode: opts.searchMode ?? 'contains',
        ledgerCategories: buckets.length > 0 ? buckets : undefined,
        categories: cats.length > 0 ? cats : undefined,
        txType: opts.txType || null,
        reloadFilter: opts.reloadFilter && opts.reloadFilter !== 'all' ? opts.reloadFilter : undefined,
        accountIds: opts.accountIds,
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
      const initialTxType = parseTxTypes(incomingTxType)
      const initialReloadFilter = incomingReloadFilter ?? 'all'
      const initialAccountIds = incomingAccountIds ?? []
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
      setPendingReloadFilter(initialReloadFilter)
      setPendingAccountIds(initialAccountIds)
      setPendingTxTypeFilter(initialTxType)
      setAppliedSearch(initialSearch)
      setAppliedFilters(initialFilters)
      setAppliedStartDate(initialStartDate)
      setAppliedEndDate(initialEndDate)
      setAppliedMinAmount(initialMinAmount)
      setAppliedMaxAmount(initialMaxAmount)
      setAppliedRecurringFilter(initialRecurringFilter)
      setAppliedWishlistFilter(initialWishlistFilter)
      setAppliedReloadFilter(initialReloadFilter)
      setAppliedAccountIds(initialAccountIds)
      setAppliedTxTypeFilter(initialTxType)
      setCurrentPage(1)
      runServerFetch({
        page: 1,
        search: initialSearch,
        searchMode: appliedSearchMode,
        filters: initialFilters,
        txType: initialTxType,
        reloadFilter: initialReloadFilter,
        accountIds: initialAccountIds,
        startDate: initialStartDate,
        endDate: initialEndDate,
        minAmount: initialMinAmount,
        maxAmount: initialMaxAmount,
        recurringFilter: initialRecurringFilter,
        wishlistFilter: initialWishlistFilter,
        sort: sortOrder,
        pSize: allCyclesPageSize,
      })
    } else {
      wasAllCyclesRef.current = false
      setServerResult(null)
      setServerError(null)
      setServerIsReplacingRows(false)
      lastFetchSignatureRef.current = null
    }
  }, [showAllCycles, onFetchPagedTransactions, runServerFetch, allCyclesRange, incomingCategory, incomingFilters, incomingTxType, incomingReloadFilter, incomingAccountIds, incomingSearch, incomingDate, incomingStartDate, incomingEndDate, incomingMinAmount, incomingMaxAmount, incomingRecurringFilter, incomingWishlistFilter, sortOrder, allCyclesPageSize, setPendingSearchTerm, setPendingFilters, setPendingStartDate, setPendingEndDate, setPendingMinAmount, setPendingMaxAmount, setPendingRecurringFilter, setPendingWishlistFilter, setPendingReloadFilter, setPendingAccountIds, setPendingTxTypeFilter, setAppliedSearch, setAppliedFilters, setAppliedStartDate, setAppliedEndDate, setAppliedMinAmount, setAppliedMaxAmount, setAppliedRecurringFilter, setAppliedWishlistFilter, setAppliedReloadFilter, setAppliedAccountIds, setAppliedTxTypeFilter, setCurrentPage])

  useEffect(() => {
    if (!showAllCycles || !onFetchPagedTransactions) return
    const criteria = {
      page: currentPage,
      search: appliedSearch,
      searchMode: appliedSearchMode,
      filters: appliedFilters,
      txType: appliedTxTypeFilter,
      reloadFilter: appliedReloadFilter,
      accountIds: appliedAccountIds,
      startDate: appliedStartDate,
      endDate: appliedEndDate,
      minAmount: appliedMinAmount,
      maxAmount: appliedMaxAmount,
      recurringFilter: appliedRecurringFilter,
      wishlistFilter: appliedWishlistFilter,
      sort: sortOrder,
      pSize: pageSize,
    }
    if (serverFetchSignature(criteria, allCyclesRange) !== lastFetchSignatureRef.current) {
      runServerFetch(criteria)
    }
  }, [currentPage, pageSize, showAllCycles, onFetchPagedTransactions, runServerFetch, appliedSearch, appliedSearchMode, appliedFilters, appliedTxTypeFilter, appliedReloadFilter, appliedAccountIds, appliedStartDate, appliedEndDate, appliedMinAmount, appliedMaxAmount, appliedRecurringFilter, appliedWishlistFilter, allCyclesRange, sortOrder])

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
    if (showAllCycles && prevActiveSyncId.current !== null && activeSyncId === null && onFetchPagedTransactions && wasAllCyclesRef.current) {
      runServerFetch({
        page: currentPage,
        search: appliedSearch,
        searchMode: appliedSearchMode,
        filters: appliedFilters,
        txType: appliedTxTypeFilter,
        reloadFilter: appliedReloadFilter,
        accountIds: appliedAccountIds,
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
  }, [activeSyncId, showAllCycles, currentPage, appliedSearch, appliedSearchMode, appliedFilters, appliedTxTypeFilter, appliedReloadFilter, appliedAccountIds, appliedStartDate, appliedEndDate, appliedMinAmount, appliedMaxAmount, appliedRecurringFilter, appliedWishlistFilter, pageSize, onFetchPagedTransactions, runServerFetch, sortOrder])

  // Re-fetch server result when deletingTxId transitions from non-null to null (delete completed)
  const prevDeletingTxId = useRef<string | null>(null)
  useEffect(() => {
    if (showAllCycles && prevDeletingTxId.current !== null && deletingTxId === null && onFetchPagedTransactions && wasAllCyclesRef.current) {
      runServerFetch({
        page: currentPage,
        search: appliedSearch,
        searchMode: appliedSearchMode,
        filters: appliedFilters,
        txType: appliedTxTypeFilter,
        reloadFilter: appliedReloadFilter,
        accountIds: appliedAccountIds,
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
  }, [deletingTxId, showAllCycles, currentPage, appliedSearch, appliedSearchMode, appliedFilters, appliedTxTypeFilter, appliedReloadFilter, appliedAccountIds, appliedStartDate, appliedEndDate, appliedMinAmount, appliedMaxAmount, appliedRecurringFilter, appliedWishlistFilter, pageSize, onFetchPagedTransactions, runServerFetch, sortOrder])

  const retryServerFetch = useCallback(() => runServerFetch({
    page: currentPage, search: appliedSearch, searchMode: appliedSearchMode, filters: appliedFilters,
    txType: appliedTxTypeFilter, reloadFilter: appliedReloadFilter, accountIds: appliedAccountIds, startDate: appliedStartDate, endDate: appliedEndDate,
    minAmount: appliedMinAmount, maxAmount: appliedMaxAmount,
    recurringFilter: appliedRecurringFilter, wishlistFilter: appliedWishlistFilter,
    sort: sortOrder, pSize: pageSize,
  }), [currentPage, appliedSearch, appliedSearchMode, appliedFilters, appliedTxTypeFilter, appliedReloadFilter, appliedAccountIds, appliedStartDate, appliedEndDate, appliedMinAmount, appliedMaxAmount, appliedRecurringFilter, appliedWishlistFilter, sortOrder, pageSize, runServerFetch])

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
