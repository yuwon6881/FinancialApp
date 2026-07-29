import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import * as api from '../lib/api'
import type {
  Transaction,
  RecurringPayment,
  RecurringReminderSettings,
  TransactionCategory,
  WishlistItem,
  DashboardData,
  AutocompleteSuggestion,
  PendingNotification,
  TransactionDocumentChanges,
} from '../types'
import { CACHE_KEYS, getCachedJSON, getCachedTransactions, getCachedWishlist, sanitizeTransactions, setCachedJSON, hasCachedKey, getCachedDashboardPeriod, setCachedCycleSnapshot } from '../lib/cache'
import { computeNextOccurrenceDate } from '../lib/recurringPayments'
import { useOptimisticList } from '../lib/useOptimisticList'
import { computeOptimisticDashboard } from '../lib/optimisticDashboard'
import { useOutbox } from '../lib/useOutbox'
import { backupModalDraftsOnLogout, restoreModalDraftsOnLogin, clearAllModalDrafts } from '../lib/modalDrafts'
import { createFinalId, createLocalWishlistId, projectSettingPreference, sanitizeQueuedOps, type OutboxPayload } from '../lib/outbox'
import { triggerHaptic } from '../lib/haptics'
import { getErrorMessage, getErrorName, hasHttpStatus, isAuthError, isLockError, JUST_LOGGED_IN_WINDOW_MS } from '../lib/errors'
import { formatCurrencyVal, SENSITIVE_AMOUNT_MASK } from '../lib/utils'
import { CategoryReplacementSelect } from '../components/ui/CategoryReplacementSelect'

// Boot payload in the tuple order loadAll's commit path already expects, so switching to
// /api/bootstrap did not require reshuffling everything downstream of it.
type LoadAllTuple = readonly [
  api.BootstrapPayload['dashboard'],
  Transaction[],
  RecurringPayment[],
  TransactionCategory[],
  WishlistItem[] | null,
  AutocompleteSuggestion[],
  number | null,
  api.BootstrapPayload['insights'],
]

/**
 * Attempts the single-request boot path, returning null when the caller should fall back to
 * the per-endpoint fan-out.
 *
 * Only a 404 triggers the fallback: that specifically means "this server has no /api/bootstrap"
 * (an installed PWA can outlive the API version it shipped against). Any other failure —
 * auth, lock, offline, 5xx — is a real error that the fan-out would hit too, so it propagates
 * and keeps loadAll's existing error handling in charge.
 */
async function fetchBootstrapPayload(
  month: string | undefined,
  year: number | undefined,
  signal: AbortSignal,
): Promise<LoadAllTuple | null> {
  try {
    const payload = await api.fetchBootstrap(month, year, signal)
    return [
      payload.dashboard,
      payload.transactions,
      payload.recurringPayments,
      payload.categories,
      payload.wishlist,
      payload.autocomplete,
      payload.walletBalance,
      payload.insights,
    ] as const
  } catch (bootstrapError: unknown) {
    // A 404 is the one recoverable case: the server has no such route. Everything else
    // (401, 423, offline, 5xx) would fail the fan-out too, so let loadAll's existing
    // handling deal with it rather than retrying eight times over a broken connection.
    if (!hasHttpStatus(bootstrapError, 404)) throw bootstrapError
    console.warn('This server has no /api/bootstrap endpoint; loading each slice separately.')
    return null
  }
}

export interface UseFinancialDataOptions {
  token: string | null
  username: string
  usernameRef: React.MutableRefObject<string>
  lastUnlockedTimeRef: React.MutableRefObject<number>
  isLocked: boolean
  markSessionLocked: () => void
  handleLogout: () => Promise<void>
  hideSensitive: boolean
  darkMode: boolean
  showToast: (message: string, title?: string, tone?: any, action?: any) => void
  guardSensitive: () => boolean
  setConfirmModalData: (data: any) => void
  resolveHideSensitive: (value: boolean) => void
  markSensitivePreferenceUnavailable: () => void
  setDarkMode: (value: boolean) => void
  notifyOnLogin: boolean
  loadAllAbortRef: React.MutableRefObject<AbortController | null>
  selectedMonth: string
  setSelectedMonth: (month: string) => void
  selectedYear: number
  setSelectedYear: (year: number) => void
  setIsSwitchingCycle: (switching: boolean) => void
  setHasShownModalThisSession: (value: boolean) => void
  hasShownModalThisSession: boolean
  setShowLoginModal: (value: boolean) => void
}

/** Wake-up/connectivity tracing is noisy in production; keep it to dev builds. */
const debugLog = (...args: unknown[]) => {
  if (import.meta.env.DEV) console.log(...args)
}

const createLocalId = (prefix: string, separator = '_') => {
  return `${prefix}${separator}${Date.now()}${separator}${Math.random().toString(36).substring(2, 9)}`
}

export function useFinancialData(options: Omit<UseFinancialDataOptions, 'username' | 'usernameRef' | 'setIsSwitchingCycle'>) {
  const {
    token,
    lastUnlockedTimeRef,
    isLocked,
    markSessionLocked,
    handleLogout,
    hideSensitive,
    darkMode,
    showToast,
    guardSensitive,
    setConfirmModalData,
    resolveHideSensitive,
    markSensitivePreferenceUnavailable,
    setDarkMode,
    notifyOnLogin,
    loadAllAbortRef,
    selectedMonth,
    setSelectedMonth,
    selectedYear,
    setSelectedYear,
    setHasShownModalThisSession,
    hasShownModalThisSession,
    setShowLoginModal,
  } = options

  const [transactions, setTransactions] = useState<Transaction[]>(() => getCachedTransactions(CACHE_KEYS.transactions))
  const [recurringPayments, setRecurringPayments] = useState<RecurringPayment[]>(() => getCachedJSON(CACHE_KEYS.recurringPayments, []))
  const [categoriesList, setCategoriesList] = useState<TransactionCategory[]>(() => getCachedJSON(CACHE_KEYS.categories, []))
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(() => getCachedJSON(CACHE_KEYS.dashboardData, null))
  const [currentCycleDashboardData, setCurrentCycleDashboardData] = useState<DashboardData | null>(null)
  const [walletBalance, setWalletBalance] = useState<number | null>(() => getCachedJSON<number | null>(CACHE_KEYS.walletBalance, null))
  const [wishlist, setWishlist] = useState<WishlistItem[]>(() => getCachedWishlist(CACHE_KEYS.wishlist))
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<AutocompleteSuggestion[]>([])

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(() => !hasCachedKey(CACHE_KEYS.dashboardData))
  const [isOffline, setIsOffline] = useState<boolean>(() => typeof navigator !== 'undefined' ? !navigator.onLine : false)

  const isServerAwakeRef = useRef<boolean>(false)
  const loadAllSeqRef = useRef(0)
  const wakeUpCancelledRef = useRef(false)
  const wakeUpTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [draftTransactions, setDraftTransactions] = useState<Transaction[]>(() => {
    try {
      const stored = localStorage.getItem('draft_transactions')
      return sanitizeTransactions(stored ? JSON.parse(stored) : [])
    } catch {
      return []
    }
  })
  const pendingTransactionDocumentsRef = useRef(new Map<string, TransactionDocumentChanges>())

  // Persist draft transactions to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('draft_transactions', JSON.stringify(draftTransactions))
    } catch (storageError) {
      console.warn('Could not persist draft transactions locally.', storageError)
    }
  }, [draftTransactions])

  const toOutboxPayload = (value: object): OutboxPayload => ({ ...value })

  const [directSyncId, setDirectSyncId] = useState<string | null>(null)

  const {
    pendingOps,
    failedOps,
    activeOps,
    isBackgroundSyncing,
    activeSyncId: outboxActiveSyncId,
    deletingId: deletingTxId,
    syncCountdownMs,
    editingPendingId,
    enqueue,
    mutateQueue,
    snapshotForUndo,
    processQueue,
    setBackgroundSyncing: setIsBackgroundSyncing,
    setDeletingId: setDeletingTxId,
    setEditingPendingId,
    discardFailedOp,
    discardAllFailedOps,
    getPendingOps,
    getFailedOps,
    reset: resetOutbox,
  } = useOutbox({
    token: isLocked ? null : token,
    lastUnlockedTimeRef,
    setError,
    showToast,
    onAuthError: handleLogout,
    onLockError: markSessionLocked,
    refresh: async successfulOps => {
      const ops = successfulOps.map(({ op }) => op)
      for (const op of ops) {
        if (op.entity !== 'transaction' || (op.type !== 'add' && op.type !== 'update')) continue
        const documentChanges = pendingTransactionDocumentsRef.current.get(op.targetId)
        if (!documentChanges) continue

        try {
          for (const documentId of documentChanges.unlinkIds) {
            await api.updateDocument(documentId, { transactionId: null })
          }
          if (documentChanges.pending.length > 0) {
            // Imported lazily: this hook sits on the eager critical path, and the canvas
            // compression helper is only needed once a queued upload actually drains.
            const { compressImageFile } = await import('../lib/imageCompression')

            for (const pending of documentChanges.pending) {
              const uploadFile = await compressImageFile(pending.file)
              const uploaded = await api.uploadDocument(
                uploadFile,
                pending.taxYear,
                pending.documentType,
              )
              await api.updateDocument(uploaded.id, { transactionId: op.targetId })
            }
          }
        } catch (error) {
          showToast(
            getErrorMessage(error, 'The transaction was saved, but one or more document changes failed. Any uploaded document remains safe in the Document Vault.'),
            'Document Vault',
            'error',
          )
        } finally {
          pendingTransactionDocumentsRef.current.delete(op.targetId)
        }
      }

      const onlyInvestments = ops.length > 0 && ops.every(op => op.entity.startsWith('investment'))
      if (onlyInvestments) {
        const reconciliations: Promise<void>[] = []
        window.dispatchEvent(new CustomEvent('investment-sync', {
          detail: {
            operations: ops.map(op => op.id),
            acknowledge: (work: Promise<void>) => { reconciliations.push(work) },
          },
        }))
        await Promise.all(reconciliations)
        setError(null)
        isServerAwakeRef.current = true
        return
      }
      // NOTE: `delete` is intentionally excluded from this wishlist-only fast path.
      // Deleting a *purchased* wishlist item cascade-deletes its linked ledger
      // transaction on the backend (see WishlistService.DeleteWishlistItemAsync),
      // which also shifts dashboard/cycle balances. Refetching only the wishlist
      // would leave that deleted transaction lingering in FE state/cache until a
      // full reload (e.g. undoing a fast add-then-purchase). Route deletes through
      // the full reconcile below instead.
      const onlyWishlistCrud = ops.length > 0 && ops.every(op =>
        op.entity === 'wishlistItem'
        && (op.type === 'add' || op.type === 'update')
      )
      if (onlyWishlistCrud) {
        const wishes = await api.fetchWishlist()
        setWishlist(wishes)
        setCachedJSON(CACHE_KEYS.wishlist, wishes)
        setError(null)
        isServerAwakeRef.current = true
        return
      }

      const onlyCategoryAdds = ops.length > 0 && ops.every(op =>
        op.entity === 'category' && op.type === 'add'
      )
      if (onlyCategoryAdds) {
        const categories = await api.fetchCategories()
        setCategoriesList(categories)
        setCachedJSON(CACHE_KEYS.categories, categories)
        setError(null)
        isServerAwakeRef.current = true
        return
      }

      // Transactions, recurring payments, purchases, category deletion, and
      // full settings updates can affect multiple derived dashboard values.
      // Reconcile those together and propagate any failure so completed
      // optimistic operations remain projected until a later successful fetch.
      await loadAll(selectedMonth || undefined, selectedYear || undefined, true, true)
      if (ops.some(op => op.entity === 'settings' && typeof op.payload?.currency === 'string')) {
        window.dispatchEvent(new CustomEvent('investment-sync'))
      }
    },
  })

  const activeSyncId = outboxActiveSyncId || directSyncId

  // `loadAll` reads the queue only to project the hide-sensitive preference. Routing
  // it through a ref keeps the queue out of `loadAll`'s identity -- otherwise every
  // enqueue/dequeue tears down and restarts the wake-up ping effect downstream.
  const activeOpsRef = useRef(activeOps)
  useEffect(() => { activeOpsRef.current = activeOps }, [activeOps])

  // Fetch initial ledger and dashboard statistics
  const loadAllInner = useCallback(async (
    month?: string,
    year?: number,
    isBackground = false,
    rethrowOnError = false,
    shouldCommit?: () => boolean,
  ) => {
    if (!token) return
    const requestSeq = ++loadAllSeqRef.current
    const isStale = () => requestSeq !== loadAllSeqRef.current
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

      const [dbData, txs, recs, cats, wishes, autoSuggests, wallet, insights] = bootstrapped ?? await (async () => {
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
          insightsPromise
        ] as const)
      })()

      if (isStale() || shouldCommit?.() === false) return
      if (wallet !== null) {
        setWalletBalance(wallet)
        setCachedJSON(CACHE_KEYS.walletBalance, wallet)
      }
      const effectiveHideSensitive = projectSettingPreference(
        'hideSensitive',
        dbData.setting.hideSensitive ?? true,
        activeOpsRef.current,
      )
      const mergedDashboard: DashboardData = {
        ...dbData,
        setting: {
          ...dbData.setting,
          hideSensitive: effectiveHideSensitive,
        },
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
      setSelectedMonth(dbData.setting.selectedMonth)
      setSelectedYear(dbData.setting.selectedYear)
      setDashboardData(mergedDashboard)
      setTransactions(txs)
      setRecurringPayments(recs)
      setCategoriesList(cats)
      if (wishes !== null) {
        setWishlist(wishes)
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
      setCachedCycleSnapshot(dbData.setting.selectedMonth, dbData.setting.selectedYear, mergedDashboard, txs)

      // A concrete server value is an explicit user choice; null means "never chosen",
      // so we follow the OS/browser scheme — matching the login screen — and keep the
      // preference unset locally so it keeps tracking the OS.
      const serverDark = dbData.setting.darkMode
      const effectiveDarkMode = projectSettingPreference(
        'darkMode',
        serverDark,
        activeOpsRef.current
      )
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
  }, [token, lastUnlockedTimeRef, handleLogout, markSessionLocked, setDarkMode, resolveHideSensitive, markSensitivePreferenceUnavailable, notifyOnLogin, hasShownModalThisSession, setShowLoginModal, loadAllAbortRef, setSelectedMonth, setSelectedYear])

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

  // Backup outbox/drafts on logout
  const handleLogoutCleanup = useCallback(async (currentOwner: string, createBackup = true) => {
    // A new login must perform its own wake-up and initial fetch. Also invalidate
    // the outgoing session's request so its finally block cannot hide the next
    // session's loading skeleton after logout.
    loadAllSeqRef.current += 1
    loadAllAbortRef.current?.abort()
    loadAllAbortRef.current = null
    isServerAwakeRef.current = false

    const currentPending = getPendingOps()
    const currentDrafts = draftTransactions
    const currentFailed = getFailedOps()

    if (createBackup) {
      let backupFailed = false
      const tryBackup = (key: string, value: unknown) => {
        try {
          localStorage.setItem(key, JSON.stringify(value))
        } catch (backupError) {
          backupFailed = true
          console.error(`Could not back up ${key} during logout.`, backupError)
        }
      }

      if (currentPending.length > 0) {
        tryBackup('pending_operations_backup', { owner: currentOwner, ops: currentPending })
      }
      if (currentDrafts.length > 0) {
        tryBackup('draft_transactions_backup', { owner: currentOwner, transactions: currentDrafts })
      }
      if (currentFailed.length > 0) {
        tryBackup('failed_operations_backup', { owner: currentOwner, ops: currentFailed })
      }

      try {
        backupModalDraftsOnLogout(currentOwner)
      } catch (backupError) {
        backupFailed = true
        console.error('Could not back up modal drafts during logout.', backupError)
      }

      if (backupFailed) {
        showToast(
          'Some unsynced local changes could not be backed up, but sign-out will continue.',
          'Local backup unavailable',
          'warning',
        )
      }
    }

    setDashboardData(null)
    setWalletBalance(null)
    setTransactions([])
    setRecurringPayments([])
    resetOutbox()
    setDraftTransactions([])
    pendingTransactionDocumentsRef.current.clear()
    setCategoriesList([])
    setWishlist([])
    setSelectedMonth('')
    setSelectedYear(0)
    setLoading(true)

    // Clear LocalStorage cache
    for (const key of [
      CACHE_KEYS.dashboardData,
      CACHE_KEYS.transactions,
      CACHE_KEYS.recurringPayments,
      CACHE_KEYS.categories,
      CACHE_KEYS.wishlist,
      CACHE_KEYS.walletBalance,
      CACHE_KEYS.pendingTransactions,
      CACHE_KEYS.pendingOperations,
      'failed_operations',
      'draft_transactions',
    ]) {
      try {
        localStorage.removeItem(key)
      } catch (storageError) {
        console.warn(`Could not remove local storage key ${key}.`, storageError)
      }
    }
    try {
      clearAllModalDrafts()
    } catch (storageError) {
      console.warn('Could not clear modal drafts.', storageError)
    }
  }, [getPendingOps, getFailedOps, draftTransactions, resetOutbox, setSelectedMonth, setSelectedYear, showToast])

  // Restore backups on login
  const handleLoginSuccessRestore = useCallback((newUsername: string) => {
    // The token state update causes wakeUpAndSync to run on the next render. Reset
    // the previous session's wake state and show the foreground skeleton until
    // that first dashboard payload arrives.
    isServerAwakeRef.current = false
    setLoading(true)
    setError(null)

    const cachedOpsBackup = localStorage.getItem('pending_operations_backup') || localStorage.getItem('pending_transactions_backup')
    if (cachedOpsBackup) {
      let consumedOrCorrupt = false
      try {
        const parsed = JSON.parse(cachedOpsBackup)
        if (parsed && parsed.owner === newUsername) {
          consumedOrCorrupt = true
          const backedUpOps = sanitizeQueuedOps(parsed.ops || parsed.transactions)
          if (backedUpOps.length > 0) {
            mutateQueue(() => backedUpOps)
            setCachedJSON(CACHE_KEYS.pendingOperations, backedUpOps)
          }
        }
      } catch (e) {
        console.error('Failed to parse backed up pending operations:', e)
        consumedOrCorrupt = true
      }
      if (consumedOrCorrupt) {
        localStorage.removeItem('pending_operations_backup')
        localStorage.removeItem('pending_transactions_backup')
      }
    }

    const cachedDraftBackup = localStorage.getItem('draft_transactions_backup')
    if (cachedDraftBackup) {
      let consumedOrCorrupt = false
      try {
        const parsed = JSON.parse(cachedDraftBackup)
        if (parsed && parsed.owner === newUsername) {
          consumedOrCorrupt = true
          const backedUpDrafts = sanitizeTransactions(parsed.transactions)
          if (backedUpDrafts.length > 0) {
            setDraftTransactions(backedUpDrafts)
            localStorage.setItem('draft_transactions', JSON.stringify(backedUpDrafts))
          }
        }
      } catch (e) {
        console.error('Failed to parse backed up draft transactions:', e)
        consumedOrCorrupt = true
      }
      if (consumedOrCorrupt) {
        localStorage.removeItem('draft_transactions_backup')
      }
    }

    const cachedFailedBackup = localStorage.getItem('failed_operations_backup')
    if (cachedFailedBackup) {
      let consumedOrCorrupt = false
      try {
        const parsed = JSON.parse(cachedFailedBackup)
        if (parsed && parsed.owner === newUsername) {
          consumedOrCorrupt = true
          const backedUpFailed = sanitizeQueuedOps(parsed.ops).map(op => ({ ...op, retryCount: 0 }))
          if (backedUpFailed.length > 0) {
            mutateQueue(prev => {
              const merged = [...prev, ...backedUpFailed]
              setCachedJSON(CACHE_KEYS.pendingOperations, merged)
              return merged
            })
          }
        }
      } catch (e) {
        console.error('Failed to parse backed up failed operations:', e)
        consumedOrCorrupt = true
      }
      if (consumedOrCorrupt) {
        localStorage.removeItem('failed_operations_backup')
      }
    }

    restoreModalDraftsOnLogin(newUsername)
  }, [mutateQueue])

  // Server wake-up and background sync task
  const wakeUpAndSync = useCallback(async () => {
    if (!token) return
    wakeUpCancelledRef.current = false
    let attempts = 0
    const maxAttempts = 15
    const runPing = async () => {
      if (wakeUpCancelledRef.current || !token || isServerAwakeRef.current) return
      try {
        const res = await api.pingServer()
        if (wakeUpCancelledRef.current) return
        if (res && res.status !== 'waking_up') {
          debugLog('Server is awake! Performing initial load and processing queue...')
          isServerAwakeRef.current = true
          const { month: cachedMonth, year: cachedYear } = getCachedDashboardPeriod()
          await loadAll(cachedMonth, cachedYear, true)
          if (!wakeUpCancelledRef.current) processQueue()
          return
        }
      } catch (err) {
        if (!wakeUpCancelledRef.current) debugLog('Wake-up ping failed:', err)
      }
      attempts++
      if (attempts < maxAttempts && !wakeUpCancelledRef.current) {
        wakeUpTimeoutRef.current = setTimeout(runPing, 5000)
      }
    }
    runPing()
  }, [token, processQueue, loadAll])

  // Proactively reflect browser connectivity
  useEffect(() => {
    const handleConnectivityOnline = () => setIsOffline(false)
    const handleConnectivityOffline = () => setIsOffline(true)
    window.addEventListener('online', handleConnectivityOnline)
    window.addEventListener('offline', handleConnectivityOffline)
    return () => {
      window.removeEventListener('online', handleConnectivityOnline)
      window.removeEventListener('offline', handleConnectivityOffline)
    }
  }, [])

  // Trigger wakeUpAndSync on mount or online status change
  useEffect(() => {
    if (!token) {
      isServerAwakeRef.current = false
      return
    }

    void wakeUpAndSync()
    const handleOnline = () => {
      debugLog('Browser went online, starting wake-up ping...')
      void wakeUpAndSync()
    }
    window.addEventListener('online', handleOnline)
    return () => {
      window.removeEventListener('online', handleOnline)
      wakeUpCancelledRef.current = true
      if (wakeUpTimeoutRef.current) {
        clearTimeout(wakeUpTimeoutRef.current)
        wakeUpTimeoutRef.current = null
      }
    }
  }, [token, wakeUpAndSync])

  const allTransactions = useOptimisticList(transactions, activeOps, 'transaction')
  const allRecurringPayments = useOptimisticList(recurringPayments, activeOps, 'recurringPayment')
  const allWishlist = useOptimisticList(wishlist, activeOps, 'wishlistItem')
  const allCategories = useOptimisticList(categoriesList, activeOps, 'category')

  const optimisticDashboardData = useMemo(
    () => computeOptimisticDashboard(dashboardData, { activeOps, transactions }),
    [dashboardData, activeOps, transactions]
  )

  const formatSensitive = useCallback((val: number) => {
    const formatted = formatCurrencyVal(val, optimisticDashboardData?.setting?.currency || 'USD')
    return hideSensitive ? SENSITIVE_AMOUNT_MASK : formatted
  }, [hideSensitive, optimisticDashboardData?.setting?.currency])

  const totalBalance = walletBalance ?? allTransactions.reduce((acc, t) => acc + t.amount, 0)

  const handleUpdateSettings = (settings: {
    targetStabilityFund: number
    essentialsAlloc: number
    growthAlloc: number
    stabilityAlloc: number
    rewardsAlloc: number
    cycleDay: number
    currency?: string
    stabilityOverflowRedirect?: string
    darkMode?: boolean
    hideSensitive?: boolean
  }) => {
    const payload = {
      ...settings,
      darkMode: settings.darkMode ?? darkMode,
      hideSensitive: settings.hideSensitive ?? hideSensitive,
    }
    mutateQueue(prev => enqueue(prev, 'settings', 'update', 'settings', payload))
  }

  const handleUpdateDarkModePreference = (value: boolean) => {
    mutateQueue(prev => enqueue(prev, 'settings', 'update', 'darkMode', { darkMode: value }))
  }

  const handleUpdateHideSensitivePreference = (value: boolean) => {
    setDashboardData(previous => {
      if (!previous) return previous
      const next = {
        ...previous,
        setting: {
          ...previous.setting,
          hideSensitive: value,
        },
      }
      setCachedJSON(CACHE_KEYS.dashboardData, next)
      return next
    })
    mutateQueue(prev => enqueue(prev, 'settings', 'update', 'hideSensitive', { hideSensitive: value }))
  }

  // Acknowledge (or silently adopt) the end-of-cycle summary for a given cycle key. Patches the
  // marker into local dashboard state + cache immediately so the once-per-cycle trigger won't
  // re-fire before the server write round-trips, then queues the durable server update.
  const handleMarkSummarySeen = (cycleKey: string) => {
    const patchSetting = (data: DashboardData | null) =>
      data ? { ...data, setting: { ...data.setting, lastSummaryCycleSeen: cycleKey } } : data
    setDashboardData(prev => {
      const next = patchSetting(prev)
      if (next) setCachedJSON(CACHE_KEYS.dashboardData, next)
      return next
    })
    mutateQueue(prev => enqueue(prev, 'settings', 'update', 'summarySeen', { cycleKey }))
  }

  const handleAddCategory = (newCat: Omit<TransactionCategory, 'id'>) => {
    if (!guardSensitive()) return
    const finalId = createFinalId('category')
    mutateQueue(prev => enqueue(prev, 'category', 'add', finalId, { ...newCat, id: finalId }))
  }

  const handleUpdateCategoryCycleLimit = (id: string, cycleLimit: number | null) => {
    if (!guardSensitive()) return
    mutateQueue(prev => enqueue(prev, 'category', 'update', id, { cycleLimit }))
  }

  const handleDeleteCategory = (id: string, replacementCategoryId?: string) => {
    snapshotForUndo('category', String(id), allCategories.find(cat => String(cat.id) === String(id)))
    mutateQueue(prev => enqueue(prev, 'category', 'delete', id, replacementCategoryId ? { replacementCategoryId } : undefined))
  }

  const requestDeleteCategory = async (id: string) => {
    if (!guardSensitive()) return
    const category = categoriesList.find(cat => cat.id === id)
    if (!category) return
    const replacementOptions = categoriesList.filter(cat => {
      const lower = cat.name.toLowerCase()
      return cat.id !== id && lower !== 'transfer' && lower !== 'adjustment' && !cat.isPendingDelete
    })
    let transactionCount = 0
    let usageLookupFailed = false
    try {
      const usage = await api.fetchPagedTransactions({ page: 1, pageSize: 1, categories: [category.name] })
      transactionCount = usage.total
    } catch (err) {
      console.error(err)
      usageLookupFailed = true
    }
    const recurringPaymentCount = allRecurringPayments.filter(payment =>
      !payment.isPendingDelete && payment.category.trim().toLowerCase() === category.name.trim().toLowerCase()
    ).length
    const requiresReplacement = usageLookupFailed || transactionCount > 0 || recurringPaymentCount > 0
    let selectedReplacementId = ''
    setConfirmModalData({
      title: 'Delete Category',
      message: (
        <div className={`space-y-3 ${requiresReplacement ? 'pb-36' : ''}`}>
          <p>Delete "{category.name}"?</p>
          {requiresReplacement ? (
            <>
              <p>
                This category is used by {usageLookupFailed ? 'existing ledger transactions' : `${transactionCount} ledger transaction${transactionCount === 1 ? '' : 's'}`}
                {recurringPaymentCount > 0 ? ` and ${recurringPaymentCount} recurring payment${recurringPaymentCount === 1 ? '' : 's'}` : ''}.
                Choose a replacement category before deleting it.
              </p>
              <CategoryReplacementSelect
                options={replacementOptions}
                onChange={selected => {
                  selectedReplacementId = selected
                  setConfirmModalData((prev: any) => prev ? { ...prev, confirmDisabled: selectedReplacementId.length === 0 } : prev)
                }}
              />
              {replacementOptions.length === 0 && (
                <p className="text-[11px] font-semibold text-orange-500">
                  Add another category before deleting this one.
                </p>
              )}
            </>
          ) : (
            <p>No ledger transactions or recurring payments currently use this category.</p>
          )}
        </div>
      ),
      confirmText: requiresReplacement ? 'Transfer and Delete' : 'Delete',
      confirmDisabled: requiresReplacement,
      onConfirm: () => {
        handleDeleteCategory(id, selectedReplacementId || undefined)
      }
    })
  }

  const handleApplyCategoryCleanupSuggestion = async (suggestion: any, targetCategoryOverride?: string) => {
    if (!guardSensitive()) return
    if (suggestion.type === 'consolidate' && !targetCategoryOverride) {
      showToast('Choose a category to move these entries to first.', 'AI Cleanup', 'warning')
      return
    }
    const actions = suggestion.type === 'add'
      ? [{ type: 'add' as const, newCategoryName: suggestion.newCategoryName || undefined }]
      : suggestion.type === 'merge'
      ? [{ type: 'merge' as const, categories: suggestion.categories, targetCategory: suggestion.targetCategory || undefined }]
      : suggestion.type === 'consolidate'
      ? [{ type: 'merge' as const, categories: suggestion.categories, targetCategory: targetCategoryOverride }]
      : [{ type: 'delete' as const, categories: suggestion.categories }]

    try {
      const result = await api.applyCategoryCleanup(actions)
      await loadAll(selectedMonth, selectedYear, true)
      if (result.appliedCount === 0) {
        showToast('No category changes were applied.', 'AI Cleanup', 'info')
        return
      }
      const undoAction = result.undoActions.length > 0
        ? {
            label: 'Undo',
            onAction: () => {
              void (async () => {
                try {
                  await api.applyCategoryCleanup(result.undoActions)
                  await loadAll(selectedMonth, selectedYear, true)
                  showToast('AI cleanup was undone.', 'Undo successful', 'success')
                } catch (err: unknown) {
                  showToast(getErrorMessage(err, 'Could not undo AI cleanup.'), 'Undo failed', 'error')
                }
              })()
            }
          }
        : undefined
      showToast(
        `${result.appliedCount} AI category cleanup action${result.appliedCount === 1 ? '' : 's'} applied.`,
        'AI Cleanup Applied',
        'success',
        undoAction
      )
    } catch (err: unknown) {
      showToast(getErrorMessage(err, 'Could not apply AI category cleanup.'), 'AI Cleanup Failed', 'error')
    }
  }

  const handleAddTransaction = (
    newTx: Omit<Transaction, 'id'>,
    setActiveTab: any,
    documentChanges?: TransactionDocumentChanges,
  ) => {
    const drafts = handleStageDraftTransactions([newTx])
    if (documentChanges && (documentChanges.pending.length > 0 || documentChanges.unlinkIds.length > 0)) {
      pendingTransactionDocumentsRef.current.set(drafts[0].id, documentChanges)
    }
    setActiveTab('drafts')
    return drafts[0].id
  }

  const handleStageDraftTransactions = (newTransactions: Omit<Transaction, 'id'>[]) => {
    if (newTransactions.length === 0) return []
    const drafts = newTransactions.map(transaction => ({
      ...transaction,
      id: createLocalId('draft'),
      isPendingSync: true,
    }))
    setDraftTransactions(prev => [...prev, ...drafts])
    void triggerHaptic(15)
    return drafts
  }

  const handleAddBalanceAdjustment = (newTx: Omit<Transaction, 'id'>) => {
    const finalId = createFinalId('transaction')
    void triggerHaptic(20)
    mutateQueue(prev => enqueue(prev, 'transaction', 'add', finalId, { ...newTx, id: finalId }))
  }

  const handleUpdateDraftTransaction = (id: string, updated: Transaction) => {
    if (!guardSensitive()) return
    setDraftTransactions(prev => prev.map(t => t.id === id ? updated : t))
    void triggerHaptic(15)
  }

  const handleDeleteDraftTransaction = (id: string) => {
    pendingTransactionDocumentsRef.current.delete(id)
    setDraftTransactions(prev => prev.filter(t => t.id !== id))
    void triggerHaptic(30)
  }

  const requestDeleteDraftTransaction = (id: string) => {
    if (!guardSensitive()) return
    const draft = draftTransactions.find(t => t.id === id)
    setConfirmModalData({
      title: 'Delete Draft',
      message: `Delete draft "${draft?.description || 'transaction'}"? This removes it from the draft queue before it is synced.`,
      confirmText: 'Delete',
      onConfirm: () => handleDeleteDraftTransaction(id)
    })
  }

  const handleSyncDraftBatch = () => {
    if (draftTransactions.length === 0) return
    const drafts = draftTransactions
    setDraftTransactions([])
    void triggerHaptic([25, 45, 25])
    mutateQueue(prev => {
      let nextQueue = prev
      drafts.forEach(d => {
        const finalId = createFinalId('transaction')
        const documentChanges = pendingTransactionDocumentsRef.current.get(d.id)
        if (documentChanges) {
          pendingTransactionDocumentsRef.current.delete(d.id)
          pendingTransactionDocumentsRef.current.set(finalId, documentChanges)
        }
        const payload = { ...d, id: finalId }
        delete payload.isPendingSync
        nextQueue = enqueue(nextQueue, 'transaction', 'add', finalId, payload)
      })
      return nextQueue
    })
  }

  const handleDeleteTransaction = (id: string) => {
    if (!guardSensitive()) return
    void triggerHaptic(30)
    let deleteId = id
    if (id.includes('-split-')) {
      deleteId = id.split('-split-')[0]
    }
    setDeletingTxId(deleteId)
    snapshotForUndo('transaction', deleteId, allTransactions.find(t => String(t.id) === deleteId))
    mutateQueue(prev => enqueue(prev, 'transaction', 'delete', deleteId))
    if (deleteId === editingPendingId) setEditingPendingId(null)
  }

  const handleUpdateTransaction = (
    id: string,
    updatedTx: Omit<Transaction, 'id'>,
    documentChanges?: TransactionDocumentChanges,
  ) => {
    if (!guardSensitive()) return
    void triggerHaptic(15)
    snapshotForUndo('transaction', String(id), allTransactions.find(t => String(t.id) === String(id)))
    if (documentChanges && (documentChanges.pending.length > 0 || documentChanges.unlinkIds.length > 0)) {
      pendingTransactionDocumentsRef.current.set(id, documentChanges)
    }
    mutateQueue(prev => enqueue(prev, 'transaction', 'update', id, updatedTx))
    if (id === editingPendingId) setEditingPendingId(null)
  }

  const handleConfirmSubscription = (noti: PendingNotification, paidDate: string) => {
    if (!guardSensitive()) return
    const finalId = createFinalId('transaction')
    mutateQueue(prev => enqueue(prev, 'transaction', 'add', finalId, {
      id: finalId,
      date: paidDate,
      description: noti.name,
      amount: -Math.abs(noti.amount),
      category: noti.category,
      ledgerCategory: noti.ledgerCategory,
      recurringPaymentId: noti.recurringPaymentId,
      recurringOccurrenceDate: noti.billingDate
    }))
  }

  const handleDiscardSubscription = (noti: PendingNotification) => {
    if (!guardSensitive()) return
    const finalId = createFinalId('transaction')
    mutateQueue(prev => enqueue(prev, 'transaction', 'add', finalId, {
      id: finalId,
      date: noti.billingDate,
      description: `[Discarded] ${noti.name}`,
      amount: 0,
      category: noti.category,
      ledgerCategory: 'Discarded',
      recurringPaymentId: noti.recurringPaymentId,
      recurringOccurrenceDate: noti.billingDate
    }))
  }

  const handleAddPayment = (newPay: Omit<RecurringPayment, 'id'>) => {
    const finalId = createFinalId('recurringPayment')
    mutateQueue(prev => enqueue(prev, 'recurringPayment', 'add', finalId, { ...newPay, id: finalId, active: true }))
  }

  const handleToggleActive = (id: string) => {
    if (!guardSensitive()) return
    const current = allRecurringPayments.find(p => String(p.id) === String(id))
    const payload = current ? { active: !current.active } : undefined
    mutateQueue(prev => enqueue(prev, 'recurringPayment', 'toggle', id, payload))
  }

  const handleUpdatePayment = (id: string, payment: RecurringPayment) => {
    if (!guardSensitive()) return
    snapshotForUndo('recurringPayment', String(id), allRecurringPayments.find(p => String(p.id) === String(id)))
    mutateQueue(prev => enqueue(prev, 'recurringPayment', 'update', id, toOutboxPayload(payment)))
  }

  const handleDeletePayment = (id: string) => {
    void triggerHaptic(30)
    snapshotForUndo('recurringPayment', String(id), allRecurringPayments.find(p => String(p.id) === String(id)))
    mutateQueue(prev => enqueue(prev, 'recurringPayment', 'delete', id))
  }

  const requestDeletePayment = (id: string) => {
    if (!guardSensitive()) return
    const payment = recurringPayments.find(p => p.id === id)
    setConfirmModalData({
      title: 'Delete Subscription',
      message: `Delete "${payment?.name || 'this recurring subscription'}"? This will cancel all future notifications for this subscription.`,
      confirmText: 'Delete',
      onConfirm: () => { handleDeletePayment(id) }
    })
  }

  const handleUpdateReminder = async (id: string, settings: RecurringReminderSettings) => {
    if (!guardSensitive()) return
    setDirectSyncId(id)
    const previous = recurringPayments.find(p => p.id === id)
    setRecurringPayments(prev => prev.map(p => p.id === id
      ? { ...p, reminderEnabled: settings.enabled, reminderMode: settings.mode, reminderLeadDays: settings.leadDays }
      : p
    ))
    try {
      await api.updateRecurringPaymentReminder(id, settings)
    } catch (err: unknown) {
      // Roll back only the three fields this handler owns, so a concurrent refresh
      // that changed other fields survives. Falling back to the current row keeps
      // the rollback sound when no pre-write snapshot was captured.
      setRecurringPayments(prev => prev.map(p => p.id !== id ? p : {
        ...p,
        reminderEnabled: previous?.reminderEnabled ?? p.reminderEnabled,
        reminderMode: previous?.reminderMode ?? p.reminderMode,
        reminderLeadDays: previous?.reminderLeadDays ?? p.reminderLeadDays,
      }))
      showToast(getErrorMessage(err, 'Could not update the payment reminder.'), 'Reminder Update Failed', 'error')
    } finally {
      setDirectSyncId(null)
    }
  }

  const handlePayEarly = async (id: string) => {
    const payment = allRecurringPayments.find(p => p.id === id)
    try {
      const result = await api.payRecurringPaymentEarly(id, payment?.nextDueDate || '')
      await loadAll(selectedMonth || undefined, selectedYear || undefined, true)
      setRecurringPayments(prev => prev.map(p => p.id === id
        ? { ...p, nextDueDate: result.nextOccurrenceDate || computeNextOccurrenceDate({ nextDueDate: result.settledOccurrenceDate, frequency: p.frequency }) }
        : p
      ))
      showToast(
        `${payment?.name || 'Subscription'} was paid early. Reminders for this cycle have stopped.`,
        'Paid Early',
        'success'
      )
    } catch (err: unknown) {
      showToast(getErrorMessage(err, 'Could not pay this subscription early.'), 'Pay Early Failed', 'error')
    }
  }

  const requestPayEarly = (id: string) => {
    if (!guardSensitive()) return
    const payment = allRecurringPayments.find(p => p.id === id)
    if (!payment) return
    const todayFormatted = new Date().toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
    setConfirmModalData({
      title: 'Pay Early',
      variant: 'primary',
      message: (
        <div className="space-y-3">
          <p className="text-sm">Pay <strong>{payment.name}</strong> before its scheduled date?</p>
          <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Amount</span>
              <strong className="text-foreground">{formatSensitive(Math.abs(payment.amount))}</strong>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Scheduled date</span>
              <span className="font-semibold text-foreground">{payment.nextDueDate}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Transaction date</span>
              <span className="font-semibold text-foreground">{todayFormatted}</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">The next due date will advance by one cycle after this payment.</p>
        </div>
      ),
      confirmText: 'Pay Now',
      onConfirm: () => { void handlePayEarly(id) }
    })
  }

  const handleAddWishlistItem = (newWish: Partial<WishlistItem>) => {
    const placeholderId = String(createLocalWishlistId())
    const payload = {
      name: newWish.name || '',
      price: newWish.price || 0,
      priority: newWish.priority || 'Medium',
      isPurchased: false,
      createdAt: new Date().toISOString(),
      isActive: newWish.isActive ?? false
    }
    mutateQueue(prev => enqueue(prev, 'wishlistItem', 'add', placeholderId, payload))
  }

  const handleUpdateWishlistItem = (id: number, updatedWish: WishlistItem) => {
    if (!guardSensitive()) return
    snapshotForUndo('wishlistItem', String(id), allWishlist.find(w => String(w.id) === String(id)))
    mutateQueue(prev => enqueue(prev, 'wishlistItem', 'update', String(id), toOutboxPayload(updatedWish)))
    if (String(id) === editingPendingId) setEditingPendingId(null)
  }

  const handleDeleteWishlistItem = (id: number) => {
    void triggerHaptic(30)
    snapshotForUndo('wishlistItem', String(id), allWishlist.find(w => String(w.id) === String(id)))
    mutateQueue(prev => enqueue(prev, 'wishlistItem', 'delete', String(id)))
  }

  const requestDeleteWishlistItem = (id: number) => {
    if (!guardSensitive()) return
    const item = wishlist.find(w => w.id === id)
    setConfirmModalData({
      title: 'Delete Wishlist Item',
      message: `Delete "${item?.name || 'this wishlist item'}"? This removes the savings goal from your wishlist.`,
      confirmText: 'Delete',
      onConfirm: () => { handleDeleteWishlistItem(id) }
    })
  }

  const handlePurchaseWishlistItem = (id: number, customDate?: string) => {
    if (!guardSensitive()) return
    const item = allWishlist.find(w => String(w.id) === String(id))
    const now = new Date()
    const date = customDate || now.toLocaleDateString('en-CA')
    const postedAt = customDate ? `${customDate}T12:00:00.000Z` : now.toISOString()
    mutateQueue(prev => enqueue(prev, 'wishlistItem', 'purchase', String(id), item ? {
      name: item.name,
      price: item.price,
      date,
      postedAt
    } : undefined))
  }

  const handleUnpurchaseWishlistItem = (id: number) => {
    if (!guardSensitive()) return
    const item = allWishlist.find(w => String(w.id) === String(id))
    mutateQueue(prev => enqueue(prev, 'wishlistItem', 'unpurchase', String(id), item ? {
      purchaseTransactionId: item.purchaseTransactionId
    } : undefined))
  }

  return {
    transactions,
    allTransactions,
    recurringPayments,
    allRecurringPayments,
    categoriesList,
    allCategories,
    wishlist,
    allWishlist,
    dashboardData,
    optimisticDashboardData,
    currentCycleDashboardData,
    setCurrentCycleDashboardData,
    walletBalance,
    totalBalance,
    autocompleteSuggestions,
    error,
    setError,
    loading,
    setLoading,
    isOffline,
    setIsOffline,
    isBackgroundSyncing,
    activeSyncId,
    deletingTxId,
    setDeletingTxId,
    syncCountdownMs,
    editingPendingId,
    setEditingPendingId,
    pendingOps,
    failedOps,
    activeOps,
    enqueue,
    mutateQueue,
    snapshotForUndo,
    processQueue,
    discardFailedOp,
    discardAllFailedOps,
    setTransactions,
    setDashboardData,
    loadAll,
    draftTransactions,
    setDraftTransactions,
    handleLogoutCleanup,
    handleLoginSuccessRestore,
    wakeUpAndSync,
    formatSensitive,
    handleUpdateSettings,
    handleUpdateDarkModePreference,
    handleUpdateHideSensitivePreference,
    handleMarkSummarySeen,
    handleAddCategory,
    handleUpdateCategoryCycleLimit,
    handleDeleteCategory,
    requestDeleteCategory,
    handleApplyCategoryCleanupSuggestion,
    handleAddTransaction,
    handleStageDraftTransactions,
    handleAddBalanceAdjustment,
    handleUpdateDraftTransaction,
    handleDeleteDraftTransaction,
    requestDeleteDraftTransaction,
    handleSyncDraftBatch,
    handleDeleteTransaction,
    handleUpdateTransaction,
    handleConfirmSubscription,
    handleDiscardSubscription,
    handleAddPayment,
    handleToggleActive,
    handleUpdatePayment,
    handleDeletePayment,
    requestDeletePayment,
    handleUpdateReminder,
    handlePayEarly,
    requestPayEarly,
    handleAddWishlistItem,
    handleUpdateWishlistItem,
    handleDeleteWishlistItem,
    requestDeleteWishlistItem,
    handlePurchaseWishlistItem,
    handleUnpurchaseWishlistItem,
  }
}
