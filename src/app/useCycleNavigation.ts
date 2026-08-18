import { useState, useRef, useCallback, useEffect } from 'react'
import * as api from '../lib/api'
import { getCachedDashboardPeriod, getCachedCycleSnapshot } from '../lib/cache'
import type { AppTab, DashboardData, Transaction } from '../types'
import type { TransactionLinkFilter } from '../lib/transactionFilters'
import {
  ledgerRouteSearch,
  readAppLocation,
  updateAppSearch,
  type AppNavigationOptions,
  type LedgerRouteRange,
  type LedgerRouteState,
} from '../lib/appLocation'

/** Where a caller already knows a new posting belongs, before the form opens. */
export interface LedgerAddPrefill {
  category?: string
  ledgerCategory?: 'Essentials' | 'Growth' | 'Stability' | 'Rewards'
  accountId?: string
  description?: string
}

export interface UseCycleNavigationOptions {
  loadAll: (month?: string, year?: number, isBackground?: boolean, shouldCommit?: () => boolean) => void | Promise<void>
  handleLogout: () => void | Promise<void>
  markSessionLocked: () => void
  setDashboardData: (data: DashboardData) => void
  setTransactions: (transactions: Transaction[]) => void
  setActiveTab: (tab: AppTab, navigationOptions?: AppNavigationOptions) => void
  setLedgerCyclesRange: (range: LedgerRouteRange) => void
  showAlert?: (message: string, title?: string) => void
  persistPeriod?: (month: string, year: number) => void | Promise<void>
}

const areStringArraysEqual = (a: readonly string[] = [], b: readonly string[] = []): boolean =>
  a.length === b.length && a.every((val, i) => val === b[i])

const areLedgerStatesEqual = (
  a: Omit<LedgerRouteState, 'highlightedTxId'>,
  b: Omit<LedgerRouteState, 'highlightedTxId'>,
): boolean =>
  areStringArraysEqual(a.filters, b.filters) &&
  a.search === b.search &&
  a.startDate === b.startDate &&
  a.endDate === b.endDate &&
  a.minAmount === b.minAmount &&
  a.maxAmount === b.maxAmount &&
  a.recurringFilter === b.recurringFilter &&
  a.wishlistFilter === b.wishlistFilter &&
  a.txType === b.txType &&
  a.showAllCycles === b.showAllCycles &&
  a.range === b.range

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

  const [ledgerRouteState, setLedgerRouteState] = useState<Omit<LedgerRouteState, 'highlightedTxId'>>(initialLocation.ledger)
  const {
    filters: ledgerIncomingFilters,
    search: ledgerIncomingSearch,
    startDate: ledgerIncomingStartDate,
    endDate: ledgerIncomingEndDate,
    minAmount: ledgerIncomingMinAmount,
    maxAmount: ledgerIncomingMaxAmount,
    recurringFilter: ledgerIncomingRecurringFilter,
    wishlistFilter: ledgerIncomingWishlistFilter,
    txType: ledgerIncomingTxType,
    showAllCycles: ledgerShowAllCycles,
  } = ledgerRouteState
  const setLedgerShowAllCycles = useCallback((showAllCycles: boolean) => {
    setLedgerRouteState(current => ({ ...current, showAllCycles }))
  }, [])
  const [autoOpenLedgerAdd, setAutoOpenLedgerAdd] = useState(false)
  const [autoOpenLedgerTxType, setAutoOpenLedgerTxType] = useState<'inflow' | 'outflow' | 'transfer' | null>(null)
  // A blank add form opened from somewhere that already knows where the money landed.
  // Like the tx-type flag it is a one-shot intent, cleared by the same reset the auto-open uses,
  // so returning to Ledger later opens an ordinary form.
  const [autoOpenLedgerPrefill, setAutoOpenLedgerPrefill] = useState<LedgerAddPrefill | null>(null)
  const [autoOpenReceiptSplit, setAutoOpenReceiptSplit] = useState(false)
  const [autoOpenSubscriptionAdd, setAutoOpenSubscriptionAdd] = useState(false)
  const [autoOpenWishlistAdd, setAutoOpenWishlistAdd] = useState(false)
  const [highlightedTxId, setHighlightedTxId] = useState<string | null>(initialLocation.ledger.highlightedTxId)
  const [highlightedRecurringId, setHighlightedRecurringId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return new URLSearchParams(window.location.search).get('subscription')
  })
  const [highlightedLoanId, setHighlightedLoanId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return new URLSearchParams(window.location.search).get('loan')
  })
  const [highlightedReportSection, setHighlightedReportSection] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return new URLSearchParams(window.location.search).get('focus')
  })
  const [highlightedReportCategory, setHighlightedReportCategory] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return new URLSearchParams(window.location.search).get('focusCategory')
  })
  const [highlightedAccountId, setHighlightedAccountId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return new URLSearchParams(window.location.search).get('account')
  })
  const [highlightedCommitmentId, setHighlightedCommitmentId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return new URLSearchParams(window.location.search).get('commitment')
  })
  const [highlightedRewardId, setHighlightedRewardId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return new URLSearchParams(window.location.search).get('reward')
  })
  const [highlightedDraftId, setHighlightedDraftId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return new URLSearchParams(window.location.search).get('draft')
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
    const range = navOptions.range || 'monthly'
    setLedgerCyclesRange(range)
    const showAll = navOptions.showAllCycles !== undefined ? navOptions.showAllCycles : (range !== 'monthly')
    const highlightedTxId = navOptions.highlightedTxId || null
    setLedgerRouteState({
      filters, search, startDate, endDate, minAmount, maxAmount,
      recurringFilter, wishlistFilter, txType: navOptions.txType || null,
      showAllCycles: showAll, range,
    })
    setHighlightedTxId(highlightedTxId)
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
        highlightedTxId,
      }),
    })
  }, [setActiveTab, setLedgerCyclesRange, handleSelectPeriod])

  const handleNavigateToRecurring = useCallback((recurringPaymentId: string) => {
    setHighlightedRecurringId(recurringPaymentId)
    setHighlightedLoanId(null)
    setActiveTab('recurring', { search: { subscription: recurringPaymentId, loan: null } })
  }, [setActiveTab])

  const clearHighlightedRecurring = useCallback(() => {
    setHighlightedRecurringId(null)
    updateAppSearch({ subscription: null })
  }, [])

  const handleNavigateToLoan = useCallback((loanId: string) => {
    setHighlightedLoanId(loanId)
    setHighlightedRecurringId(null)
    setActiveTab('recurring', { search: { loan: loanId, subscription: null } })
  }, [setActiveTab])

  const clearHighlightedLoan = useCallback(() => {
    setHighlightedLoanId(null)
    updateAppSearch({ loan: null })
  }, [])

  // Same arrival cue as a subscription jump, for the Reports sections the Today
  // exception cards point at; category is optional when the destination is a card inside it.
  const handleNavigateToReportSection = useCallback((section: string, category?: string | null) => {
    setHighlightedReportSection(section)
    setHighlightedReportCategory(category ?? null)
    setActiveTab('reports', { search: { focus: section, focusCategory: category ?? null } })
  }, [setActiveTab])

  const clearHighlightedReportSection = useCallback(() => {
    setHighlightedReportSection(null)
    setHighlightedReportCategory(null)
    updateAppSearch({ focus: null, focusCategory: null })
  }, [])

  const handleNavigateToAccounts = useCallback((targetIdOrBucket?: string | null) => {
    const target = targetIdOrBucket || '1'
    setHighlightedAccountId(target)
    setActiveTab('settings', { search: { account: target } })
  }, [setActiveTab])

  // Commitments, rewards and drafts arrive the same way a bill or a loan does. Search used to
  // drop the user on the page and leave them to find the row themselves, which for a long
  // rewards list is barely different from not having jumped at all. The two commitments/rewards
  // ids clear each other because the page shows one of the two lists at a time.
  const handleNavigateToCommitment = useCallback((savingsGoalId: string) => {
    setHighlightedCommitmentId(savingsGoalId)
    setHighlightedRewardId(null)
    setActiveTab('wishlist', { search: { commitment: savingsGoalId, reward: null } })
  }, [setActiveTab])

  const clearHighlightedCommitment = useCallback(() => {
    setHighlightedCommitmentId(null)
    updateAppSearch({ commitment: null })
  }, [])

  const handleNavigateToReward = useCallback((wishlistItemId: string) => {
    setHighlightedRewardId(wishlistItemId)
    setHighlightedCommitmentId(null)
    setActiveTab('wishlist', { search: { reward: wishlistItemId, commitment: null } })
  }, [setActiveTab])

  const clearHighlightedReward = useCallback(() => {
    setHighlightedRewardId(null)
    updateAppSearch({ reward: null })
  }, [])

  const handleNavigateToDraft = useCallback((draftId: string) => {
    setHighlightedDraftId(draftId)
    setActiveTab('drafts', { search: { draft: draftId } })
  }, [setActiveTab])

  const clearHighlightedDraft = useCallback(() => {
    setHighlightedDraftId(null)
    updateAppSearch({ draft: null })
  }, [])

  const clearHighlightedAccount = useCallback(() => {
    setHighlightedAccountId(null)
    updateAppSearch({ account: null })
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
    setLedgerRouteState(current => ({
      ...current,
      filters: [], search: '', startDate: '', endDate: '', minAmount: '', maxAmount: '',
      recurringFilter: 'all', wishlistFilter: 'all', txType: null,
    }))
    setHighlightedTxId(null)
  }, [])

  const syncLedgerRouteState = useCallback((state: Omit<LedgerRouteState, 'highlightedTxId'>) => {
    setLedgerRouteState(current => (areLedgerStatesEqual(current, state) ? current : state))
    setLedgerCyclesRange(state.range)
  }, [setLedgerCyclesRange])

  useEffect(() => {
    setLedgerCyclesRange(initialLocation.ledger.range)
  }, [])

  useEffect(() => {
    const handlePopState = () => {
      const location = readAppLocation()
      setLedgerRouteState(location.ledger)
      setLedgerCyclesRange(location.ledger.range)
      setHighlightedTxId(location.ledger.highlightedTxId)
      setHighlightedRecurringId(new URLSearchParams(window.location.search).get('subscription'))
      setHighlightedLoanId(new URLSearchParams(window.location.search).get('loan'))
      const reportSearch = new URLSearchParams(window.location.search)
      setHighlightedReportSection(reportSearch.get('focus'))
      setHighlightedReportCategory(reportSearch.get('focusCategory'))

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
    ledgerIncomingStartDate,
    ledgerIncomingEndDate,
    ledgerIncomingMinAmount,
    ledgerIncomingMaxAmount,
    ledgerIncomingRecurringFilter,
    ledgerIncomingWishlistFilter,
    ledgerIncomingTxType,
    ledgerShowAllCycles,
    setLedgerShowAllCycles,
    autoOpenLedgerAdd,
    setAutoOpenLedgerAdd,
    autoOpenLedgerTxType,
    setAutoOpenLedgerTxType,
    autoOpenLedgerPrefill,
    setAutoOpenLedgerPrefill,
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
    highlightedLoanId,
    highlightedCommitmentId,
    highlightedRewardId,
    highlightedDraftId,
    setHighlightedLoanId,
    highlightedReportSection,
    highlightedReportCategory,
    handleNavigateToReportSection,
    clearHighlightedReportSection,
    highlightedAccountId,
    setHighlightedAccountId,
    handleNavigateToAccounts,
    clearHighlightedAccount,
    ledgerIncomingSearch,
    handleSelectPeriod,
    handleNavigateToLedger,
    handleNavigateToRecurring,
    clearHighlightedRecurring,
    handleNavigateToLoan,
    clearHighlightedLoan,
    handleNavigateToCommitment,
    clearHighlightedCommitment,
    handleNavigateToReward,
    clearHighlightedReward,
    handleNavigateToDraft,
    clearHighlightedDraft,
    handleQuickAction,
    syncLedgerRouteState,
    clearIncomingFilters,
    clearHighlightedTx,
  }
}
