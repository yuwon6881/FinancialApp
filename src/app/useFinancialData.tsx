import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import * as api from '../lib/api'
import type {
  AppTab,
  Transaction,
  RecurringPayment,
  RecurringReminderSettings,
  TransactionCategory,
  CategoryFlowType,
  WishlistItem,
  SavingsGoal,
  DashboardData,
  AutocompleteSuggestion,
  PendingNotification,
  TransactionDocumentChanges,
  Loan,
} from '../types'
import type { CategoryCleanupSuggestion } from '../lib/api'
import { CACHE_KEYS, getCachedJSON, getCachedTransactions, getCachedWishlist, sanitizeTransactions, setCachedJSON, hasCachedKey, setCachedCycleSnapshot } from '../lib/cache'
import { useOptimisticList } from '../lib/useOptimisticList'
import { useOutbox } from '../lib/useOutbox'
import { useStartupSync } from './useStartupSync'
import { useOptimisticDashboard } from './useOptimisticDashboard'
import { backupModalDraftsOnLogout, restoreModalDraftsOnLogin, clearAllModalDrafts } from '../lib/modalDrafts'
import { createFinalId, projectFinancialSetting, sanitizeQueuedOps, type OutboxPayload } from '../lib/outbox'
import { projectLoanStates } from '../lib/loanProjection'
import { triggerHaptic } from '../lib/haptics'
import { getErrorMessage, getErrorName, isAuthError, isLockError, JUST_LOGGED_IN_WINDOW_MS } from '../lib/errors'
import { formatCurrencyVal, SENSITIVE_AMOUNT_MASK } from '../lib/utils'
import { buildUndoSuccessToast } from '../lib/mutationToast'
import { computeNextOccurrenceDate, computeOccurrenceOnOrAfter } from '../lib/recurringPayments'
import { financialDate } from '../lib/financialDate'
import { buildStabilityPlanPoints, projectStabilityReloadStatuses } from '../lib/stabilityRecovery'
import type { ToastAction, ToastTone } from '../components/ui/ToastViewport'
import type { ConfirmModalData } from './useAppDialogs'
import { fetchBootstrapPayload } from './financialData/bootstrap'
import { createWishlistSavingsActions } from './financialData/wishlistSavingsActions'
import { createLoanActions } from './financialData/loanActions'
// Deliberately the deferred wrapper, not the picker itself: importing CategoryReplacementSelect
// directly here pulled its CustomSelect -> AnchoredPopover chain onto the eager critical path. See
// the comment in CategoryReplacementSelectLazy for the measurement.
import { CategoryReplacementSelectLazy } from '../components/ui/CategoryReplacementSelectLazy'

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
  showToast: (message: string, title?: string, tone?: ToastTone, action?: ToastAction) => void
  guardSensitive: () => boolean
  setConfirmModalData: React.Dispatch<React.SetStateAction<ConfirmModalData | null>>
  onRequestSensitiveReveal?: () => void
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

const createLocalId = (prefix: string, separator = '_') => {
  return `${prefix}${separator}${Date.now()}${separator}${Math.random().toString(36).substring(2, 9)}`
}

export function useFinancialData(options: Omit<UseFinancialDataOptions, 'usernameRef' | 'setIsSwitchingCycle'>) {
  const {
    token,
    username,
    lastUnlockedTimeRef,
    isLocked,
    markSessionLocked,
    handleLogout,
    hideSensitive,
    darkMode,
    showToast,
    guardSensitive,
    setConfirmModalData,
    onRequestSensitiveReveal,
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
  const [walletBalance, setWalletBalance] = useState<number | null>(() => getCachedJSON<number | null>(CACHE_KEYS.walletBalance, null))
  const [wishlist, setWishlist] = useState<WishlistItem[]>(() => getCachedWishlist(CACHE_KEYS.wishlist))
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>(() => getCachedJSON(CACHE_KEYS.savingsGoals, []))
  const [loans, setLoans] = useState<Loan[]>(() => getCachedJSON(CACHE_KEYS.loans, []))
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<AutocompleteSuggestion[]>([])

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(() => !hasCachedKey(CACHE_KEYS.dashboardData))
  const [isOffline, setIsOffline] = useState<boolean>(() => typeof navigator !== 'undefined' ? !navigator.onLine : false)

  const isServerAwakeRef = useRef<boolean>(false)
  const isFinancialDataMountedRef = useRef(true)
  const loadAllSeqRef = useRef(0)
  // Keep each locally chosen setting until a server snapshot explicitly confirms the
  // same value. Queue state alone is insufficient here: a fast settings write can leave
  // the outbox before an older, slower bootstrap response commits.
  const unconfirmedSettingWritesRef = useRef(new Map<string, unknown>())

  const [draftTransactions, setDraftTransactions] = useState<Transaction[]>(() => {
    try {
      const stored = localStorage.getItem('draft_transactions')
      return sanitizeTransactions(stored ? JSON.parse(stored) : [])
    } catch {
      return []
    }
  })
  const pendingTransactionDocumentsRef = useRef(new Map<string, TransactionDocumentChanges>())
  /** Vault documents to delete once their transaction's queued delete has actually synced. */
  const pendingTransactionDocumentDeletesRef = useRef(new Map<string, number[]>())

  /**
   * Merged, never replaced. `enqueue` collapses a second edit of the same transaction into the
   * queued add/update, so a plain `set` here dropped the first edit's uploads and detaches on the
   * floor — silently, and invisibly, since the form reads its existing documents from the server
   * and never showed the queued file at all.
   */
  const stageTransactionDocumentChanges = (targetId: string, changes: TransactionDocumentChanges) => {
    if (changes.pending.length === 0 && changes.unlinkIds.length === 0) return
    const existing = pendingTransactionDocumentsRef.current.get(targetId)
    pendingTransactionDocumentsRef.current.set(targetId, existing
      ? {
          pending: [...existing.pending, ...changes.pending],
          unlinkIds: [...new Set([...existing.unlinkIds, ...changes.unlinkIds])],
        }
      : changes)
  }

  useEffect(() => {
    unconfirmedSettingWritesRef.current.clear()
  }, [token])

  useEffect(() => {
    isFinancialDataMountedRef.current = true
    return () => {
      isFinancialDataMountedRef.current = false
      loadAllSeqRef.current += 1
      loadAllAbortRef.current?.abort()
      loadAllAbortRef.current = null
    }
  }, [loadAllAbortRef])

  // Persist draft transactions to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('draft_transactions', JSON.stringify(draftTransactions))
    } catch (storageError) {
      console.warn('Could not persist draft transactions locally.', storageError)
    }
  }, [draftTransactions])

  const toOutboxPayload = (value: object): OutboxPayload => ({ ...value })

  // Direct, authoritative POSTs are not outbox operations, but they still need the same
  // cross-page contract: the source row and any record created by the request stay visible
  // with a syncing state until the server has answered.
  const [directSyncIds, setDirectSyncIds] = useState<string[]>([])
  const [pendingLedgerTransactions, setPendingLedgerTransactions] = useState<Transaction[]>([])

  const beginDirectSync = useCallback((ids: Array<string | number>) => {
    const normalized = ids.map(String).filter(Boolean)
    if (normalized.length === 0) return
    setDirectSyncIds(previous => Array.from(new Set([...previous, ...normalized])))
  }, [])

  const endDirectSync = useCallback((ids: Array<string | number>) => {
    const toRemove = new Set(ids.map(String))
    setDirectSyncIds(previous => previous.filter(id => !toRemove.has(id)))
  }, [])

  const addPendingLedgerTransaction = useCallback((transaction: Transaction) => {
    setPendingLedgerTransactions(previous => [
      ...previous.filter(item => String(item.id) !== String(transaction.id)),
      transaction,
    ])
  }, [])

  const replacePendingLedgerTransaction = useCallback((pendingId: string, transaction: Transaction) => {
    setPendingLedgerTransactions(previous => previous.map(item =>
      String(item.id) === String(pendingId) ? { ...transaction, isPendingSync: false } : item,
    ))
  }, [])

  const removePendingLedgerTransaction = useCallback((id: string) => {
    setPendingLedgerTransactions(previous => previous.filter(item => String(item.id) !== String(id)))
  }, [])

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
    getActiveOps,
    getFailedOps,
    reset: resetOutbox,
  } = useOutbox({
    token: isLocked ? null : token,
    lastUnlockedTimeRef,
    setError,
    showToast,
    onAuthError: handleLogout,
    onLockError: markSessionLocked,
    onRequestSensitiveReveal,
    refresh: async successfulOps => {
      const ops = successfulOps.map(({ op }) => op)
      for (const op of ops) {
        if (op.entity !== 'transaction') continue

        if (op.type === 'delete') {
          const documentIds = pendingTransactionDocumentDeletesRef.current.get(op.targetId)
          if (!documentIds) continue
          pendingTransactionDocumentDeletesRef.current.delete(op.targetId)
          try {
            const { deleteDocument } = await import('../lib/api/documents')
            for (const documentId of documentIds) {
              await deleteDocument(documentId)
            }
          } catch (error) {
            showToast(
              getErrorMessage(error, 'The transaction was deleted, but its attached documents could not be removed. They are still in your Document Vault.'),
              'Document Vault',
              'error',
            )
          }
          continue
        }

        if (op.type !== 'add' && op.type !== 'update') continue
        const documentChanges = pendingTransactionDocumentsRef.current.get(op.targetId)
        if (!documentChanges) continue

        // An Undo tapped on the add's own success toast queues the delete while this refresh is
        // still running, so uploading here would attach files to a row that is about to go and
        // leave them orphaned in the vault with the user believing they undid the whole thing.
        if (getPendingOps().some(pending => pending.entity === 'transaction'
          && pending.type === 'delete'
          && pending.targetId === op.targetId)) {
          pendingTransactionDocumentsRef.current.delete(op.targetId)
          continue
        }

        try {
          // Both imported lazily: this hook sits on the eager critical path, while the
          // vault API and the canvas compression helper are only needed once a queued
          // document change actually drains.
          const { updateDocument, uploadDocument } = await import('../lib/api/documents')

          for (const documentId of documentChanges.unlinkIds) {
            await updateDocument(documentId, { transactionId: null })
          }
          if (documentChanges.pending.length > 0) {
            const { compressImageFile } = await import('../lib/imageCompression')

            for (const pending of documentChanges.pending) {
              const uploadFile = await compressImageFile(pending.file)
              await uploadDocument(
                uploadFile,
                pending.taxYear,
                op.targetId,
                undefined,
                pending.reliefCategory,
                pending.amount,
                pending.amountCurrency,
              )
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

      // Savings goal authoring is ledger-neutral: an earmark is a claim on Rewards money that
      // already exists, so no transaction, dashboard figure or cycle balance can shift. Unlike the
      // wishlist fast path above, `delete` is safe to include here for the same reason — deleting a
      // goal only releases its claim.
      const onlySavingsGoalCrud = ops.length > 0 && ops.every(op =>
        op.entity === 'savingsGoal'
        && (op.type === 'add' || op.type === 'update' || op.type === 'delete')
      )
      if (onlySavingsGoalCrud) {
        const { fetchSavingsGoals } = await import('../lib/api/savingsGoals')
        const goals = await fetchSavingsGoals()
        setSavingsGoals(goals)
        setCachedJSON(CACHE_KEYS.savingsGoals, goals)
        setError(null)
        isServerAwakeRef.current = true
        return
      }

      // Loan terms are ledger-neutral. Their read model replays the full history returned by the
      // endpoint, so a CRUD-only drain does not need to reload the dashboard or cycle slice.
      const onlyLoanCrud = ops.length > 0 && ops.every(op =>
        op.entity === 'loan' && (op.type === 'add' || op.type === 'update' || op.type === 'delete')
      )
      if (onlyLoanCrud) {
        const { fetchLoans } = await import('../lib/api/loans')
        const refreshedLoans = await fetchLoans()
        setLoans(refreshedLoans)
        setCachedJSON(CACHE_KEYS.loans, refreshedLoans)
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

  const activeQueueOperationIds = useMemo(() => outboxActiveSyncId
    ? activeOps
      .filter(op => op.targetId === outboxActiveSyncId && !op.isCompleted)
      .map(op => op.id)
    : [], [activeOps, outboxActiveSyncId])
  const activeSyncIds = useMemo(() => Array.from(new Set([
    ...(outboxActiveSyncId ? [outboxActiveSyncId] : []),
    ...activeQueueOperationIds,
    ...directSyncIds,
  ])), [activeQueueOperationIds, directSyncIds, outboxActiveSyncId])
  const activeSyncId = activeSyncIds[0] || null

  // Fetch initial ledger and dashboard statistics
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

      const [dbData, txs, recs, cats, wishes, autoSuggests, wallet, insights, goals, loadedLoans] = bootstrapped ?? await (async () => {
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
          import('../lib/api/savingsGoals').then(m => m.fetchSavingsGoals(ac.signal)).catch((goalsError: unknown) => {
            if (getErrorName(goalsError) === 'AbortError' || rethrowOnError) throw goalsError
            console.warn('Could not refresh savings goals; keeping the last known local copy.', goalsError)
            return null
          }),
          import('../lib/api/loans').then(m => m.fetchLoans(ac.signal)).catch((loansError: unknown) => {
            if (getErrorName(loansError) === 'AbortError' || rethrowOnError) throw loansError
            console.warn('Could not refresh loans; keeping the last known local copy.', loansError)
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
      if (Array.isArray(loadedLoans)) {
        setLoans(loadedLoans)
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
      if (Array.isArray(loadedLoans)) {
        setCachedJSON(CACHE_KEYS.loans, loadedLoans)
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
  }, [token, lastUnlockedTimeRef, handleLogout, markSessionLocked, setDarkMode, resolveHideSensitive, markSensitivePreferenceUnavailable, notifyOnLogin, hasShownModalThisSession, setShowLoginModal, loadAllAbortRef, setSelectedMonth, setSelectedYear, getActiveOps])

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
    pendingTransactionDocumentDeletesRef.current.clear()
    setCategoriesList([])
    setWishlist([])
    setSavingsGoals([])
    setLoans([])
    setDirectSyncIds([])
    setPendingLedgerTransactions([])
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
      CACHE_KEYS.savingsGoals,
      CACHE_KEYS.loans,
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

  const wakeUpAndSync = useStartupSync({
    token,
    isServerAwakeRef,
    loadAll,
    processQueue,
    setIsOffline,
  })

  const optimisticDashboardData = useOptimisticDashboard(dashboardData, activeOps, transactions)

  // A queued salary generates four bucket rows server-side; projecting them needs the optimistic
  // plan percentages whenever the row was saved as plain `Income` (see incomeSplitProjection.ts).
  const incomeSplitOptions = useMemo(() => ({
    incomeAllocations: optimisticDashboardData?.setting
      ? {
          essentialsAlloc: optimisticDashboardData.setting.essentialsAlloc,
          growthAlloc: optimisticDashboardData.setting.growthAlloc,
          stabilityAlloc: optimisticDashboardData.setting.stabilityAlloc,
          rewardsAlloc: optimisticDashboardData.setting.rewardsAlloc,
        }
      : undefined,
  }), [
    optimisticDashboardData?.setting?.essentialsAlloc,
    optimisticDashboardData?.setting?.growthAlloc,
    optimisticDashboardData?.setting?.stabilityAlloc,
    optimisticDashboardData?.setting?.rewardsAlloc,
  ])
  const queuedTransactions = useOptimisticList(transactions, activeOps, 'transaction', incomeSplitOptions)
  const allTransactions = useMemo(() => {
    // Direct server actions can create a ledger row before the next bootstrap response arrives.
    // Keep that row in the same collection consumed by LedgerView so changing tabs immediately
    // after the click cannot hide the in-flight transaction.
    const queuedIds = new Set(queuedTransactions.map(transaction => String(transaction.id)))
    const directTransactions = pendingLedgerTransactions.filter(transaction => !queuedIds.has(String(transaction.id)))
    const projected = [...directTransactions, ...queuedTransactions]
    const recovery = optimisticDashboardData?.stabilityRecovery
    if (!recovery || !dashboardData?.setting) return projected
    const planPoints = buildStabilityPlanPoints(
      dashboardData.stabilityRecovery?.target ?? dashboardData.setting.targetStabilityFund,
      dashboardData.setting.stabilityAlloc,
      activeOps
        .filter(operation => operation.entity === 'settings' && operation.type === 'update')
        .map(operation => ({ createdAt: operation.createdAt, payload: operation.payload as Record<string, unknown> | undefined })),
    )
    return projectStabilityReloadStatuses({
      recovery,
      baseTransactions: transactions,
      projectedTransactions: projected,
      stabilityAlloc: dashboardData.setting.stabilityAlloc,
      projectedBalance: recovery.currentBalance,
      planPoints,
    })
  }, [
    activeOps,
    dashboardData,
    optimisticDashboardData,
    pendingLedgerTransactions,
    queuedTransactions,
    transactions,
  ])
  const queuedRecurringPayments = useOptimisticList(recurringPayments, activeOps, 'recurringPayment')
  const allRecurringPayments = queuedRecurringPayments
  const allWishlist = useOptimisticList(wishlist, activeOps, 'wishlistItem')
  const allSavingsGoals = useOptimisticList(savingsGoals, activeOps, 'savingsGoal')
  const queuedLoans = useOptimisticList(loans, activeOps, 'loan')
  const allLoans = useMemo(() => projectLoanStates(queuedLoans, activeOps, queuedRecurringPayments), [activeOps, queuedLoans, queuedRecurringPayments])
  const allCategories = useOptimisticList(categoriesList, activeOps, 'category')

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
    if (!guardSensitive()) return
    const payload = {
      ...settings,
      darkMode: settings.darkMode ?? darkMode,
      hideSensitive: settings.hideSensitive ?? hideSensitive,
    }
    for (const [key, value] of Object.entries(payload)) {
      if (value !== undefined) unconfirmedSettingWritesRef.current.set(key, value)
    }
    mutateQueue(prev => enqueue(prev, 'settings', 'update', 'settings', {
      ...payload,
      undoSnapshot: dashboardData?.setting,
    }))
  }

  const handleUpdateDarkModePreference = (value: boolean) => {
    unconfirmedSettingWritesRef.current.set('darkMode', value)
    mutateQueue(prev => enqueue(prev, 'settings', 'update', 'darkMode', {
      darkMode: value,
      undoSnapshot: { darkMode },
    }))
  }

  const handleUpdateHideSensitivePreference = (value: boolean) => {
    const previousValue = dashboardData?.setting.hideSensitive ?? !value
    unconfirmedSettingWritesRef.current.set('hideSensitive', value)
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
    mutateQueue(prev => enqueue(prev, 'settings', 'update', 'hideSensitive', {
      hideSensitive: value,
      undoSnapshot: { hideSensitive: previousValue },
    }))
  }

  // Acknowledge (or silently adopt) the end-of-cycle summary for a given cycle key. Patches the
  // marker into local dashboard state + cache immediately so the once-per-cycle trigger won't
  // re-fire before the server write round-trips, then queues the durable server update.
  const handleMarkSummarySeen = (cycleKey: string) => {
    unconfirmedSettingWritesRef.current.set('lastSummaryCycleSeen', cycleKey)
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

  const updateCatMeta = (id: string, patch: { cycleLimit?: number | null; type?: CategoryFlowType }) => {
    if (!guardSensitive()) return
    const category = allCategories.find(cat => String(cat.id) === String(id))
    snapshotForUndo('category', String(id), category)
    mutateQueue(prev => enqueue(prev, 'category', 'update', id, {
      name: category?.name,
      type: category?.type,
      ...(patch.cycleLimit !== undefined ? { cycleLimit: patch.cycleLimit } : {}),
      ...(patch.type !== undefined ? { type: patch.type } : {}),
      undoSnapshot: category,
    }))
  }

  const handleUpdateCategoryCycleLimit = (id: string, cycleLimit: number | null) => updateCatMeta(id, { cycleLimit })
  const handleUpdateCategoryType = (id: string, type: CategoryFlowType) => updateCatMeta(id, { type })

  const handleDeleteCategory = (id: string, replacementCategoryId?: string) => {
    if (!guardSensitive()) return
    const category = allCategories.find(cat => String(cat.id) === String(id))
    const replacementCategory = replacementCategoryId
      ? allCategories.find(cat => String(cat.id) === String(replacementCategoryId))
      : undefined
    snapshotForUndo('category', String(id), category)
    mutateQueue(prev => enqueue(prev, 'category', 'delete', id, {
      name: category?.name,
      replacementCategoryId,
      replacementCategoryName: replacementCategory?.name,
      undoSnapshot: category,
    }))
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
              <CategoryReplacementSelectLazy
                options={replacementOptions}
                onChange={selected => {
                  selectedReplacementId = selected
                  setConfirmModalData(previous => previous ? { ...previous, confirmDisabled: selectedReplacementId.length === 0 } : previous)
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

  const handleApplyCategoryCleanupSuggestion = async (suggestion: CategoryCleanupSuggestion, targetCategoryOverride?: string) => {
    if (!guardSensitive()) return
    if (suggestion.type === 'consolidate' && !targetCategoryOverride) {
      showToast('Choose a category to move these entries to first.', 'AI Cleanup', 'warning')
      return
    }
    const actions = suggestion.type === 'add'
      ? [{ type: 'add' as const, newCategoryName: suggestion.newCategoryName || undefined, categoryId: createFinalId('category') }]
      : suggestion.type === 'merge'
      ? [{ type: 'merge' as const, categories: suggestion.categories, targetCategory: suggestion.targetCategory || undefined }]
      : suggestion.type === 'consolidate'
      ? [{ type: 'merge' as const, categories: suggestion.categories, targetCategory: targetCategoryOverride }]
      : [{ type: 'delete' as const, categories: suggestion.categories }]

    const description = suggestion.type === 'add'
      ? suggestion.newCategoryName || 'new category'
      : suggestion.type === 'consolidate'
        ? `${suggestion.categories.join(', ')} → ${targetCategoryOverride}`
        : suggestion.type === 'merge'
          ? `${suggestion.categories.join(', ')} → ${suggestion.targetCategory || 'target category'}`
          : suggestion.categories.join(', ')
    mutateQueue(previous => enqueue(previous, 'category', 'cleanup', suggestion.id, {
      actions,
      description,
    }))
  }

  const handleAddTransaction = async (
    newTx: Omit<Transaction, 'id'>,
    setActiveTab: (tab: AppTab) => void,
    documentChanges?: TransactionDocumentChanges,
  ) => {
    const drafts = handleStageDraftTransactions([newTx])
    if (drafts.length === 0) return undefined
    if (documentChanges && (documentChanges.pending.length > 0 || documentChanges.unlinkIds.length > 0)) {
      try {
        const { saveDraftTransactionDocumentChanges } = await import('../lib/draftTransactionDocuments')
        await saveDraftTransactionDocumentChanges(username, drafts[0].id, documentChanges)
      } catch (error) {
        setDraftTransactions(previous => previous.filter(draft => draft.id !== drafts[0].id))
        throw error
      }
    }
    setActiveTab('drafts')
    return drafts[0].id
  }

  const handleStageDraftTransactions = (newTransactions: Omit<Transaction, 'id'>[]) => {
    if (!guardSensitive()) return []
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
    if (!guardSensitive()) return
    const finalId = createFinalId('transaction')
    void triggerHaptic(20)
    mutateQueue(prev => enqueue(prev, 'transaction', 'add', finalId, { ...newTx, id: finalId }))
  }

  const handleUpdateDraftTransaction = async (
    id: string,
    updated: Omit<Transaction, 'id'>,
    documentChanges: TransactionDocumentChanges = { pending: [], unlinkIds: [] },
  ) => {
    if (!guardSensitive()) return
    const { saveDraftTransactionDocumentChanges } = await import('../lib/draftTransactionDocuments')
    await saveDraftTransactionDocumentChanges(username, id, documentChanges)
    setDraftTransactions(prev => prev.map(t => t.id === id ? { ...updated, id, isPendingSync: true } : t))
    void triggerHaptic(15)
  }

  const loadDraftTransactionDocumentChanges = async (id: string) => {
    const { loadDraftTransactionDocumentChanges } = await import('../lib/draftTransactionDocuments')
    return loadDraftTransactionDocumentChanges(username, id)
  }

  const handleDeleteDraftTransaction = (id: string) => {
    if (!guardSensitive()) return
    pendingTransactionDocumentsRef.current.delete(id)
    void import('../lib/draftTransactionDocuments').then(({ deleteDraftTransactionDocumentChanges }) =>
      deleteDraftTransactionDocumentChanges(username, id)).catch(() => {
        showToast('The draft was removed, but its obsolete local file copy could not be cleared.', 'Draft cleanup incomplete', 'warning')
      })
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

  const handleSyncDraftBatch = async () => {
    if (!guardSensitive()) return
    if (draftTransactions.length === 0) return
    const drafts = draftTransactions
    const { getDraftTransactionIssues } = await import('../lib/draftTransactionValidation')
    const invalidDraft = drafts.find(draft => getDraftTransactionIssues(draft, allCategories).length > 0)
    if (invalidDraft) {
      showToast(
        `Review “${invalidDraft.description || 'transaction'}” before adding this batch to the Ledger.`,
        'Draft needs review',
        'warning',
      )
      return
    }
    let documentChangesByDraft: Map<string, TransactionDocumentChanges>
    try {
      const { loadDraftTransactionDocumentChanges } = await import('../lib/draftTransactionDocuments')
      documentChangesByDraft = new Map(await Promise.all(drafts.map(async draft => [
        draft.id,
        await loadDraftTransactionDocumentChanges(username, draft.id),
      ] as const)))
    } catch (error) {
      showToast(getErrorMessage(error, 'Draft attachments could not be restored. Try again before adding these transactions.'), 'Draft files unavailable', 'error')
      return
    }
    void triggerHaptic([25, 45, 25])
    mutateQueue(prev => {
      let nextQueue = prev
      drafts.forEach(d => {
        const finalId = createFinalId('transaction')
        const documentChanges = documentChangesByDraft.get(d.id)
        if (documentChanges && (documentChanges.pending.length > 0 || documentChanges.unlinkIds.length > 0)) {
          pendingTransactionDocumentsRef.current.set(finalId, documentChanges)
        }
        const payload = { ...d, id: finalId }
        delete payload.isPendingSync
        nextQueue = enqueue(nextQueue, 'transaction', 'add', finalId, payload)
      })
      return nextQueue
    })
    setDraftTransactions([])
    try {
      const { deleteDraftTransactionDocumentChanges } = await import('../lib/draftTransactionDocuments')
      await Promise.all(drafts.map(draft => deleteDraftTransactionDocumentChanges(username, draft.id)))
    } catch {
      showToast('The transactions were queued, but obsolete local draft files could not be cleared.', 'Draft cleanup incomplete', 'warning')
    }
  }

  const handleDeleteTransaction = (
    id: string,
    transactionHint?: Transaction,
    attachedDocumentIdsToDelete?: number[],
  ) => {
    if (!guardSensitive()) return
    void triggerHaptic(30)
    let deleteId = id
    if (id.includes('-split-')) {
      deleteId = id.split('-split-')[0]
    }
    setDeletingTxId(deleteId)
    const transaction = transactionHint?.id === deleteId
      ? transactionHint
      : allTransactions.find(t => String(t.id) === deleteId)
    if (transaction?.savingsGoalId != null) {
      // Completion deletion rolls back both the ledger row and goal, so it cannot use the transaction-only outbox.
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setDeletingTxId(null)
        showToast('Undo requires a live connection to restore the linked ledger entry and goal.', 'Available online only', 'warning')
        return
      }
      const syncIds = [deleteId, String(transaction.savingsGoalId)]
      beginDirectSync(syncIds)
      void (async () => {
        try {
          await api.deleteTransaction(deleteId)
          await loadAll(selectedMonth || undefined, selectedYear || undefined, true, false, () => true)
          removePendingLedgerTransaction(deleteId)
          const goalName = allSavingsGoals.find(goal => goal.id === transaction.savingsGoalId)?.name
          const fallbackName = transaction.description.replace(/^Completed commitment:\s*/i, '')
          const undoCopy = buildUndoSuccessToast(goalName || fallbackName, 'savings goal')
          showToast(undoCopy.message, undoCopy.title, undoCopy.tone)
        } catch (error: unknown) {
          showToast(getErrorMessage(error), 'Could not undo completion', 'error')
        } finally {
          setDeletingTxId(null)
          endDirectSync(syncIds)
        }
      })()
      return
    }
    snapshotForUndo('transaction', deleteId, transaction)
    // Any queued attachment work for this row is void now, and would otherwise upload a file to a
    // transaction that is on its way out.
    pendingTransactionDocumentsRef.current.delete(deleteId)
    const documentIdsToDelete = attachedDocumentIdsToDelete?.length ? [...attachedDocumentIdsToDelete] : undefined
    if (documentIdsToDelete) {
      pendingTransactionDocumentDeletesRef.current.set(deleteId, documentIdsToDelete)
    }
    mutateQueue(prev => enqueue(prev, 'transaction', 'delete', deleteId, {
      description: transaction?.description,
      undoSnapshot: transaction,
      // Read only by the success toast, so it can say plainly that the files are gone for good
      // while the Undo beside it restores the transaction.
      deletedDocumentCount: documentIdsToDelete?.length,
    }))
    if (deleteId === editingPendingId) setEditingPendingId(null)
  }

  const handleUpdateTransaction = (
    id: string,
    updatedTx: Omit<Transaction, 'id'>,
    documentChanges?: TransactionDocumentChanges,
  ) => {
    if (!guardSensitive()) return
    void triggerHaptic(15)
    const previousTransaction = allTransactions.find(t => String(t.id) === String(id))
    snapshotForUndo('transaction', String(id), previousTransaction)
    if (documentChanges) stageTransactionDocumentChanges(id, documentChanges)
    mutateQueue(prev => enqueue(prev, 'transaction', 'update', id, {
      ...updatedTx,
      undoSnapshot: previousTransaction,
    }))
    if (id === editingPendingId) setEditingPendingId(null)
  }

  const handleConfirmSubscription = (noti: PendingNotification, paidDate: string) => {
    if (!guardSensitive()) return
    const transactionId = createFinalId('transaction')
    const postedAt = new Date().toISOString()
    const payment = allRecurringPayments.find(item => item.id === noti.recurringPaymentId)
    mutateQueue(prev => enqueue(prev, 'recurringOccurrence', 'settle', noti.id, {
      name: noti.name,
      recurringPaymentId: noti.recurringPaymentId,
      occurrenceDate: noti.billingDate,
      status: 'Paid',
      paidDate,
      optimisticNextOccurrenceDate: payment ? computeNextOccurrenceDate(payment) ?? undefined : undefined,
      optimisticTransaction: {
      id: transactionId,
      date: paidDate,
      postedAt,
      description: noti.name,
      amount: -Math.abs(noti.amount),
      category: noti.category,
      ledgerCategory: noti.ledgerCategory,
      recurringPaymentId: noti.recurringPaymentId,
      recurringOccurrenceDate: noti.billingDate,
      isPendingSync: true,
      },
    }))
  }

  const handleDiscardSubscription = (noti: PendingNotification) => {
    if (!guardSensitive()) return
    const transactionId = createFinalId('transaction')
    const postedAt = new Date().toISOString()
    const payment = allRecurringPayments.find(item => item.id === noti.recurringPaymentId)
    mutateQueue(prev => enqueue(prev, 'recurringOccurrence', 'settle', noti.id, {
      name: noti.name,
      recurringPaymentId: noti.recurringPaymentId,
      occurrenceDate: noti.billingDate,
      status: 'Discarded',
      optimisticNextOccurrenceDate: payment ? computeNextOccurrenceDate(payment) ?? undefined : undefined,
      optimisticTransaction: {
      id: transactionId,
      date: financialDate(),
      postedAt,
      description: `[Discarded] ${noti.name}`,
      amount: 0,
      category: noti.category,
      ledgerCategory: 'Discarded',
      recurringPaymentId: noti.recurringPaymentId,
      recurringOccurrenceDate: noti.billingDate,
      isPendingSync: true,
      },
    }))
  }

  const handleAddPayment = (newPay: Omit<RecurringPayment, 'id'>) => {
    if (!guardSensitive()) return
    const finalId = createFinalId('recurringPayment')
    mutateQueue(prev => enqueue(prev, 'recurringPayment', 'add', finalId, { ...newPay, id: finalId, active: true }))
  }

  const handleToggleActive = (id: string) => {
    if (!guardSensitive()) return
    const current = allRecurringPayments.find(p => String(p.id) === String(id))
    const nextActive = current ? !current.active : false
    const tomorrow = new Date(`${financialDate()}T12:00:00`)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const trackingStart = tomorrow.toLocaleDateString('en-CA')
    const payload = current ? {
      active: nextActive,
      name: current.name,
      nextDueDate: nextActive ? computeOccurrenceOnOrAfter(current, trackingStart) : null,
    } : undefined
    mutateQueue(prev => enqueue(prev, 'recurringPayment', 'toggle', id, payload))
  }

  const handleUpdatePayment = (id: string, payment: RecurringPayment) => {
    if (!guardSensitive()) return
    const previousPayment = allRecurringPayments.find(p => String(p.id) === String(id))
    snapshotForUndo('recurringPayment', String(id), previousPayment)
    mutateQueue(prev => enqueue(prev, 'recurringPayment', 'update', id, {
      ...toOutboxPayload(payment),
      undoSnapshot: previousPayment,
    }))
  }

  const handleDeletePayment = (id: string) => {
    if (!guardSensitive()) return
    void triggerHaptic(30)
    const payment = allRecurringPayments.find(p => String(p.id) === String(id))
    snapshotForUndo('recurringPayment', String(id), payment)
    mutateQueue(prev => enqueue(prev, 'recurringPayment', 'delete', id, {
      name: payment?.name,
      undoSnapshot: payment,
    }))
  }

  const requestDeletePayment = (id: string) => {
    if (!guardSensitive()) return
    const payment = recurringPayments.find(p => p.id === id)
    setConfirmModalData({
      title: 'Delete Subscription',
      message: `Delete "${payment?.name || 'this recurring subscription'}"? Future reminders stop; past ledger entries stay.`,
      confirmText: 'Delete',
      onConfirm: () => { handleDeletePayment(id) }
    })
  }

  const handleUpdateReminder = (id: string, settings: RecurringReminderSettings) => {
    if (!guardSensitive()) return
    const previous = allRecurringPayments.find(p => p.id === id)
    snapshotForUndo('recurringPayment', id, previous)
    mutateQueue(queue => enqueue(queue, 'recurringPayment', 'reminder', id, {
      name: previous?.name,
      reminderEnabled: settings.enabled,
      reminderMode: settings.mode,
      reminderLeadDays: settings.leadDays,
      undoSnapshot: previous,
    }))
  }

  const handlePayEarly = (id: string) => {
    if (!guardSensitive()) return
    const payment = allRecurringPayments.find(p => p.id === id)
    if (!payment?.nextDueDate) return
    const occurrenceDate = payment.nextDueDate
    const postedAt = new Date().toISOString()
    const pendingTransactionId = createFinalId('transaction')
    const pendingTransaction: Transaction = {
      id: pendingTransactionId,
      date: financialDate(),
      postedAt,
      description: payment.name,
      category: payment.category,
      ledgerCategory: payment.ledgerCategory,
      amount: -Math.abs(payment.amount),
      recurringPaymentId: payment.id,
      recurringOccurrenceDate: occurrenceDate,
      isPendingSync: true,
    }
    mutateQueue(queue => enqueue(queue, 'recurringOccurrence', 'settle', `${id}:${occurrenceDate}`, {
      name: payment.name,
      recurringPaymentId: payment.id,
      occurrenceDate,
      status: 'Paid',
      paidDate: financialDate(),
      optimisticNextOccurrenceDate: computeNextOccurrenceDate(payment) ?? undefined,
      optimisticTransaction: pendingTransaction,
    }))
  }

  const requestPayEarly = (id: string) => {
    if (!guardSensitive()) return
    const payment = allRecurringPayments.find(p => p.id === id)
    if (!payment?.nextDueDate) return
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
      onConfirm: () => { handlePayEarly(id) }
    })
  }

  // eslint-disable-next-line react-hooks/refs
  const wishlistSavingsActions = createWishlistSavingsActions({
    wishlist,
    savingsGoals,
    allWishlist,
    allSavingsGoals,
    currency: optimisticDashboardData?.setting?.currency || 'USD',
    editingPendingId,
    guardSensitive,
    showToast,
    setConfirmModalData,
    setEditingPendingId,
    enqueue,
    mutateQueue,
    snapshotForUndo,
    setSavingsGoals,
    beginDirectSync,
    endDirectSync,
    getGoal: (id: number) => allSavingsGoals.find(goal => goal.id === id),
    getActiveGoalIds: () => allSavingsGoals.filter(goal => goal.status === 'active').map(goal => goal.id),
    addPendingLedgerTransaction,
    replacePendingLedgerTransaction,
    removePendingLedgerTransaction,
    setDeletingTransactionId: setDeletingTxId,
    refreshAll: () => loadAll(selectedMonth || undefined, selectedYear || undefined, true, false, () => true),
  })

  const loanActions = createLoanActions({
    loans: allLoans,
    recurringPayments: allRecurringPayments,
    guardSensitive,
    enqueue,
    mutateQueue,
    snapshotForUndo,
    setConfirmModalData,
  })

  return {
    transactions,
    allTransactions,
    recurringPayments,
    allRecurringPayments,
    categoriesList,
    allCategories,
    wishlist,
    allWishlist,
    savingsGoals,
    allSavingsGoals,
    loans,
    allLoans,
    dashboardData,
    optimisticDashboardData,
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
    activeSyncIds,
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
    handleUpdateCategoryType,
    handleDeleteCategory,
    requestDeleteCategory,
    handleApplyCategoryCleanupSuggestion,
    handleAddTransaction,
    handleStageDraftTransactions,
    handleAddBalanceAdjustment,
    handleUpdateDraftTransaction,
    loadDraftTransactionDocumentChanges,
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
    ...wishlistSavingsActions,
    ...loanActions,
  }
}
