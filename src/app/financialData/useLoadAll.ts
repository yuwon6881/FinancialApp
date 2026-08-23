import { useCallback, useRef } from 'react'
import * as api from '../../lib/api'
import type {
  AutocompleteSuggestion,
  DashboardData,
  LedgerAccount,
  RecurringPayment,
  SavingsGoal,
  Transaction,
  TransactionCategory,
  WishlistItem,
} from '../../types'
import { CACHE_KEYS, setCachedCycleSnapshot, setCachedJSON } from '../../lib/cache'
import { getErrorName, isAuthError, isLockError, JUST_LOGGED_IN_WINDOW_MS } from '../../lib/errors'
import { projectFinancialSetting, type QueuedOp } from '../../lib/outbox'
import { fetchBootstrapPayload } from './bootstrap'

interface LoadAllDependencies {
  token: string | null
  notifyOnLogin: boolean
  hasShownModalThisSession: boolean
  getActiveOps: () => QueuedOp[]
  getFailedOps: () => QueuedOp[]
  handleLogout: () => Promise<void>
  markSessionLocked: () => void
  markSensitivePreferenceUnavailable: () => void
  resolveHideSensitive: (value: boolean) => void
  setDarkMode: (value: boolean) => void
  isFinancialDataMountedRef: React.MutableRefObject<boolean>
  isServerAwakeRef: React.MutableRefObject<boolean>
  lastUnlockedTimeRef: React.MutableRefObject<number>
  loadAllAbortRef: React.MutableRefObject<AbortController | null>
  loadAllSeqRef: React.MutableRefObject<number>
  unconfirmedSettingWritesRef: React.MutableRefObject<Map<string, unknown>>
  setDashboardData: React.Dispatch<React.SetStateAction<DashboardData | null>>
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>
  setRecurringPayments: React.Dispatch<React.SetStateAction<RecurringPayment[]>>
  setCategoriesList: React.Dispatch<React.SetStateAction<TransactionCategory[]>>
  setWishlist: React.Dispatch<React.SetStateAction<WishlistItem[]>>
  setSavingsGoals: React.Dispatch<React.SetStateAction<SavingsGoal[]>>
  setAccounts: React.Dispatch<React.SetStateAction<LedgerAccount[]>>
  setWalletBalance: React.Dispatch<React.SetStateAction<number | null>>
  setAutocompleteSuggestions: React.Dispatch<React.SetStateAction<AutocompleteSuggestion[]>>
  setLoading: React.Dispatch<React.SetStateAction<boolean>>
  setIsBackgroundSyncing: (value: boolean) => void
  setError: React.Dispatch<React.SetStateAction<string | null>>
  setSelectedMonth: (month: string) => void
  setSelectedYear: (year: number) => void
  setHasShownModalThisSession: (value: boolean) => void
  setShowLoginModal: (value: boolean) => void
}

/**
 * The one path that fills the whole shell from the server: bootstrap on sign-in and every later
 * refresh. Concurrent background refreshes of the same cycle share a single request, and a stale
 * response is dropped rather than allowed to overwrite newer state or a queued preference.
 */
export function useLoadAll(deps: LoadAllDependencies) {
  const {
    token,
    notifyOnLogin,
    hasShownModalThisSession,
    getActiveOps,
    getFailedOps,
    handleLogout,
    markSessionLocked,
    markSensitivePreferenceUnavailable,
    resolveHideSensitive,
    setDarkMode,
    isFinancialDataMountedRef,
    isServerAwakeRef,
    lastUnlockedTimeRef,
    loadAllAbortRef,
    loadAllSeqRef,
    unconfirmedSettingWritesRef,
    setDashboardData,
    setTransactions,
    setRecurringPayments,
    setCategoriesList,
    setWishlist,
    setSavingsGoals,
    setAccounts,
    setWalletBalance,
    setAutocompleteSuggestions,
    setLoading,
    setIsBackgroundSyncing,
    setError,
    setSelectedMonth,
    setSelectedYear,
    setHasShownModalThisSession,
    setShowLoginModal,
  } = deps

  const loadAllInner = useCallback(async (
    month?: string,
    year?: number,
    isBackground = false,
    rethrowOnError = false,
    shouldCommit?: () => boolean,
  ) => {
    if (!token || !isFinancialDataMountedRef.current) return
    const requestSeq = ++loadAllSeqRef.current
    const isStale = () => !isFinancialDataMountedRef.current || requestSeq !== loadAllSeqRef.current
    // A preference can finish syncing while this request is in flight. Preserve
    // the request-start snapshot so an older bootstrap response cannot overwrite
    // that user choice after the outbox removes its completed operation.
    const activeOpsAtRequestStart = getActiveOps()
    loadAllAbortRef.current?.abort()
    const ac = new AbortController()
    loadAllAbortRef.current = ac
    if (!isBackground) {
      setLoading(true)
    } else {
      setIsBackgroundSyncing(true)
    }
    try {
      // One request for the whole payload (see api/bootstrap.ts). The fan-out below is the
      // fallback for a server that predates /api/bootstrap — a deployed PWA can outlive the
      // API version it shipped against, and an install that only ever gets a 404 here would
      // otherwise be permanently unable to load.
      const bootstrapped = await fetchBootstrapPayload(month, year, ac.signal)

      const [dbData, txs, recs, cats, wishes, autoSuggests, wallet, insights, goals, bootAccounts] = bootstrapped ?? await (async () => {
        const dashboardPromise = api.fetchDashboard(month, year, ac.signal)
        const transactionsPromise = (month && year !== undefined)
          ? api.fetchTransactions(month, year, undefined, ac.signal)
          : dashboardPromise.then(d => api.fetchTransactions(d.setting.selectedMonth, d.setting.selectedYear, undefined, ac.signal))
        const insightsPromise = (month && year !== undefined)
          ? api.fetchDashboardInsights(month, year, ac.signal)
          : dashboardPromise.then(d => api.fetchDashboardInsights(d.setting.selectedMonth, d.setting.selectedYear, ac.signal))

        return Promise.all([
          dashboardPromise,
          transactionsPromise,
          api.fetchRecurringPayments(ac.signal),
          api.fetchCategories(ac.signal),
          api.fetchWishlist(ac.signal).catch((wishlistError: unknown) => {
            if (getErrorName(wishlistError) === 'AbortError' || rethrowOnError) throw wishlistError
            console.warn('Could not refresh wishlist; keeping the last known local copy.', wishlistError)
            return null
          }),
          api.fetchAutocompleteSuggestions(ac.signal).catch(() => []),
          api.fetchWalletBalance(ac.signal).catch(() => null),
          insightsPromise,
          // Dynamic import keeps the savings-goal API module out of the eager bundle; this fan-out
          // is only the fallback path for a server without /api/bootstrap.
          import('../../lib/api/savingsGoals').then(m => m.fetchSavingsGoals(ac.signal)).catch((goalsError: unknown) => {
            if (getErrorName(goalsError) === 'AbortError' || rethrowOnError) throw goalsError
            console.warn('Could not refresh savings goals; keeping the last known local copy.', goalsError)
            return null
          }),
          import('../../lib/api/accounts').then(m => m.fetchLedgerAccounts(ac.signal)).catch((accountsError: unknown) => {
            if (getErrorName(accountsError) === 'AbortError' || rethrowOnError) throw accountsError
            console.warn('Could not refresh ledger accounts; keeping the last known local copy.', accountsError)
            return null
          }),
        ] as const)
      })()

      if (isStale() || shouldCommit?.() === false) return
      if (wallet !== null) {
        setWalletBalance(wallet)
        setCachedJSON(CACHE_KEYS.walletBalance, wallet)
      }
      // Read directly from the outbox refs at commit time. React's activeOps state
      // can still be one render behind when a user changes a preference while this
      // request is in flight.
      const failedOpIds = new Set(getFailedOps().map(op => op.id))
      const requestSettingOps = activeOpsAtRequestStart.filter(op => !failedOpIds.has(op.id))
      let effectiveSetting = projectFinancialSetting(dbData.setting, [
        ...requestSettingOps,
        ...getActiveOps(),
      ])
      for (const [key, localValue] of unconfirmedSettingWritesRef.current) {
        const serverValue = dbData.setting[key as keyof typeof dbData.setting]
        if (Object.is(serverValue, localValue)) {
          unconfirmedSettingWritesRef.current.delete(key)
        } else {
          effectiveSetting = { ...effectiveSetting, [key]: localValue }
        }
      }
      const effectiveHideSensitive = effectiveSetting.hideSensitive ?? true
      const mergedDashboard: DashboardData = {
        ...dbData,
        setting: effectiveSetting,
        last3CategoryBreakdown: insights.last3CategoryBreakdown,
        last6CategoryBreakdown: insights.last6CategoryBreakdown,
        yearlyCategoryBreakdown: insights.yearlyCategoryBreakdown,
        availableYears: insights.availableYears,
        stats: {
          ...dbData.stats,
          pastThreeMonthsRewardsAverage: insights.pastThreeMonthsRewardsAverage,
          hasRewardsHistory: insights.hasRewardsHistory
        }
      }
      setSelectedMonth(effectiveSetting.selectedMonth)
      setSelectedYear(effectiveSetting.selectedYear)
      setDashboardData(mergedDashboard)
      setTransactions(txs)
      setRecurringPayments(recs)
      setCategoriesList(cats)
      if (wishes !== null) {
        setWishlist(wishes)
      }
      if (Array.isArray(goals)) {
        setSavingsGoals(goals)
      }
      if (Array.isArray(bootAccounts)) {
        setAccounts(bootAccounts)
      }
      setAutocompleteSuggestions(autoSuggests)
      setError(null)
      isServerAwakeRef.current = true

      setCachedJSON(CACHE_KEYS.dashboardData, mergedDashboard)
      setCachedJSON(CACHE_KEYS.transactions, txs)
      setCachedJSON(CACHE_KEYS.recurringPayments, recs)
      setCachedJSON(CACHE_KEYS.categories, cats)
      if (wishes !== null) {
        setCachedJSON(CACHE_KEYS.wishlist, wishes)
      }
      if (Array.isArray(goals)) {
        setCachedJSON(CACHE_KEYS.savingsGoals, goals)
      }
      if (Array.isArray(bootAccounts)) {
        setCachedJSON(CACHE_KEYS.accounts, bootAccounts)
      }
      // This snapshot duplicates the two large payloads just written above. Let React paint
      // the fresh screen before serialising and rotating the offline cycle history.
      window.setTimeout(() => {
        if (!isStale()) {
          setCachedCycleSnapshot(effectiveSetting.selectedMonth, effectiveSetting.selectedYear, mergedDashboard, txs)
        }
      }, 0)

      // A concrete server value is an explicit user choice; null means "never chosen",
      // so we follow the OS/browser scheme — matching the login screen — and keep the
      // preference unset locally so it keeps tracking the OS.
      const effectiveDarkMode = effectiveSetting.darkMode
      if (effectiveDarkMode === true || effectiveDarkMode === false) {
        setDarkMode(effectiveDarkMode)
      } else {
        const osDark = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
          ? window.matchMedia('(prefers-color-scheme: dark)').matches
          : false
        setDarkMode(osDark)
      }

      resolveHideSensitive(effectiveHideSensitive)

      if (dbData.pendingNotifications && dbData.pendingNotifications.length > 0 && !hasShownModalThisSession) {
        if (notifyOnLogin) {
          setShowLoginModal(true)
        }
        setHasShownModalThisSession(true)
      }
    } catch (err: unknown) {
      if (getErrorName(err) === 'AbortError' || isStale() || shouldCommit?.() === false) {
        if (rethrowOnError) throw err
        return
      }
      console.error(err)
      const isJustLoggedIn = Date.now() - lastUnlockedTimeRef.current < JUST_LOGGED_IN_WINDOW_MS
      if (isAuthError(err)) {
        if (rethrowOnError) throw err
        if (!isJustLoggedIn) {
          void handleLogout()
        } else {
          setError(null)
        }
      } else if (isLockError(err)) {
        if (rethrowOnError) throw err
        markSessionLocked()
      } else {
        setError('Could not connect to the database API server. Running in offline view mode.')
        isServerAwakeRef.current = false
        markSensitivePreferenceUnavailable()
        if (rethrowOnError) throw err
      }
    } finally {
      if (!isStale()) {
        setLoading(false)
        setIsBackgroundSyncing(false)
      }
    }
  }, [token, lastUnlockedTimeRef, handleLogout, markSessionLocked, setDarkMode, resolveHideSensitive, markSensitivePreferenceUnavailable, notifyOnLogin, hasShownModalThisSession, setShowLoginModal, loadAllAbortRef, setSelectedMonth, setSelectedYear, getActiveOps, getFailedOps])

  /**
   * Coalesces concurrent background refreshes of the same cycle onto one request.
   *
   * Several mutations landing together each asked for a full reload; because loadAll aborts
   * the previous request before starting its own, that produced a burst of started-then-
   * cancelled fetches and only the last one's data. Callers awaiting an aborted reload also
   * returned before the new data arrived. Now the second caller awaits the first request.
   *
   * Only plain background refreshes are shared. A foreground load drives the loading skeleton,
   * and `rethrowOnError`/`shouldCommit` callers have per-call semantics that a shared promise
   * cannot honour, so those always get their own request.
   */
  const inFlightBackgroundLoadRef = useRef<{ key: string; promise: Promise<void> } | null>(null)

  const loadAll = useCallback(async (
    month?: string,
    year?: number,
    isBackground = false,
    rethrowOnError = false,
    shouldCommit?: () => boolean,
  ) => {
    const isShareable = isBackground && !rethrowOnError && !shouldCommit
    if (!isShareable) {
      return loadAllInner(month, year, isBackground, rethrowOnError, shouldCommit)
    }

    const key = `${month ?? ''}:${year ?? ''}`
    const inFlight = inFlightBackgroundLoadRef.current
    if (inFlight?.key === key) return inFlight.promise

    const promise = loadAllInner(month, year, true).finally(() => {
      if (inFlightBackgroundLoadRef.current?.promise === promise) {
        inFlightBackgroundLoadRef.current = null
      }
    })
    inFlightBackgroundLoadRef.current = { key, promise }
    return promise
  }, [loadAllInner])

  return loadAll
}
