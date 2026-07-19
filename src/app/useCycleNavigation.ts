import { useState, useRef, useCallback } from 'react'
import * as api from '../lib/api'
import { getCachedDashboardPeriod, getCachedCycleSnapshot } from '../lib/cache'

export interface UseCycleNavigationOptions {
  loadAll: (month?: string, year?: number, isBackground?: boolean) => void | Promise<void>
  handleLogout: () => void | Promise<void>
  markSessionLocked: () => void
  setDashboardData: (data: any) => void
  setTransactions: (txs: any) => void
  setActiveTab: (tab: any) => void
  setLedgerCyclesRange: (range: any) => void
}

export function useCycleNavigation(options: UseCycleNavigationOptions) {
  const { loadAll, handleLogout, markSessionLocked, setDashboardData, setTransactions, setActiveTab, setLedgerCyclesRange } = options

  const [selectedMonth, setSelectedMonth] = useState<string>(() => getCachedDashboardPeriod().month || '')
  const [selectedYear, setSelectedYear] = useState<number>(() => getCachedDashboardPeriod().year || 0)
  const [isSwitchingCycle, setIsSwitchingCycle] = useState<boolean>(false)

  const [ledgerIncomingCategory, setLedgerIncomingCategory] = useState<string | null>(null)
  const [ledgerIncomingDate, setLedgerIncomingDate] = useState<string | null>(null)
  const [ledgerIncomingTxType, setLedgerIncomingTxType] = useState<'inflow' | 'outflow' | 'transfer' | null>(null)
  const [ledgerShowAllCycles, setLedgerShowAllCycles] = useState(false)
  const [autoOpenLedgerAdd, setAutoOpenLedgerAdd] = useState(false)
  const [autoOpenSubscriptionAdd, setAutoOpenSubscriptionAdd] = useState(false)
  const [autoOpenWishlistAdd, setAutoOpenWishlistAdd] = useState(false)
  const [highlightedTxId, setHighlightedTxId] = useState<string | null>(null)
  const [highlightedRecurringId, setHighlightedRecurringId] = useState<string | null>(null)
  const [ledgerIncomingSearch, setLedgerIncomingSearch] = useState<string | null>(null)

  const selectPeriodSeqRef = useRef(0)

  const handleSelectPeriod = useCallback(async (month: string, year: number) => {
    const requestSeq = ++selectPeriodSeqRef.current
    const cachedSnapshot = getCachedCycleSnapshot(month, year)
    if (cachedSnapshot) {
      setDashboardData(cachedSnapshot.dashboardData)
      setTransactions(cachedSnapshot.transactions)
      setSelectedMonth(month)
      setSelectedYear(year)
    } else {
      setIsSwitchingCycle(true)
    }
    try {
      await api.selectPeriod(month, year)
      await loadAll(month, year, true)
    } catch (err: unknown) {
      if (requestSeq !== selectPeriodSeqRef.current) return
      console.error(err)
      const msg = String(err).toLowerCase()
      if (msg.includes('401') || msg.includes('unauthorized')) {
        void handleLogout()
      } else if (msg.includes('423')) {
        markSessionLocked()
      } else {
        alert('Error updating active month.')
      }
    } finally {
      if (requestSeq === selectPeriodSeqRef.current) {
        setIsSwitchingCycle(false)
      }
    }
  }, [loadAll, handleLogout, markSessionLocked, setDashboardData, setTransactions])

  const handleNavigateToLedger = useCallback((navOptions: {
    category?: string | null
    search?: string | null
    date?: string | null
    txType?: 'inflow' | 'outflow' | 'transfer' | null
    range?: 'monthly' | '3month' | '6month' | 'yearly'
    highlightedTxId?: string | null
    showAllCycles?: boolean
  }) => {
    setLedgerIncomingCategory(navOptions.category || null)
    setLedgerIncomingSearch(navOptions.search || null)
    setLedgerIncomingDate(navOptions.date || null)
    setLedgerIncomingTxType(navOptions.txType || null)
    const range = navOptions.range || 'monthly'
    setLedgerCyclesRange(range)
    const showAll = navOptions.showAllCycles !== undefined ? navOptions.showAllCycles : (range !== 'monthly')
    setLedgerShowAllCycles(showAll)
    if (navOptions.highlightedTxId) {
      setHighlightedTxId(navOptions.highlightedTxId)
    }
    setActiveTab('ledger')
  }, [setActiveTab, setLedgerCyclesRange])

  const handleNavigateToRecurring = useCallback((recurringPaymentId: string) => {
    setHighlightedRecurringId(recurringPaymentId)
    setActiveTab('recurring')
  }, [setActiveTab])

  const clearHighlightedRecurring = useCallback(() => {
    setHighlightedRecurringId(null)
  }, [])

  const handleQuickAction = useCallback((action: 'transaction' | 'subscription' | 'wishlist') => {
    if (action === 'transaction') {
      setActiveTab('ledger')
      setAutoOpenLedgerAdd(true)
    } else if (action === 'subscription') {
      setActiveTab('recurring')
      setAutoOpenSubscriptionAdd(true)
    } else if (action === 'wishlist') {
      setActiveTab('wishlist')
      setAutoOpenWishlistAdd(true)
    }
  }, [setActiveTab])

  const clearIncomingFilters = useCallback(() => {
    setLedgerIncomingCategory(null)
    setLedgerIncomingSearch(null)
    setLedgerIncomingDate(null)
    setLedgerIncomingTxType(null)
    setHighlightedTxId(null)
  }, [])

  return {
    selectedMonth,
    setSelectedMonth,
    selectedYear,
    setSelectedYear,
    isSwitchingCycle,
    setIsSwitchingCycle,
    ledgerIncomingCategory,
    setLedgerIncomingCategory,
    ledgerIncomingDate,
    setLedgerIncomingDate,
    ledgerIncomingTxType,
    setLedgerIncomingTxType,
    ledgerShowAllCycles,
    setLedgerShowAllCycles,
    autoOpenLedgerAdd,
    setAutoOpenLedgerAdd,
    autoOpenSubscriptionAdd,
    setAutoOpenSubscriptionAdd,
    autoOpenWishlistAdd,
    setAutoOpenWishlistAdd,
    highlightedTxId,
    setHighlightedTxId,
    highlightedRecurringId,
    setHighlightedRecurringId,
    ledgerIncomingSearch,
    setLedgerIncomingSearch,
    handleSelectPeriod,
    handleNavigateToLedger,
    handleNavigateToRecurring,
    clearHighlightedRecurring,
    handleQuickAction,
    clearIncomingFilters,
  }
}
