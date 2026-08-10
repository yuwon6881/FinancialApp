import { useState, useRef, useCallback, useEffect } from 'react'
import * as api from '../lib/api'
import { getCachedDashboardPeriod, getCachedCycleSnapshot } from '../lib/cache'
import type { AppTab } from '../types'
import type { TransactionLinkFilter } from '../lib/transactionFilters'
import {
  ledgerRouteSearch,
  readAppLocation,
  updateAppSearch,
  type AppNavigationOptions,
  type LedgerRouteRange,
} from '../lib/appLocation'

export interface UseCycleNavigationOptions {
  loadAll: (month?: string, year?: number, isBackground?: boolean, shouldCommit?: () => boolean) => void | Promise<void>
  handleLogout: () => void | Promise<void>
  markSessionLocked: () => void
  setDashboardData: (data: any) => void
  setTransactions: (txs: any) => void
  setActiveTab: (tab: AppTab, navigationOptions?: AppNavigationOptions) => void
  setLedgerCyclesRange: (range: LedgerRouteRange) => void
  showAlert?: (message: string, title?: string) => void
  persistPeriod?: (month: string, year: number) => void | Promise<void>
}

export function useCycleNavigation(options: UseCycleNavigationOptions) {
  const { loadAll, handleLogout, markSessionLocked, setDashboardData, setTransactions, setActiveTab, setLedgerCyclesRange, showAlert, persistPeriod = api.selectPeriod } = options

  const [initialLocation] = useState(readAppLocation)
  const cachedPeriod = getCachedDashboardPeriod()

  const [selectedMonth, setSelectedMonth] = useState<string>(() => initialLocation.month || cachedPeriod.month || '')
  const [selectedYear, setSelectedYear] = useState<number>(() => initialLocation.year || cachedPeriod.year || 0)
  const [isSwitchingCycle, setIsSwitchingCycle] = useState<boolean>(false)

  const selectedPeriodRef = useRef({ month: selectedMonth, year: selectedYear })
  useEffect(() => {
    selectedPeriodRef.current = { month: selectedMonth, year: selectedYear }
  }, [selectedMonth, selectedYear])

  const [ledgerIncomingFilters, setLedgerIncomingFilters] = useState<string[]>(initialLocation.ledger.filters)
  const [ledgerIncomingSearch, setLedgerIncomingSearch] = useState<string>(initialLocation.ledger.search)
  const [ledgerIncomingStartDate, setLedgerIncomingStartDate] = useState<string>(initialLocation.ledger.startDate)
  const [ledgerIncomingEndDate, setLedgerIncomingEndDate] = useState<string>(initialLocation.ledger.endDate)
  const [ledgerIncomingMinAmount, setLedgerIncomingMinAmount] = useState<string>(initialLocation.ledger.minAmount)
  const [ledgerIncomingMaxAmount, setLedgerIncomingMaxAmount] = useState<string>(initialLocation.ledger.maxAmount)
  const [ledgerIncomingRecurringFilter, setLedgerIncomingRecurringFilter] = useState<TransactionLinkFilter>(initialLocation.ledger.recurringFilter)
  const [ledgerIncomingWishlistFilter, setLedgerIncomingWishlistFilter] = useState<TransactionLinkFilter>(initialLocation.ledger.wishlistFilter)
  const [ledgerIncomingTxType, setLedgerIncomingTxType] = useState<'inflow' | 'outflow' | 'transfer' | null>(initialLocation.ledger.txType)
  const [ledgerShowAllCycles, setLedgerShowAllCycles] = useState(initialLocation.ledger.showAllCycles)
  const [autoOpenLedgerAdd, setAutoOpenLedgerAdd] = useState(false)
  const [autoOpenLedgerTxType, setAutoOpenLedgerTxType] = useState<'inflow' | 'outflow' | 'transfer' | null>(null)
  const [autoOpenReceiptSplit, setAutoOpenReceiptSplit] = useState(false)
  const [autoOpenSubscriptionAdd, setAutoOpenSubscriptionAdd] = useState(false)
  const [autoOpenWishlistAdd, setAutoOpenWishlistAdd] = useState(false)
  const [highlightedTxId, setHighlightedTxId] = useState<string | null>(initialLocation.ledger.highlightedTxId)
  const [highlightedRecurringId, setHighlightedRecurringId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return new URLSearchParams(window.location.search).get('subscription')
  })
  const [highlightedReportSection, setHighlightedReportSection] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return new URLSearchParams(window.location.search).get('focus')
  })

  const selectPeriodSeqRef = useRef(0)
  const selectPeriodQueueRef = useRef<Promise<void>>(Promise.resolve())

  const handleSelectPeriod = useCallback(async (month: string, year: number, syncLocation = true) => {
    const requestSeq = ++selectPeriodSeqRef.current
    if (syncLocation) updateAppSearch({ month, year }, { replace: false })
    setSelectedMonth(month)
    setSelectedYear(year)
    const cachedSnapshot = getCachedCycleSnapshot(month, year)
    if (cachedSnapshot) {
      setDashboardData(cachedSnapshot.dashboardData)
      setTransactions(cachedSnapshot.transactions)
    } else {
      setIsSwitchingCycle(true)
    }
    try {
      const selectRequest = selectPeriodQueueRef.current
        .catch(() => undefined)
        .then(() => persistPeriod(month, year))
      selectPeriodQueueRef.current = selectRequest.then(() => undefined, () => undefined)
      await selectRequest
      if (requestSeq !== selectPeriodSeqRef.current) return
      await loadAll(month, year, true, () => requestSeq === selectPeriodSeqRef.current)
    } catch (err: unknown) {
      if (requestSeq !== selectPeriodSeqRef.current) return
      console.error(err)
      const msg = String(err).toLowerCase()
      if (msg.includes('401') || msg.includes('unauthorized')) {
        void handleLogout()
      } else if (msg.includes('423')) {
        markSessionLocked()
      } else {
        showAlert?.('The active month could not be updated. Please try again.', 'Cycle update failed')
      }
    } finally {
      if (requestSeq === selectPeriodSeqRef.current) {
        setIsSwitchingCycle(false)
      }
    }
  }, [loadAll, handleLogout, markSessionLocked, setDashboardData, setTransactions, showAlert, persistPeriod])

  const handleNavigateToLedger = useCallback((navOptions: {
    category?: string | null
    search?: string | null
    date?: string | null
    // Explicit range bounds. `date` remains the shorthand for a single exact day and is used
    // for both ends when startDate/endDate are absent.
    startDate?: string | null
    endDate?: string | null
    minAmount?: string | null
    maxAmount?: string | null
    recurringFilter?: TransactionLinkFilter
    wishlistFilter?: TransactionLinkFilter
    /** Legacy navigation aliases; true maps to the new `only` mode. */
    recurringOnly?: boolean
    wishlistOnly?: boolean
    txType?: 'inflow' | 'outflow' | 'transfer' | null
    range?: 'monthly' | '3month' | '6month' | 'yearly'
    highlightedTxId?: string | null
    showAllCycles?: boolean
    // When set, first switch the active cycle to this period (monthly view) so a
    // transaction living in another cycle is actually present to scroll to/highlight.
    targetMonth?: string
    targetYear?: number
  }) => {
    // Jump to the transaction's own cycle before applying ledger state, so the
    // highlight/scroll (which searches the loaded single-cycle list) can find it.
    if (navOptions.targetMonth && navOptions.targetYear) {
      const current = selectedPeriodRef.current
      if (navOptions.targetMonth !== current.month || navOptions.targetYear !== current.year) {
        void handleSelectPeriod(navOptions.targetMonth, navOptions.targetYear)
      }
    }
    const filters = navOptions.category ? [navOptions.category] : []
    const search = navOptions.search || ''
    const startDate = navOptions.startDate || navOptions.date || ''
    const endDate = navOptions.endDate || navOptions.date || ''
    const minAmount = navOptions.minAmount || ''
    const maxAmount = navOptions.maxAmount || ''
    const recurringFilter: TransactionLinkFilter = navOptions.recurringFilter ?? (navOptions.recurringOnly === true ? 'only' : 'all')
    const wishlistFilter: TransactionLinkFilter = navOptions.wishlistFilter ?? (navOptions.wishlistOnly === true ? 'only' : 'all')
    setLedgerIncomingFilters(filters)
    setLedgerIncomingSearch(search)
    setLedgerIncomingStartDate(startDate)
    setLedgerIncomingEndDate(endDate)
    setLedgerIncomingMinAmount(minAmount)
    setLedgerIncomingMaxAmount(maxAmount)
    setLedgerIncomingRecurringFilter(recurringFilter)
    setLedgerIncomingWishlistFilter(wishlistFilter)
    setLedgerIncomingTxType(navOptions.txType || null)
    const range = navOptions.range || 'monthly'
    setLedgerCyclesRange(range)
    const showAll = navOptions.showAllCycles !== undefined ? navOptions.showAllCycles : (range !== 'monthly')
    setLedgerShowAllCycles(showAll)
    setHighlightedTxId(navOptions.highlightedTxId || null)
    setActiveTab('ledger', {
      search: ledgerRouteSearch({
        filters,
        search,
        startDate,
        endDate,
        minAmount,
        maxAmount,
        recurringFilter,
        wishlistFilter,
        txType: navOptions.txType || null,
        showAllCycles: showAll,
        range,
        highlightedTxId: navOptions.highlightedTxId || null,
      }),
    })
  }, [setActiveTab, setLedgerCyclesRange, handleSelectPeriod])

  const handleNavigateToRecurring = useCallback((recurringPaymentId: string) => {
    setHighlightedRecurringId(recurringPaymentId)
    setActiveTab('recurring', { search: { subscription: recurringPaymentId } })
  }, [setActiveTab])

  const clearHighlightedRecurring = useCallback(() => {
    setHighlightedRecurringId(null)
    updateAppSearch({ subscription: null })
  }, [])

  // Same arrival cue as a subscription jump, for the Reports sections the Today
  // exception cards point at.
  const handleNavigateToReportSection = useCallback((section: string) => {
    setHighlightedReportSection(section)
    setActiveTab('reports', { search: { focus: section } })
  }, [setActiveTab])

  const clearHighlightedReportSection = useCallback(() => {
    setHighlightedReportSection(null)
    updateAppSearch({ focus: null })
  }, [])

  // Receipt splitting is deliberately absent: it is not something to *open*, it
  // starts from the transaction form's scan picker. setAutoOpenReceiptSplit still
  // exists for the poller, which re-opens the editor for a background scan.
  const handleQuickAction = useCallback((action: 'transaction' | 'subscription' | 'wishlist', options?: { txType?: 'inflow' | 'outflow' | 'transfer' }) => {
    if (action === 'transaction') {
      setActiveTab('ledger')
      setAutoOpenLedgerAdd(true)
      setAutoOpenLedgerTxType(options?.txType || null)
    } else if (action === 'subscription') {
      setActiveTab('recurring')
      setAutoOpenSubscriptionAdd(true)
    } else if (action === 'wishlist') {
      setActiveTab('wishlist')
      setAutoOpenWishlistAdd(true)
    }
  }, [setActiveTab])

  // Drops only the ledger highlight, leaving any filters that arrived with it in place.
  const clearHighlightedTx = useCallback(() => {
    setHighlightedTxId(null)
    updateAppSearch({ tx: null })
  }, [])

  const clearIncomingFilters = useCallback(() => {
    // Keep the same array reference when it is already empty so callers (e.g. a
    // tab-change effect) cannot trigger a fresh-`[]`-driven re-render loop.
    setLedgerIncomingFilters(prev => (prev.length === 0 ? prev : []))
    setLedgerIncomingSearch('')
    setLedgerIncomingStartDate('')
    setLedgerIncomingEndDate('')
    setLedgerIncomingMinAmount('')
    setLedgerIncomingMaxAmount('')
    setLedgerIncomingRecurringFilter('all')
    setLedgerIncomingWishlistFilter('all')
    setLedgerIncomingTxType(null)
    setHighlightedTxId(null)
  }, [])

  useEffect(() => {
    setLedgerCyclesRange(initialLocation.ledger.range)
  }, [])

  useEffect(() => {
    const handlePopState = () => {
      const location = readAppLocation()
      setLedgerIncomingFilters(location.ledger.filters)
      setLedgerIncomingSearch(location.ledger.search)
      setLedgerIncomingStartDate(location.ledger.startDate)
      setLedgerIncomingEndDate(location.ledger.endDate)
      setLedgerIncomingMinAmount(location.ledger.minAmount)
      setLedgerIncomingMaxAmount(location.ledger.maxAmount)
      setLedgerIncomingRecurringFilter(location.ledger.recurringFilter)
      setLedgerIncomingWishlistFilter(location.ledger.wishlistFilter)
      setLedgerIncomingTxType(location.ledger.txType)
      setLedgerShowAllCycles(location.ledger.showAllCycles)
      setLedgerCyclesRange(location.ledger.range)
      setHighlightedTxId(location.ledger.highlightedTxId)
      setHighlightedRecurringId(new URLSearchParams(window.location.search).get('subscription'))
      setHighlightedReportSection(new URLSearchParams(window.location.search).get('focus'))

      const period = selectedPeriodRef.current
      if (location.month && location.year && (location.month !== period.month || location.year !== period.year)) {
        void handleSelectPeriod(location.month, location.year, false)
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [handleSelectPeriod, setLedgerCyclesRange])

  return {
    selectedMonth,
    setSelectedMonth,
    selectedYear,
    setSelectedYear,
    isSwitchingCycle,
    setIsSwitchingCycle,
    ledgerIncomingFilters,
    setLedgerIncomingFilters,
    ledgerIncomingStartDate,
    setLedgerIncomingStartDate,
    ledgerIncomingEndDate,
    setLedgerIncomingEndDate,
    ledgerIncomingMinAmount,
    setLedgerIncomingMinAmount,
    ledgerIncomingMaxAmount,
    setLedgerIncomingMaxAmount,
    ledgerIncomingRecurringFilter,
    setLedgerIncomingRecurringFilter,
    ledgerIncomingWishlistFilter,
    setLedgerIncomingWishlistFilter,
    ledgerIncomingTxType,
    setLedgerIncomingTxType,
    ledgerShowAllCycles,
    setLedgerShowAllCycles,
    autoOpenLedgerAdd,
    setAutoOpenLedgerAdd,
    autoOpenLedgerTxType,
    setAutoOpenLedgerTxType,
    autoOpenReceiptSplit,
    setAutoOpenReceiptSplit,
    autoOpenSubscriptionAdd,
    setAutoOpenSubscriptionAdd,
    autoOpenWishlistAdd,
    setAutoOpenWishlistAdd,
    highlightedTxId,
    setHighlightedTxId,
    highlightedRecurringId,
    setHighlightedRecurringId,
    highlightedReportSection,
    handleNavigateToReportSection,
    clearHighlightedReportSection,
    ledgerIncomingSearch,
    setLedgerIncomingSearch,
    handleSelectPeriod,
    handleNavigateToLedger,
    handleNavigateToRecurring,
    clearHighlightedRecurring,
    handleQuickAction,
    clearIncomingFilters,
    clearHighlightedTx,
  }
}
