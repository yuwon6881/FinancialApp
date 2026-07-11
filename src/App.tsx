import { useState, useMemo, useEffect, useRef, useCallback, lazy, Suspense, type ReactNode } from 'react'
import { App as CapacitorApp } from '@capacitor/app'
import { AnimatePresence, motion } from 'framer-motion'
import { SplashScreen } from '@capacitor/splash-screen'
import TopNav from "./TopNav.tsx"
import { ErrorBoundary } from './components/ErrorBoundary'
import { APP_TABS, type AppTab, type Transaction, type RecurringPayment, type DashboardData, type TransactionCategory, type WishlistItem, type PendingNotification } from './types'
import * as api from './lib/api'
import type { CategoryCleanupSuggestion } from './lib/api'
import { Loader2, Plus, Wallet, CreditCard, PiggyBank, Upload } from 'lucide-react'

// Every view is code-split so the initial bundle only ships the shell. Each
// chunk loads on demand behind an instant blank-shell fallback (no flash).
const LoginView = lazy(() => import('./components/LoginView').then(m => ({ default: m.LoginView })))
const DashboardView = lazy(() => import('./components/DashboardView').then(m => ({ default: m.DashboardView })))
const RecurringPaymentsView = lazy(() => import('./components/RecurringPaymentsView').then(m => ({ default: m.RecurringPaymentsView })))
const LedgerView = lazy(() => import('./components/LedgerView').then(m => ({ default: m.LedgerView })))
const WishlistView = lazy(() => import('./components/WishlistView').then(m => ({ default: m.WishlistView })))
const SettingsView = lazy(() => import('./components/SettingsView').then(m => ({ default: m.SettingsView })))
const DraftStagingView = lazy(() => import('./components/DraftStagingView').then(m => ({ default: m.DraftStagingView })))
import { formatCurrencyVal, SENSITIVE_AMOUNT_MASK } from './lib/utils'
import { CustomAlertModal } from './components/ui/CustomAlertModal'
import { CustomConfirmModal } from './components/ui/CustomConfirmModal'
import { CustomSelect } from './components/ui/CustomSelect'
import { PullToRefresh } from './components/ui/PullToRefresh'
import { ToastViewport, type ToastMessage, type ToastTone, type ToastAction } from './components/ui/ToastViewport'
import { CardSkeleton, Skeleton } from './components/ui/Skeleton'
import { CACHE_KEYS, getCachedJSON, getCachedTransactions, getCachedWishlist, sanitizeTransactions, setCachedJSON, hasCachedKey, getCachedDashboardPeriod, getCachedOps, getCachedCycleSnapshot, setCachedCycleSnapshot } from './lib/cache'
import { backupModalDraftsOnLogout, restoreModalDraftsOnLogin, clearAllModalDrafts } from './lib/modalDrafts'
import { enqueue as outboxEnqueue, createFinalId, createLocalWishlistId, DISPATCH, sanitizeQueuedOps, getSyncSuccessToast, type QueuedOp, type EntityKind, type OpType, type OutboxPayload, type DispatchResult } from './lib/outbox'
import { useOptimisticList } from './lib/useOptimisticList'
import { computeOptimisticDashboard } from './lib/optimisticDashboard'
import { drainQueue } from './lib/outboxSync'
import { useVisualViewportVars } from './lib/useVisualViewportVars'
import { useReceiptScanPolling } from './lib/useReceiptScanPolling'
import { useAutoLock } from './lib/useAutoLock'
import { dispatchAiActions, requestAiLedgerDelete } from './lib/aiActions'
import { PendingSubscriptionsModal } from './components/PendingSubscriptionsModal'
import { FailedSyncModal } from './components/FailedSyncModal'
import { PasswordPromptModal } from './components/PasswordPromptModal'
import { LockScreen } from './components/LockScreen'
import { AiAssistantPanel } from './components/AiAssistantPanel'
import { AppLogo } from './components/ui/AppLogo'
import { errorMessageIncludes, errorMessageIncludesLower, getErrorMessage, getErrorName } from './lib/errors'
import { triggerHaptic } from './lib/haptics'
import { isPlatformAuthenticatorAvailable, getFingerprintAssertion } from './lib/webauthn'
import {
  clearCachedFingerprintAssertOptions,
  getCachedFingerprintAssertOptions,
  prefetchFingerprintAssertOptions,
} from './lib/fingerprintOptionsCache'
import { initNativeUi, syncStatusBarTheme } from './lib/nativeUi'
import { getCurrentCycleYearAndMonth, MONTH_NAMES } from './lib/cycle'

const createLocalId = (prefix: string, separator = '_') => {
  return `${prefix}${separator}${Date.now()}${separator}${Math.random().toString(36).substring(2, 9)}`
}

// Instant, flash-free placeholder while a lazily-loaded chunk is fetched at the root level.
const ViewFallback = () => <div className="app-shell min-h-screen" />

// Skeleton placeholder for tab navigation to prevent empty squares in the main content area.
const ContentViewFallback = () => (
  <div className="w-full space-y-6 pt-2 animate-in fade-in duration-300">
    <div className="w-1/3 h-8 rounded-xl skeleton-shimmer" />
    <div className="w-full h-32 rounded-2xl skeleton-shimmer" />
    <div className="w-full h-64 rounded-2xl skeleton-shimmer" />
  </div>
)

const nextPaint = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
const wait = (ms: number) => new Promise<void>(resolve => window.setTimeout(resolve, ms))
const getCurrentTimeMs = () => Date.now()

// On a warm reopen (cached data already in localStorage) the app skips the
// lightweight skeleton and mounts the full dashboard tree on its very first
// render, on a cold JS engine. Two RAF ticks can elapse before the WebView's
// compositor has actually presented a frame to the screen in that case, so
// hiding the native splash then briefly reveals whatever is behind the
// WebView (the launcher) until the real frame lands. A couple of extra RAFs
// plus a short floor give the compositor room to catch up; this adds
// negligible, imperceptible delay on the already-fast cold-launch path.
const hideNativeSplashAfterPaint = async () => {
  await nextPaint()
  await nextPaint()
  await nextPaint()
  await wait(180)
  await SplashScreen.hide().catch(() => undefined)
}

const finishLaunchHandoff = async () => {
  await hideNativeSplashAfterPaint()
}

const CategoryReplacementSelect = ({
  options,
  onChange,
}: {
  options: Array<{ id: string; name: string }>
  onChange: (value: string) => void
}) => {
  const [value, setValue] = useState('')
  return (
    <CustomSelect
      value={value}
      onChange={nextValue => {
        const selected = String(nextValue)
        setValue(selected)
        onChange(selected)
      }}
      options={[
        { value: '', label: 'Choose replacement category' },
        ...options.map(option => ({ value: option.id, label: option.name }))
      ]}
      className="w-full"
    />
  )
}

const LaunchReady = ({ children }: { children: ReactNode }) => {
  useEffect(() => {
    void finishLaunchHandoff()
  }, [])

  return <>{children}</>
}

const isSessionLockedError = (err: unknown) => {
  return errorMessageIncludes(err, '423')
}

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('auth_token'))
  const [username, setUsername] = useState<string>(localStorage.getItem('auth_username') || '')
  const [isFabOpen, setIsFabOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<AppTab>(() => {
    const cached = localStorage.getItem('active_tab')
    return APP_TABS.includes(cached as AppTab) ? cached as AppTab : 'dashboard'
  })

  useEffect(() => {
    localStorage.setItem('active_tab', activeTab)
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [activeTab])


  useEffect(() => {
    let cleanup: (() => void) | undefined

    // On resume (warm relaunch) the native splash may still be covering the
    // WebView if the activity was re-created.  Wait for the WebView to paint
    // a frame then dismiss it.  The window is now guaranteed opaque (via
    // styles.xml + MainActivity) so the homescreen can never bleed through.
    void CapacitorApp.addListener('appStateChange', ({ isActive }: { isActive: boolean }) => {
      if (isActive) void hideNativeSplashAfterPaint()
    }).then((handle: { remove: () => Promise<void> | void }) => {
      cleanup = () => { void handle.remove() }
    })

    return () => cleanup?.()
  }, [])

  useEffect(() => {
    void initNativeUi()
  }, [])

  const [transactions, setTransactions] = useState<Transaction[]>(() => getCachedTransactions(CACHE_KEYS.transactions))
  const [recurringPayments, setRecurringPayments] = useState<RecurringPayment[]>(() => getCachedJSON(CACHE_KEYS.recurringPayments, []))
  const [categoriesList, setCategoriesList] = useState<TransactionCategory[]>(() => getCachedJSON(CACHE_KEYS.categories, []))
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(() => getCachedJSON(CACHE_KEYS.dashboardData, null))
  const [currentCycleDashboardData, setCurrentCycleDashboardData] = useState<DashboardData | null>(null)
  // Always the real current cycle's wallet total (see fetchWalletBalance) -- deliberately NOT
  // derived from dashboardData/optimisticDashboardData, since those track whatever cycle the
  // Dashboard/Ledger has navigated to and the navbar wallet must not follow that navigation.
  const [walletBalance, setWalletBalance] = useState<number | null>(() => getCachedJSON<number | null>(CACHE_KEYS.walletBalance, null))
  const [wishlist, setWishlist] = useState<WishlistItem[]>(() => getCachedWishlist(CACHE_KEYS.wishlist))
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<import('./types').AutocompleteSuggestion[]>([])

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(() => !hasCachedKey(CACHE_KEYS.dashboardData))
  const [isOffline, setIsOffline] = useState<boolean>(() => typeof navigator !== 'undefined' ? !navigator.onLine : false)

  // Sync Queue States
  const [pendingOps, setPendingOps] = useState<QueuedOp[]>(() => getCachedOps())
  const [failedOps, setFailedOps] = useState<QueuedOp[]>(() => getCachedJSON<QueuedOp[]>('failed_operations', []))
  const [isBackgroundSyncing, setIsBackgroundSyncing] = useState<boolean>(false)
  const [activeSyncId, setActiveSyncId] = useState<string | null>(null)
  const [deletingTxId, setDeletingTxId] = useState<string | null>(null)
  const [syncBackoffUntil, setSyncBackoffUntil] = useState<number>(0)
  const [syncCountdownMs, setSyncCountdownMs] = useState<number>(0)
  const [editingPendingId, setEditingPendingId] = useState<string | null>(null)
  const [recentlyCompletedOps, setRecentlyCompletedOps] = useState<QueuedOp[]>([])
  const isSyncingRef = useRef<boolean>(false)
  const isServerAwakeRef = useRef<boolean>(false)
  // Bumped on every loadAll() call; a call only commits its fetched data if it's
  // still the most recent one when it resolves. Without this, an older in-flight
  // request (e.g. the initial-mount load of the last-viewed cycle) can resolve
  // after the user has already switched cycles and clobber the newer selection.
  const loadAllSeqRef = useRef(0)
  const selectPeriodSeqRef = useRef(0)
  // Aborts the previous loadAll()'s in-flight requests whenever a newer one starts,
  // so switching cycles repeatedly doesn't leave superseded fetches running to completion.
  const loadAllAbortRef = useRef<AbortController | null>(null)



  const [selectedMonth, setSelectedMonth] = useState<string>(() => getCachedDashboardPeriod().month || '')
  const [selectedYear, setSelectedYear] = useState<number>(() => getCachedDashboardPeriod().year || 0)
  const [ledgerIncomingCategory, setLedgerIncomingCategory] = useState<string | null>(null)
  const [ledgerIncomingDate, setLedgerIncomingDate] = useState<string | null>(null)
  const [ledgerIncomingTxType, setLedgerIncomingTxType] = useState<'inflow' | 'outflow' | 'transfer' | null>(null)
  const [ledgerShowAllCycles, setLedgerShowAllCycles] = useState(false)
  const [autoOpenLedgerAdd, setAutoOpenLedgerAdd] = useState(false)
  const [autoOpenSubscriptionAdd, setAutoOpenSubscriptionAdd] = useState(false)
  const [autoOpenWishlistAdd, setAutoOpenWishlistAdd] = useState(false)
  const [highlightedTxId, setHighlightedTxId] = useState<string | null>(null)
  const [isAiOpen, setIsAiOpen] = useState(false)
  const [ledgerIncomingSearch, setLedgerIncomingSearch] = useState<string | null>(null)
  const [aiLedgerDraft, setAiLedgerDraft] = useState<{ nonce: number; fields: Record<string, unknown> } | null>(null)
  const [aiLedgerEditDraft, setAiLedgerEditDraft] = useState<{ nonce: number; id: string; changes: Record<string, unknown> } | null>(null)
  const [aiRecurringDraft, setAiRecurringDraft] = useState<{ nonce: number; fields: Record<string, unknown> } | null>(null)
  const [aiRecurringEditDraft, setAiRecurringEditDraft] = useState<{ nonce: number; id: string; changes: Record<string, unknown> } | null>(null)
  const [aiWishlistDraft, setAiWishlistDraft] = useState<{ nonce: number; fields: Record<string, unknown> } | null>(null)
  const [aiWishlistEditDraft, setAiWishlistEditDraft] = useState<{ nonce: number; id: number; changes: Record<string, unknown> } | null>(null)
  const [aiLedgerExportRequest, setAiLedgerExportRequest] = useState<{ nonce: number } | null>(null)
  const aiActionNonceRef = useRef(0)
  const [hideSensitive, setHideSensitive] = useState<boolean>(() => {
    return localStorage.getItem('hide_sensitive') !== 'false'
  })
  const [hideBalanceAmounts, setHideBalanceAmounts] = useState<boolean>(() => {
    return localStorage.getItem('hide_balance_amounts') === 'true'
  })

  // Dark mode — initialize from localStorage immediately, sync with server after load
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('dark_mode') === 'true'
  })

  const [draftTransactions, setDraftTransactions] = useState<Transaction[]>(() => {
    try {
      const stored = localStorage.getItem('draft_transactions')
      return sanitizeTransactions(stored ? JSON.parse(stored) : [])
    } catch {
      return []
    }
  })

  // Redirect from drafts tab if queue is empty
  useEffect(() => {
    if (activeTab === 'drafts' && draftTransactions.length === 0) {
      setActiveTab('ledger')
    }
  }, [activeTab, draftTransactions])

  // Persist draft transactions to localStorage
  useEffect(() => {
    localStorage.setItem('draft_transactions', JSON.stringify(draftTransactions))
  }, [draftTransactions])

  const [customAlert, setCustomAlert] = useState<{ message: string; title: string } | null>(null)
  const [confirmModalData, setConfirmModalData] = useState<{
    title: string
    message: React.ReactNode
    confirmText?: string
    confirmDisabled?: boolean
    onConfirm: () => void
  } | null>(null)
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [isLedgerAddOpen, setIsLedgerAddOpen] = useState(false)
  const isMountedRef = useRef(true)
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const activeTabRef = useRef(activeTab)
  useEffect(() => {
    activeTabRef.current = activeTab
  }, [activeTab])

  const isLedgerAddOpenRef = useRef(isLedgerAddOpen)
  useEffect(() => {
    isLedgerAddOpenRef.current = isLedgerAddOpen
  }, [isLedgerAddOpen])

  // Background Sync Queue Worker Refs
  // Earliest time the next sync-success toast may show, so a burst of ops that
  // complete within the same tick still stagger visually instead of stacking.
  const nextToastAtRef = useRef(0)
  const pendingOpsRef = useRef(pendingOps)
  const draftTxRef = useRef(draftTransactions)
  const failedOpsRef = useRef(failedOps)
  const usernameRef = useRef(username)
  const editingPendingIdRef = useRef(editingPendingId)

  useEffect(() => {
    pendingOpsRef.current = pendingOps
  }, [pendingOps])

  useEffect(() => {
    draftTxRef.current = draftTransactions
  }, [draftTransactions])

  useEffect(() => {
    failedOpsRef.current = failedOps
  }, [failedOps])

  useEffect(() => {
    usernameRef.current = username
  }, [username])

  useEffect(() => {
    editingPendingIdRef.current = editingPendingId
  }, [editingPendingId])

  const enqueue = useCallback((queue: QueuedOp[], entity: EntityKind, type: OpType, targetId: string, payload?: OutboxPayload, isUndo?: boolean) => {
    const activeSyncOpId = isSyncingRef.current && queue.length > 0 ? queue[0].id : null
    return outboxEnqueue(queue, entity, type, targetId, payload, isUndo, activeSyncOpId)
  }, [])

  // Single entry point for every queue mutation. Computes the next queue from the
  // *ref* (the synchronous source of truth) rather than React state, then writes
  // ref and state together. This is what makes concurrent mutations safe: an Undo
  // click that enqueues a compensating op while the drain loop is awaiting a
  // dispatch reads-and-writes the same ref the loop does, so neither clobbers the
  // other's change (the earlier plain-value writes lost whichever landed second).
  const mutateQueue = useCallback((updater: (prev: QueuedOp[]) => QueuedOp[]) => {
    const next = updater(pendingOpsRef.current)
    // Deliberate synchronous ref write: this ref *is* the live queue the drain
    // loop reads mid-await, so it must update now, not after the next render.
    pendingOpsRef.current = next
    setPendingOps(next)
  }, [])

  const showToast = (message: string, title: string = 'Notification', tone: ToastTone = 'info', action?: ToastAction) => {
    const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 7)
    setToasts(prev => [...prev.slice(-3), { id, message, title, tone, action }])
  }

  // "Before" snapshots for undo, keyed by `${entity}:${targetId}`. Captured at the moment
  // of a reversible update/delete so the drain loop can build a compensating op once the
  // change has synced. First-write-wins per key: if several edits to the same record are
  // coalesced into one queued op (and one toast), undo reverts to the earliest known state.
  type UndoSnapshot = (Transaction | RecurringPayment | TransactionCategory | WishlistItem) & {
    isPendingSync?: boolean
    isPendingDelete?: boolean
  }

  const toOutboxPayload = (value: object): OutboxPayload => ({ ...value })

  const undoSnapshotsRef = useRef<Map<string, UndoSnapshot>>(new Map())
  const snapshotForUndo = (entity: EntityKind, targetId: string, obj: UndoSnapshot | undefined) => {
    if (!obj) return
    const key = `${entity}:${targetId}`
    if (undoSnapshotsRef.current.has(key)) return
    // Drop local-only flags so the restored record looks like a clean server payload.
    const clean = { ...obj }
    delete clean.isPendingSync
    delete clean.isPendingDelete
    undoSnapshotsRef.current.set(key, clean)
  }

  // Build the "Undo" action for a just-synced op by enqueuing a compensating op. Runs
  // after sync (that's when the success toast fires), so undo is a real reverse mutation,
  // not a queue cancellation. Returns undefined for ops that can't be cleanly reversed
  // (wishlist purchase, settings) or when the needed "before" snapshot is missing.
  const buildUndoAction = (op: QueuedOp, result: DispatchResult): ToastAction | undefined => {
    const key = `${op.entity}:${op.targetId}`
    const before = undoSnapshotsRef.current.get(key)
    undoSnapshotsRef.current.delete(key) // snapshots are single-use

    switch (`${op.entity}:${op.type}`) {
      // Adds -> delete the record that was just created.
      case 'transaction:add':
        return { label: 'Undo', onAction: () => mutateQueue(prev => enqueue(prev, 'transaction', 'delete', String(op.targetId), undefined, true)) }
      case 'recurringPayment:add':
        return { label: 'Undo', onAction: () => mutateQueue(prev => enqueue(prev, 'recurringPayment', 'delete', String(op.targetId), undefined, true)) }
      case 'category:add':
        return { label: 'Undo', onAction: () => mutateQueue(prev => enqueue(prev, 'category', 'delete', String(op.targetId), undefined, true)) }
      case 'wishlistItem:add': {
        // The server-assigned id only exists post-sync; use it, not the local placeholder.
        const realId = result && 'id' in result && result.id != null ? String(result.id) : String(op.targetId)
        return { label: 'Undo', onAction: () => mutateQueue(prev => enqueue(prev, 'wishlistItem', 'delete', realId, undefined, true)) }
      }

      // Deletes -> re-add the captured record (reusing its id where the API accepts one).
      case 'transaction:delete':
        if (!before) return undefined
        return { label: 'Undo', onAction: () => mutateQueue(prev => enqueue(prev, 'transaction', 'add', String(before.id), toOutboxPayload(before), true)) }
      case 'recurringPayment:delete':
        if (!before) return undefined
        return { label: 'Undo', onAction: () => mutateQueue(prev => enqueue(prev, 'recurringPayment', 'add', String(before.id), toOutboxPayload(before), true)) }
      case 'category:delete':
        if (op.payload?.replacementCategoryId) return undefined
        if (!before) return undefined
        return { label: 'Undo', onAction: () => mutateQueue(prev => enqueue(prev, 'category', 'add', String(before.id), toOutboxPayload(before), true)) }
      case 'wishlistItem:delete': {
        if (!before) return undefined
        // Wishlist ids are server-generated, so a re-add takes a fresh local placeholder id.
        const placeholderId = String(createLocalWishlistId())
        const payload = toOutboxPayload(before)
        delete payload.id
        return { label: 'Undo', onAction: () => mutateQueue(prev => enqueue(prev, 'wishlistItem', 'add', placeholderId, payload, true)) }
      }

      // Updates -> restore the captured prior values.
      case 'transaction:update':
        if (!before) return undefined
        return { label: 'Undo', onAction: () => mutateQueue(prev => enqueue(prev, 'transaction', 'update', String(op.targetId), toOutboxPayload(before), true)) }
      case 'recurringPayment:update':
        if (!before) return undefined
        return { label: 'Undo', onAction: () => mutateQueue(prev => enqueue(prev, 'recurringPayment', 'update', String(op.targetId), toOutboxPayload(before), true)) }
      case 'wishlistItem:update':
        if (!before) return undefined
        return { label: 'Undo', onAction: () => mutateQueue(prev => enqueue(prev, 'wishlistItem', 'update', String(op.targetId), toOutboxPayload(before), true)) }
      case 'wishlistItem:purchase': {
        const purchaseResult = result && 'item' in result ? result : undefined
        const realId = purchaseResult?.item?.id != null ? String(purchaseResult.item.id) : String(op.targetId)
        const purchaseTransactionId = purchaseResult?.item?.purchaseTransactionId || purchaseResult?.transaction?.id
        return { label: 'Undo', onAction: () => mutateQueue(prev => enqueue(prev, 'wishlistItem', 'unpurchase', realId, { purchaseTransactionId }, true)) }
      }

      // Toggle -> flip back to the prior active state.
      case 'recurringPayment:toggle': {
        if (!op.payload || typeof op.payload.active !== 'boolean') return undefined
        const priorActive = !op.payload.active
        return { label: 'Undo', onAction: () => mutateQueue(prev => enqueue(prev, 'recurringPayment', 'toggle', String(op.targetId), { active: priorActive }, true)) }
      }

      // wishlistItem:purchase and settings:update have no clean reverse — no undo.
      default:
        return undefined
    }
  }

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [])

  const showAlert = (message: string, title: string = 'Notification') => {
    showToast(message, title, title.toLowerCase().includes('error') ? 'error' : 'info')
  }

  const {
    activeReceiptScanDraft,
    failedScanJob,
    receiptScanJobIds,
    handleReceiptScanStarted,
    clearReceiptScanJob,
  } = useReceiptScanPolling({
    token,
    activeTabRef,
    isLedgerAddOpenRef,
    isMountedRef,
    setActiveTab,
    setAutoOpenLedgerAdd,
    showToast,
  })

  // Shadow the global alert function
  const alert = (message: string) => showAlert(message, 'Notification')

  // Apply/remove the 'dark' class on <html> whenever darkMode changes,
  // and keep the PWA/browser chrome (theme-color) in sync with the active theme.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', darkMode ? '#0a0d14' : '#f6f8fc')
    void syncStatusBarTheme(darkMode)
  }, [darkMode])

  // Keep visual viewport CSS vars in sync so fixed bottom-sheet modals stay
  // pinned to the visible area while the mobile keyboard opens/closes/pans.
  useVisualViewportVars()

  // Inactivity Auto-Lock — cross-cutting lock state stays here (login/sync/
  // heartbeat all touch it); the timers/listeners live in useAutoLock below.
  const lastUnlockedTimeRef = useRef<number>(0)
  const [isLocked, setIsLocked] = useState<boolean>(() => {
    return sessionStorage.getItem('session_locked') === 'true'
  })
  const syncBackoffUntilRef = useRef(syncBackoffUntil)

  const markSessionLocked = useCallback(() => {
    loadAllAbortRef.current?.abort()
    api.invalidateCache()
    setError(null)
    setSyncBackoffUntil(0)
    syncBackoffUntilRef.current = 0
    setIsLocked(true)
    sessionStorage.setItem('session_locked', 'true')
  }, [setIsLocked])


  // Password Prompt for revealing sensitive information
  const [showPasswordPrompt, setShowPasswordPrompt] = useState<boolean>(false)
  const [hasFingerprintSetup, setHasFingerprintSetup] = useState<boolean>(false)

  useEffect(() => {
    if (!token) {
      setHasFingerprintSetup(false)
      clearCachedFingerprintAssertOptions()
      return
    }

    let cancelled = false
    ;(async () => {
      const platformAvailable = await isPlatformAuthenticatorAvailable().catch(() => false)
      if (cancelled) return

      if (!platformAvailable) {
        setHasFingerprintSetup(false)
        clearCachedFingerprintAssertOptions()
        return
      }

      const status = await api.fetchAuthStatus().catch(() => null)
      if (cancelled) return

      const hasFingerprint = !!status?.hasFingerprint
      setHasFingerprintSetup(hasFingerprint)
      if (!hasFingerprint) {
        clearCachedFingerprintAssertOptions()
      }
    })()

    return () => {
      cancelled = true
    }
  }, [token])

  useEffect(() => {
    if (!token || isLocked || !hideSensitive || !hasFingerprintSetup) return
    void prefetchFingerprintAssertOptions().catch(() => undefined)
  }, [token, isLocked, hideSensitive, hasFingerprintSetup])

  // Cycle switching state for skeleton loader
  const [isSwitchingCycle, setIsSwitchingCycle] = useState<boolean>(false)

  // Login Notification Modal States
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false)
  const [hasShownModalThisSession, setHasShownModalThisSession] = useState<boolean>(false)
  const [modalCheckbox, setModalCheckbox] = useState<boolean>(
    localStorage.getItem('show_notifications_on_login') !== 'false'
  )

  // Failed Sync Items Modal State
  const [showFailedOpsModal, setShowFailedOpsModal] = useState<boolean>(false)

  const handleDiscardFailedOp = useCallback((id: string) => {
    setFailedOps(prev => prev.filter(op => op.id !== id))
  }, [])

  const handleDiscardAllFailedOps = useCallback(() => {
    setFailedOps([])
    setShowFailedOpsModal(false)
  }, [setShowFailedOpsModal])

  async function handleLogout() {
    const currentPending = pendingOpsRef.current;
    const currentDrafts = draftTxRef.current;
    const currentFailed = failedOpsRef.current;
    const currentOwner = usernameRef.current;

    if (currentPending.length > 0) {
      localStorage.setItem('pending_operations_backup', JSON.stringify({ owner: currentOwner, ops: currentPending }));
    }

    if (currentDrafts.length > 0) {
      localStorage.setItem('draft_transactions_backup', JSON.stringify({ owner: currentOwner, transactions: currentDrafts }));
    }

    if (currentFailed.length > 0) {
      localStorage.setItem('failed_operations_backup', JSON.stringify({ owner: currentOwner, ops: currentFailed }));
    }

    backupModalDraftsOnLogout(currentOwner);

    await api.logout()
    setToken(null)
    setUsername('')
    setDashboardData(null)
    setWalletBalance(null)
    setTransactions([])
    setRecurringPayments([])
    mutateQueue(() => [])
    setFailedOps([])
    setDraftTransactions([])
    setCategoriesList([])
    setWishlist([])
    setSelectedMonth('')
    setSelectedYear(0)
    setLoading(true)
    setEditingPendingId(null)
    setHasShownModalThisSession(false)
    setShowLoginModal(false)
    setHideSensitive(true)

    // Clear LocalStorage cache
    localStorage.removeItem('auth_username')
    sessionStorage.removeItem('session_locked')
    localStorage.removeItem('last_active_time')
    localStorage.removeItem(CACHE_KEYS.dashboardData)
    localStorage.removeItem(CACHE_KEYS.transactions)
    localStorage.removeItem(CACHE_KEYS.recurringPayments)
    localStorage.removeItem(CACHE_KEYS.categories)
    localStorage.removeItem(CACHE_KEYS.wishlist)
    localStorage.removeItem(CACHE_KEYS.walletBalance)
    localStorage.removeItem(CACHE_KEYS.pendingTransactions)
    localStorage.removeItem(CACHE_KEYS.pendingOperations)
    localStorage.removeItem('failed_operations')
    localStorage.removeItem('draft_transactions')
    clearAllModalDrafts()
    clearCachedFingerprintAssertOptions()
    setIsLocked(false)
  }

  useAutoLock({ token, isLocked, hasFingerprintSetup, markSessionLocked, onAuthError: handleLogout })

  // Fetch initial ledger and dashboard statistics
  async function loadAll(month?: string, year?: number, isBackground = false) {
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
      // fetchTransactions only needs to wait on the dashboard response when the
      // caller doesn't already know which cycle is active (the very first load
      // with no cached period yet) -- the backend resolves an omitted month/year
      // to the persisted "selected period" itself, and writes that resolution
      // back to the DB, so reading it via a second un-parameterized call could
      // race that write. Once month/year are known they're passed to both calls
      // directly, sidestepping that lookup entirely, so there's nothing to wait
      // on. Everything else here (recurring payments, categories, wishlist,
      // autocomplete, wallet balance) never depended on the dashboard response
      // at all, so it was needlessly serialized behind it before.
      const dashboardPromise = api.fetchDashboard(month, year, ac.signal)
      const transactionsPromise = (month && year !== undefined)
        ? api.fetchTransactions(month, year, undefined, ac.signal)
        : dashboardPromise.then(d => api.fetchTransactions(d.setting.selectedMonth, d.setting.selectedYear, undefined, ac.signal))
      // The expensive historical breakdowns (yearly/last3/last6 + rewards average) live behind
      // their own endpoint now -- see FinancialService.GetDashboardInsightsAsync -- so they're
      // fetched in parallel with everything else instead of adding ~24 sequential queries to
      // every dashboard load. Merged back into a full DashboardData below.
      const insightsPromise = (month && year !== undefined)
        ? api.fetchDashboardInsights(month, year, ac.signal)
        : dashboardPromise.then(d => api.fetchDashboardInsights(d.setting.selectedMonth, d.setting.selectedYear, ac.signal))

      const [dbData, txs, recs, cats, wishes, autoSuggests, wallet, insights] = await Promise.all([
        dashboardPromise,
        transactionsPromise,
        api.fetchRecurringPayments(ac.signal),
        api.fetchCategories(ac.signal),
        api.fetchWishlist(ac.signal).catch(() => []),
        api.fetchAutocompleteSuggestions(ac.signal).catch(() => []),
        api.fetchWalletBalance(ac.signal).catch(() => null),
        insightsPromise
      ])
      // A newer loadAll() was kicked off (e.g. the user switched cycles again)
      // while this one was in flight -- discard this now-stale response instead
      // of clobbering the newer cycle's data.
      if (isStale()) return
      if (wallet !== null) {
        setWalletBalance(wallet)
        setCachedJSON(CACHE_KEYS.walletBalance, wallet)
      }
      const mergedDashboard: DashboardData = {
        ...dbData,
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
      setWishlist(wishes)
      setAutocompleteSuggestions(autoSuggests)
      setError(null)
      isServerAwakeRef.current = true
      setIsLocked(false)
      sessionStorage.setItem('session_locked', 'false')

      // Save to localStorage cache
      setCachedJSON(CACHE_KEYS.dashboardData, mergedDashboard)
      setCachedJSON(CACHE_KEYS.transactions, txs)
      setCachedJSON(CACHE_KEYS.recurringPayments, recs)
      setCachedJSON(CACHE_KEYS.categories, cats)
      setCachedJSON(CACHE_KEYS.wishlist, wishes)
      setCachedCycleSnapshot(dbData.setting.selectedMonth, dbData.setting.selectedYear, mergedDashboard, txs)

      // Sync dark mode from server preference (server wins over localStorage)
      const serverDark = dbData.setting.darkMode ?? false
      setDarkMode(serverDark)
      localStorage.setItem('dark_mode', serverDark.toString())

      // Sync hide sensitive from server preference (server wins over localStorage)
      const serverHideSensitive = dbData.setting.hideSensitive ?? true
      setHideSensitive(serverHideSensitive)
      localStorage.setItem('hide_sensitive', serverHideSensitive.toString())



      if (dbData.pendingNotifications && dbData.pendingNotifications.length > 0 && !hasShownModalThisSession) {
        if (localStorage.getItem('show_notifications_on_login') !== 'false') {
          setShowLoginModal(true)
        }
        setHasShownModalThisSession(true)
      }
    } catch (err: unknown) {
      if (getErrorName(err) === 'AbortError' || isStale()) return
      console.error(err)
      const isJustLoggedIn = Date.now() - lastUnlockedTimeRef.current < 10000
      if (errorMessageIncludes(err, '401') || errorMessageIncludesLower(err, 'unauthorized')) {
        if (!isJustLoggedIn) {
          handleLogout()
        } else {
          setError(null)
        }
      } else if (isSessionLockedError(err)) {
        markSessionLocked()
      } else {
        setError('Could not connect to the database API server. Running in offline view mode.')
        isServerAwakeRef.current = false
      }
    } finally {
      if (!isStale()) {
        setLoading(false)
        setIsBackgroundSyncing(false)
      }
    }
  }

  useEffect(() => {
    if (token) {
      const hasCache = hasCachedKey(CACHE_KEYS.dashboardData);
      const { month: cachedMonth, year: cachedYear } = getCachedDashboardPeriod();
      loadAll(cachedMonth, cachedYear, hasCache);
    }
  }, [token])

  const handleLoginSuccess = (newToken: string, newUsername: string) => {
    localStorage.setItem('auth_token', newToken)
    localStorage.setItem('auth_username', newUsername)
    sessionStorage.setItem('session_locked', 'false')
    const now = getCurrentTimeMs()
    localStorage.setItem('last_active_time', now.toString())
    lastUnlockedTimeRef.current = now
    setIsLocked(false)
    api.invalidateCache()
    setToken(newToken)
    setUsername(newUsername)

    // Restore any backed up pending operations -- only if this backup
    // belongs to the account that's actually logging in now.
    const cachedOpsBackup = localStorage.getItem('pending_operations_backup') || localStorage.getItem('pending_transactions_backup');
    if (cachedOpsBackup) {
      try {
        const parsed = JSON.parse(cachedOpsBackup);
        if (parsed && parsed.owner === newUsername) {
          const backedUpOps = sanitizeQueuedOps(parsed.ops || parsed.transactions);
          if (backedUpOps.length > 0) {
            mutateQueue(() => backedUpOps);
            setCachedJSON(CACHE_KEYS.pendingOperations, backedUpOps);
          }
        }
      } catch (e) {
        console.error('Failed to parse backed up pending operations:', e);
      }
      localStorage.removeItem('pending_operations_backup');
      localStorage.removeItem('pending_transactions_backup');
    }

    // Restore any backed up drafts the same way, gated on the same owner check.
    const cachedDraftBackup = localStorage.getItem('draft_transactions_backup');
    if (cachedDraftBackup) {
      try {
        const parsed = JSON.parse(cachedDraftBackup);
        if (parsed && parsed.owner === newUsername) {
          const backedUpDrafts = sanitizeTransactions(parsed.transactions);
          if (backedUpDrafts.length > 0) {
            setDraftTransactions(backedUpDrafts);
            localStorage.setItem('draft_transactions', JSON.stringify(backedUpDrafts));
          }
        }
      } catch (e) {
        console.error('Failed to parse backed up draft transactions:', e);
      }
      localStorage.removeItem('draft_transactions_backup');
    }

    // Ops that had already exhausted their retries before the logout get
    // folded back into the live queue (with a clean retry count) instead of
    // staying stranded in "failed" -- the session/network that caused them
    // to fail is presumably fixed now that the user has logged back in.
    const cachedFailedBackup = localStorage.getItem('failed_operations_backup');
    if (cachedFailedBackup) {
      try {
        const parsed = JSON.parse(cachedFailedBackup);
        if (parsed && parsed.owner === newUsername) {
          const backedUpFailed = sanitizeQueuedOps(parsed.ops).map(op => ({ ...op, retryCount: 0 }));
          if (backedUpFailed.length > 0) {
            mutateQueue(prev => {
              const merged = [...prev, ...backedUpFailed];
              setCachedJSON(CACHE_KEYS.pendingOperations, merged);
              return merged;
            });
          }
        }
      } catch (e) {
        console.error('Failed to parse backed up failed operations:', e);
      }
      localStorage.removeItem('failed_operations_backup');
    }

    // Restore any modal that was mid-edit when the session was interrupted --
    // the owning view reopens it and repopulates its fields once mounted
    // (see useFormDraft). Gated on the same owner check as everything else.
    restoreModalDraftsOnLogin(newUsername);
  }

  // Period / Settings changes
  const handleSelectPeriod = async (month: string, year: number) => {
    // Guards against an older switch's cleanup firing after a newer one has
    // already taken over (e.g. the user taps two different cycles in quick
    // succession) and prematurely clearing the "switching" skeleton state.
    const requestSeq = ++selectPeriodSeqRef.current
    // If we've visited this cycle before, show its last-known data immediately
    // (stale-while-revalidate) instead of a skeleton, then refresh quietly.
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
      if (errorMessageIncludes(err, '401') || errorMessageIncludesLower(err, 'unauthorized')) {
        handleLogout()
      } else if (isSessionLockedError(err)) {
        markSessionLocked()
      } else {
        alert('Error updating active month.')
      }
    } finally {
      if (requestSeq === selectPeriodSeqRef.current) {
        setIsSwitchingCycle(false)
      }
    }
  }

  const handleUpdateSettings = (settings: {
    targetStabilityFund: number
    essentialsAlloc: number
    growthAlloc: number
    stabilityAlloc: number
    rewardsAlloc: number
    cycleDay: number
    currency?: string
    stabilityOverflowRedirect?: string
  }) => {
    const payload = { ...settings, darkMode, hideSensitive }
    mutateQueue(prev => enqueue(prev, 'settings', 'update', 'settings', payload))
  }

  // Custom Categories & Accounts modifiers
  const handleAddCategory = (newCat: Omit<TransactionCategory, 'id'>) => {
    if (hideSensitive) { showToast('Unhide balances to make changes.', 'Sensitive mode active', 'warning'); return }
    const finalId = createFinalId('category')
    mutateQueue(prev => enqueue(prev, 'category', 'add', finalId, { ...newCat, id: finalId }))
  }

  const handleDeleteCategory = (id: string, replacementCategoryId?: string) => {
    snapshotForUndo('category', String(id), allCategories.find(cat => String(cat.id) === String(id)))
    mutateQueue(prev => enqueue(prev, 'category', 'delete', id, replacementCategoryId ? { replacementCategoryId } : undefined))
  }

  const requestDeleteCategory = async (id: string) => {
    if (hideSensitive) { showToast('Unhide balances to make changes.', 'Sensitive mode active', 'warning'); return }
    const category = categoriesList.find(cat => cat.id === id)
    if (!category) return

    const replacementOptions = categoriesList.filter(cat => {
      const lower = cat.name.toLowerCase()
      return cat.id !== id &&
        lower !== 'transfer' &&
        lower !== 'adjustment' &&
        !cat.isPendingDelete
    })

    let transactionCount = 0
    let usageLookupFailed = false
    try {
      const usage = await api.fetchPagedTransactions({
        page: 1,
        pageSize: 1,
        categories: [category.name]
      })
      transactionCount = usage.total
    } catch (err) {
      console.error(err)
      usageLookupFailed = true
    }

    const recurringPaymentCount = allRecurringPayments.filter(payment =>
      !payment.isPendingDelete &&
      payment.category.trim().toLowerCase() === category.name.trim().toLowerCase()
    ).length
    const requiresReplacement = usageLookupFailed || transactionCount > 0 || recurringPaymentCount > 0
    let selectedReplacementId = ''

    setConfirmModalData({
      title: 'Delete Category',
      message: (
        <div className={`space-y-3 ${requiresReplacement ? 'pb-36' : ''}`}>
          <p>
            Delete "{category.name}"?
          </p>
          {requiresReplacement ? (
            <>
              <p>
                This category is used by {usageLookupFailed ? 'existing ledger transactions' : `${transactionCount} ledger transaction${transactionCount === 1 ? '' : 's'}`}
                {recurringPaymentCount > 0 ? ` and ${recurringPaymentCount} recurring payment${recurringPaymentCount === 1 ? '' : 's'}` : ''}.
                Choose a replacement category before deleting it.
              </p>
              <CategoryReplacementSelect
                options={replacementOptions}
                onChange={e => {
                  selectedReplacementId = e
                  setConfirmModalData(prev => prev ? { ...prev, confirmDisabled: selectedReplacementId.length === 0 } : prev)
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
      onConfirm: () => { handleDeleteCategory(id, selectedReplacementId || undefined) }
    })
  }

  const handleApplyCategoryCleanupSuggestion = async (suggestion: CategoryCleanupSuggestion, targetCategoryOverride?: string) => {
    if (hideSensitive) { showToast('Unhide balances to make changes.', 'Sensitive mode active', 'warning'); return }

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

  // Transaction modifiers
  const handleAddTransaction = (newTx: Omit<Transaction, 'id'>) => {
    const draftId = createLocalId('draft');
    const draftTx: Transaction = {
      ...newTx,
      id: draftId,
      isPendingSync: true
    };

    setDraftTransactions(prev => [...prev, draftTx]);
    triggerVibration(15);
    setActiveTab('drafts');
  }

  const handleAddBalanceAdjustment = (newTx: Omit<Transaction, 'id'>) => {
    const finalId = createFinalId('transaction')
    triggerVibration(20)
    mutateQueue(prev => enqueue(prev, 'transaction', 'add', finalId, { ...newTx, id: finalId }))
  }

  const handleUpdateDraftTransaction = (id: string, updated: Transaction) => {
    if (hideSensitive) { showToast('Unhide balances to make changes.', 'Sensitive mode active', 'warning'); return }
    setDraftTransactions(prev => prev.map(t => t.id === id ? updated : t));
    triggerVibration(15);
  };

  const handleDeleteDraftTransaction = (id: string) => {
    setDraftTransactions(prev => prev.filter(t => t.id !== id));
    triggerVibration(30);
  };

  const requestDeleteDraftTransaction = (id: string) => {
    if (hideSensitive) { showToast('Unhide balances to make changes.', 'Sensitive mode active', 'warning'); return }
    const draft = draftTransactions.find(t => t.id === id)
    setConfirmModalData({
      title: 'Delete Draft',
      message: `Delete draft "${draft?.description || 'transaction'}"? This removes it from the draft queue before it is synced.`,
      confirmText: 'Delete',
      onConfirm: () => handleDeleteDraftTransaction(id)
    })
  }

  const handleSyncDraftBatch = () => {
    if (draftTransactions.length === 0) return;

    const drafts = draftTransactions;
    setDraftTransactions([]);
    triggerVibration([25, 45, 25]);
    // Build off the live queue via mutateQueue so a drain in progress can't drop
    // these adds (previously seeded from possibly-stale `pendingOps` state).
    mutateQueue(prev => {
      let nextQueue = prev;
      drafts.forEach(d => {
        const finalId = createFinalId('transaction');
        const payload = { ...d, id: finalId };
        delete payload.isPendingSync;
        nextQueue = enqueue(nextQueue, 'transaction', 'add', finalId, payload);
      });
      return nextQueue;
    });
  };

  const handleDeleteTransaction = (id: string) => {
    if (hideSensitive) { showToast('Unhide balances to make changes.', 'Sensitive mode active', 'warning'); return }
    triggerVibration(30)
    let deleteId = id
    if (id.includes('-split-')) {
      deleteId = id.split('-split-')[0]
    }
    setDeletingTxId(deleteId)
    snapshotForUndo('transaction', deleteId, allTransactions.find(t => String(t.id) === deleteId))
    mutateQueue(prev => enqueue(prev, 'transaction', 'delete', deleteId))
    if (deleteId === editingPendingId) setEditingPendingId(null)
  }

  const handleUpdateTransaction = (id: string, updatedTx: Omit<Transaction, 'id'>) => {
    if (hideSensitive) { showToast('Unhide balances to make changes.', 'Sensitive mode active', 'warning'); return }
    triggerVibration(15)
    snapshotForUndo('transaction', String(id), allTransactions.find(t => String(t.id) === String(id)))
    mutateQueue(prev => enqueue(prev, 'transaction', 'update', id, updatedTx))
    if (id === editingPendingId) setEditingPendingId(null)
  }

  const handleConfirmSubscription = (noti: PendingNotification, paidDate: string) => {
    if (hideSensitive) { showToast('Unhide balances to make changes.', 'Sensitive mode active', 'warning'); return }
    const finalId = createFinalId('transaction')
    mutateQueue(prev => enqueue(prev, 'transaction', 'add', finalId, {
      id: finalId,
      date: paidDate,
      description: noti.name,
      amount: -Math.abs(noti.amount),
      category: noti.category,
      ledgerCategory: noti.ledgerCategory,
      recurringPaymentId: noti.recurringPaymentId
    }))
  }

  const handleDiscardSubscription = (noti: PendingNotification) => {
    if (hideSensitive) { showToast('Unhide balances to make changes.', 'Sensitive mode active', 'warning'); return }
    const finalId = createFinalId('transaction')
    mutateQueue(prev => enqueue(prev, 'transaction', 'add', finalId, {
      id: finalId,
      date: noti.billingDate,
      description: `[Discarded] ${noti.name}`,
      amount: 0,
      category: noti.category,
      ledgerCategory: 'Discarded',
      recurringPaymentId: noti.recurringPaymentId
    }))
  }

  // Recurring payment modifiers
  const handleAddPayment = (newPay: Omit<RecurringPayment, 'id'>) => {
    const finalId = createFinalId('recurringPayment')
    mutateQueue(prev => enqueue(prev, 'recurringPayment', 'add', finalId, { ...newPay, id: finalId, active: true }))
  }

  const handleToggleActive = (id: string) => {
    if (hideSensitive) { showToast('Unhide balances to make changes.', 'Sensitive mode active', 'warning'); return }
    const current = allRecurringPayments.find(p => String(p.id) === String(id))
    const payload = current ? { active: !current.active } : undefined
    mutateQueue(prev => enqueue(prev, 'recurringPayment', 'toggle', id, payload))
  }

  const handleUpdatePayment = (id: string, payment: RecurringPayment) => {
    if (hideSensitive) { showToast('Unhide balances to make changes.', 'Sensitive mode active', 'warning'); return }
    snapshotForUndo('recurringPayment', String(id), allRecurringPayments.find(p => String(p.id) === String(id)))
    mutateQueue(prev => enqueue(prev, 'recurringPayment', 'update', id, toOutboxPayload(payment)))
  }

  const handleDeletePayment = (id: string) => {
    triggerVibration(30)
    snapshotForUndo('recurringPayment', String(id), allRecurringPayments.find(p => String(p.id) === String(id)))
    mutateQueue(prev => enqueue(prev, 'recurringPayment', 'delete', id))
  }

  const requestDeletePayment = (id: string) => {
    if (hideSensitive) { showToast('Unhide balances to make changes.', 'Sensitive mode active', 'warning'); return }
    const payment = recurringPayments.find(p => p.id === id)
    setConfirmModalData({
      title: 'Delete Subscription',
      message: `Delete "${payment?.name || 'this recurring subscription'}"? This will cancel all future notifications for this subscription.`,
      confirmText: 'Delete',
      onConfirm: () => { handleDeletePayment(id) }
    })
  }

  // Wish List modifiers
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
    if (hideSensitive) { showToast('Unhide balances to make changes.', 'Sensitive mode active', 'warning'); return }
    snapshotForUndo('wishlistItem', String(id), allWishlist.find(w => String(w.id) === String(id)))
    mutateQueue(prev => enqueue(prev, 'wishlistItem', 'update', String(id), toOutboxPayload(updatedWish)))
    // Mirror handleUpdateTransaction: clear the edit-lock so the drain loop can
    // dispatch this op once the modal closes.
    if (String(id) === editingPendingId) setEditingPendingId(null)
  }

  const handleDeleteWishlistItem = (id: number) => {
    triggerVibration(30)
    snapshotForUndo('wishlistItem', String(id), allWishlist.find(w => String(w.id) === String(id)))
    mutateQueue(prev => enqueue(prev, 'wishlistItem', 'delete', String(id)))
  }

  const requestDeleteWishlistItem = (id: number) => {
    if (hideSensitive) { showToast('Unhide balances to make changes.', 'Sensitive mode active', 'warning'); return }
    const item = wishlist.find(w => w.id === id)
    setConfirmModalData({
      title: 'Delete Wishlist Item',
      message: `Delete "${item?.name || 'this wishlist item'}"? This removes the savings goal from your wishlist.`,
      confirmText: 'Delete',
      onConfirm: () => { handleDeleteWishlistItem(id) }
    })
  }

  const handlePurchaseWishlistItem = (id: number) => {
    if (hideSensitive) { showToast('Unhide balances to make changes.', 'Sensitive mode active', 'warning'); return }
    const item = allWishlist.find(w => String(w.id) === String(id))
    const now = new Date()
    const date = now.toLocaleDateString('en-CA')
    mutateQueue(prev => enqueue(prev, 'wishlistItem', 'purchase', String(id), item ? {
      name: item.name,
      price: item.price,
      date,
      postedAt: now.toISOString()
    } : undefined))
  }

  const handleUnpurchaseWishlistItem = (id: number) => {
    if (hideSensitive) { showToast('Unhide balances to make changes.', 'Sensitive mode active', 'warning'); return }
    const item = allWishlist.find(w => String(w.id) === String(id))
    mutateQueue(prev => enqueue(prev, 'wishlistItem', 'unpurchase', String(id), item ? {
      purchaseTransactionId: item.purchaseTransactionId
    } : undefined))
  }

  // Save pending operations to localStorage whenever they change
  useEffect(() => {
    setCachedJSON(CACHE_KEYS.pendingOperations, pendingOps)
  }, [pendingOps])

  useEffect(() => {
    setCachedJSON('failed_operations', failedOps)
  }, [failedOps])

  useEffect(() => {
    syncBackoffUntilRef.current = syncBackoffUntil;
  }, [syncBackoffUntil]);

  useEffect(() => {
    if (!syncBackoffUntil) {
      setSyncCountdownMs(0)
      return
    }

    const updateCountdown = () => {
      setSyncCountdownMs(Math.max(0, syncBackoffUntil - Date.now()))
    }

    updateCountdown()
    const interval = window.setInterval(updateCountdown, 1000)
    return () => window.clearInterval(interval)
  }, [syncBackoffUntil])

  // The drain-loop algorithm lives in lib/outboxSync (drainQueue) so it can be
  // unit-tested with fakes; here we wire it to this component's state/refs/I-O.
  const TOAST_STAGGER_MS = 350;
  // Re-trigger routes through a ref so the loop can recurse without the
  // self-reference-before-declaration the linter (rightly) rejects.
  const processQueueRef = useRef<() => void>(() => {});
  const processQueue = useCallback(async () => {
    await drainQueue({
      token,
      now: () => Date.now(),
      getQueue: () => pendingOpsRef.current,
      getEditingPendingId: () => editingPendingIdRef.current,
      getBackoffUntil: () => syncBackoffUntilRef.current,
      getLastUnlockedTime: () => lastUnlockedTimeRef.current,
      isSyncing: () => isSyncingRef.current,
      mutateQueue,
      resolveDispatch: (op) => DISPATCH[`${op.entity}:${op.type}`],
      setSyncing: (v) => { isSyncingRef.current = v; setIsBackgroundSyncing(v); },
      setActiveSyncId,
      setError,
      setBackoff: (until) => { syncBackoffUntilRef.current = until; setSyncBackoffUntil(until); },
      addRecentlyCompleted: (op) => setRecentlyCompletedOps(prev => [...prev, op]),
      removeRecentlyCompleted: (ids) => setRecentlyCompletedOps(prev => prev.filter(op => !ids.has(op.id))),
      addFailedOp: (op) => setFailedOps(prev => [...prev, op]),
      getSyncSuccessToast,
      buildUndoAction,
      emitToast: (copy, action) => {
        // Stagger bursts of toasts so they don't stack on the same tick.
        const now = Date.now();
        const showAt = Math.max(now, nextToastAtRef.current);
        nextToastAtRef.current = showAt + TOAST_STAGGER_MS;
        window.setTimeout(() => showToast(copy.message, copy.title, copy.tone, action), showAt - now);
      },
      emitFailureToast: (op) => {
        const opDesc = op.payload?.description || op.payload?.name || op.entity;
        showToast(`Couldn't sync '${opDesc}' — removed from queue`, 'Sync Failed', 'error');
      },
      onAuthError: handleLogout,
      onLockError: markSessionLocked,
      refresh: () => loadAll(selectedMonth || undefined, selectedYear || undefined, true),
      onSettled: () => { setActiveSyncId(null); setDeletingTxId(null); },
      reTrigger: () => { processQueueRef.current(); },
    });
  }, [token, selectedMonth, selectedYear, mutateQueue]);

  useEffect(() => {
    processQueueRef.current = () => { void processQueue(); };
  }, [processQueue]);

  useEffect(() => {
    if (!token || pendingOps.length === 0) return;

    if (Date.now() < syncBackoffUntil) {
      const remaining = syncBackoffUntil - Date.now();
      const t = setTimeout(() => {
        syncBackoffUntilRef.current = 0;
        setSyncBackoffUntil(0);
      }, remaining);
      return () => clearTimeout(t);
    }

    processQueue();
  }, [token, pendingOps, syncBackoffUntil, processQueue]);

  // Server wake-up and background sync task
  const wakeUpAndSync = useCallback(async () => {
    if (!token) return

    let attempts = 0
    const maxAttempts = 15 // try for 75 seconds

    const runPing = async () => {
      if (!token || isServerAwakeRef.current) return

      try {
        const res = await api.pingServer()
        if (res && res.status !== 'waking_up') {
          console.log('Server is awake! Performing initial load and processing queue...')
          isServerAwakeRef.current = true
          const { month: cachedMonth, year: cachedYear } = getCachedDashboardPeriod();
          await loadAll(cachedMonth, cachedYear, true)
          processQueue()
          return
        }
      } catch (err) {
        console.log('Wake-up ping failed:', err)
      }

      attempts++
      if (attempts < maxAttempts) {
        setTimeout(runPing, 5000)
      }
    }

    runPing()
  }, [token, processQueue])

  // Proactively reflect browser connectivity instead of only inferring it
  // from failed fetches after the fact.
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
    if (token) {
      wakeUpAndSync()

      const handleOnline = () => {
        console.log('Browser went online, starting wake-up ping...')
        wakeUpAndSync()
      }

      window.addEventListener('online', handleOnline)
      return () => {
        window.removeEventListener('online', handleOnline)
      }
    }
  }, [token, wakeUpAndSync])

  // Combine synced and pending items for each entity
  const activeOps = useMemo(() => [...pendingOps, ...recentlyCompletedOps], [pendingOps, recentlyCompletedOps]);

  const allTransactions = useOptimisticList(transactions, activeOps, 'transaction');
  const allRecurringPayments = useOptimisticList(recurringPayments, activeOps, 'recurringPayment');
  const allWishlist = useOptimisticList(wishlist, activeOps, 'wishlistItem');
  const allCategories = useOptimisticList(categoriesList, activeOps, 'category');

  // Create optimistic dashboardData from server data + pending queue
  const optimisticDashboardData = useMemo(
    () => computeOptimisticDashboard(dashboardData, { activeOps, pendingOps, transactions }),
    // NB: deps preserved verbatim from pre-extraction to keep memoization identical
    // (activeOps is derived from pendingOps; allTransactions is a legacy dep).
    [dashboardData, pendingOps, transactions, allTransactions]
  );

  useEffect(() => {
    if (!token || !dashboardData) return

    const cycleDay = dashboardData.setting.cycleDay || 28
    const { year, monthIndex } = getCurrentCycleYearAndMonth(cycleDay)
    const month = MONTH_NAMES[monthIndex - 1]

    if (dashboardData.setting.selectedMonth === month && dashboardData.setting.selectedYear === year) {
      setCurrentCycleDashboardData(null)
      return
    }

    const ac = new AbortController()
    Promise.all([
      api.fetchDashboard(month, year, ac.signal),
      api.fetchDashboardInsights(month, year, ac.signal)
    ]).then(([core, insights]) => {
      const merged: DashboardData = {
        ...core,
        last3CategoryBreakdown: insights.last3CategoryBreakdown,
        last6CategoryBreakdown: insights.last6CategoryBreakdown,
        yearlyCategoryBreakdown: insights.yearlyCategoryBreakdown,
        availableYears: insights.availableYears,
        stats: {
          ...core.stats,
          pastThreeMonthsRewardsAverage: insights.pastThreeMonthsRewardsAverage,
          hasRewardsHistory: insights.hasRewardsHistory
        }
      }
      setCurrentCycleDashboardData(merged)
    }).catch(err => {
      if (getErrorName(err) !== 'AbortError') {
        console.warn('Could not load current-cycle wishlist metrics', err)
      }
    })

    return () => ac.abort()
  }, [token, dashboardData])

  const wishlistDashboardData = currentCycleDashboardData || optimisticDashboardData

  const formatSensitive = (val: number) => {
    const formatted = formatCurrencyVal(val, optimisticDashboardData?.setting?.currency || 'USD')
    return (
      <span className={hideSensitive ? 'inline-block font-mono tracking-wide select-none' : 'transition-[filter] duration-200'}>
        {hideSensitive ? SENSITIVE_AMOUNT_MASK : formatted}
      </span>
    )
  }

  // Wallet total: always the real current cycle's total (from walletBalance), falling
  // back to the naive all-time sum only until the very first fetch lands.
  const totalBalance = walletBalance ?? allTransactions.reduce((acc, t) => acc + t.amount, 0)

  const [ledgerCyclesRange, setLedgerCyclesRange] = useState<'monthly' | '3month' | '6month' | 'yearly'>('monthly')

  const handleQuickAction = (action: 'transaction' | 'subscription' | 'wishlist') => {
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
  }
  useEffect(() => {
    if (activeTab !== 'ledger') {
      setLedgerIncomingCategory(null)
      setLedgerIncomingSearch(null)
      setLedgerIncomingDate(null)
      setLedgerIncomingTxType(null)
      setLedgerCyclesRange('monthly')
      setLedgerShowAllCycles(false)
    }
  }, [activeTab])

  const handleNavigateToLedger = (options: {
    category?: string | null
    search?: string | null
    date?: string | null
    txType?: 'inflow' | 'outflow' | 'transfer' | null
    range?: 'monthly' | '3month' | '6month' | 'yearly'
    highlightedTxId?: string | null
    showAllCycles?: boolean
  }) => {
    setLedgerIncomingCategory(options.category || null)
    setLedgerIncomingSearch(options.search || null)
    setLedgerIncomingDate(options.date || null)
    setLedgerIncomingTxType(options.txType || null)
    const range = options.range || 'monthly'
    setLedgerCyclesRange(range)
    const showAll = options.showAllCycles !== undefined ? options.showAllCycles : (range !== 'monthly')
    setLedgerShowAllCycles(showAll)
    if (options.highlightedTxId) {
      setHighlightedTxId(options.highlightedTxId)
    }
    setActiveTab('ledger')
  }

  const revealSensitiveWithFingerprint = async (): Promise<boolean> => {
    if (!hasFingerprintSetup) return false
    let verified = false
    try {
      const { challengeId, options } = await getCachedFingerprintAssertOptions()
      const credential = await getFingerprintAssertion(options)
      await api.verifyFingerprintAssert(challengeId, credential)
      setHideSensitive(false)
      localStorage.setItem('hide_sensitive', 'false')
      mutateQueue(prev => enqueue(prev, 'settings', 'update', 'hideSensitive', { hideSensitive: false }))
      verified = true
      return true
    } catch (err) {
      console.warn('Fingerprint prompt failed/cancelled:', err)
      return false
    } finally {
      clearCachedFingerprintAssertOptions()
      if (!verified && token && !isLocked && hideSensitive) {
        void prefetchFingerprintAssertOptions().catch(() => undefined)
      }
    }
  }

  const handleToggleHideSensitive = async () => {
    if (hideSensitive) {
      setShowPasswordPrompt(true)
    } else {
      setHideSensitive(true)
      localStorage.setItem('hide_sensitive', 'true')
      if (hasFingerprintSetup) {
        void prefetchFingerprintAssertOptions().catch(() => undefined)
      }
      mutateQueue(prev => enqueue(prev, 'settings', 'update', 'hideSensitive', { hideSensitive: true }))
    }
  }

  const nextAiActionNonce = () => {
    aiActionNonceRef.current += 1
    return aiActionNonceRef.current
  }

  const handleAiActions = (actions: api.AiUiAction[]) =>
    dispatchAiActions(actions, {
      hideSensitive,
      showToast,
      setActiveTab,
      handleSelectPeriod,
      handleNavigateToLedger,
      nextNonce: nextAiActionNonce,
      setAiLedgerDraft,
      setAiRecurringDraft,
      setAiWishlistDraft,
      setAiLedgerEditDraft,
      setAiRecurringEditDraft,
      setAiWishlistEditDraft,
      setAiLedgerExportRequest,
      requestDeleteLedger: (id) => requestAiLedgerDelete(id, { showToast, setConfirmModalData, allTransactions, handleDeleteTransaction }),
      requestDeletePayment,
      requestDeleteWishlistItem,
      allRecurringPayments,
      allWishlist,
      handleToggleActive,
      getPendingNotifications: () => optimisticDashboardData?.pendingNotifications || [],
      setConfirmModalData,
      handleDiscardSubscription,
      handleConfirmSubscription,
      handlePurchaseWishlistItem,
      handleUnpurchaseWishlistItem,
    })

  const handleToggleBalanceAmounts = () => {
    const nextHidden = !hideBalanceAmounts
    setHideBalanceAmounts(nextHidden)
    localStorage.setItem('hide_balance_amounts', nextHidden.toString())
  }

  const handleToggleDarkMode = () => {
    const newDark = !darkMode
    setDarkMode(newDark)
    localStorage.setItem('dark_mode', newDark.toString())
    mutateQueue(prev => enqueue(prev, 'settings', 'update', 'darkMode', { darkMode: newDark }))
  }

  // Delegate to the shared haptics helper which tries the Capacitor native
  // Haptics plugin first (works on Firefox mobile and all Capacitor targets)
  // then falls back to navigator.vibrate() for plain browser contexts.
  const triggerVibration = (pattern: number | number[] = 15) => {
    void triggerHaptic(pattern)
  }

  if (!token) {
    return (
      <Suspense fallback={<ViewFallback />}>
        <LaunchReady>
          <LoginView onLoginSuccess={handleLoginSuccess} />
        </LaunchReady>
      </Suspense>
    )
  }

  if (loading && !optimisticDashboardData) {
    return (
      <LaunchReady>
        <div className="app-shell min-h-screen text-foreground p-4">
          <div className="container mx-auto max-w-7xl py-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AppLogo className="size-10 rounded-xl" pulse />
                <div>
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="mt-2 h-2 w-20" />
                </div>
              </div>
              <Loader2 className="animate-spin text-blue-500 size-5" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </div>
            <div className="app-panel rounded-2xl border border-border/60 bg-card/92 p-5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="mt-5 h-28 w-full rounded-xl" />
              <Skeleton className="mt-4 h-28 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </LaunchReady>
    )
  }

  return (
    <div className="app-shell min-h-screen text-foreground flex flex-col selection:bg-blue-500/20 selection:text-blue-500">
      
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />

      <TopNav 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
        onQuickAction={handleQuickAction}
        onAskAI={() => setIsAiOpen(true)}
        hideSensitive={hideSensitive}
        onToggleHideSensitive={handleToggleHideSensitive}
        onLogout={handleLogout}
        username={username}
        pendingNotifications={optimisticDashboardData?.pendingNotifications || []}
        onConfirmSubscription={handleConfirmSubscription}
        onDeletePayment={handleDeletePayment}
        darkMode={darkMode}
        onToggleDarkMode={handleToggleDarkMode}
        currency={optimisticDashboardData?.setting?.currency || 'USD'}
        isSyncing={isBackgroundSyncing || pendingOps.length > 0}
        isOffline={isOffline}
        syncLabel={
          syncCountdownMs > 0
            ? `Retrying ${Math.ceil(syncCountdownMs / 1000)}s`
            : activeSyncId
              ? 'Syncing...'
              : pendingOps.length > 0
                ? `${pendingOps.length} queued`
                : isBackgroundSyncing
                  ? 'Refreshing'
                  : undefined
        }
        failedOpsCount={failedOps.length}
        onOpenFailedOps={() => setShowFailedOpsModal(true)}
        onDiscardSubscription={handleDiscardSubscription}
        draftCount={draftTransactions.length}
      />

      <AiAssistantPanel
        isOpen={isAiOpen}
        onClose={() => setIsAiOpen(false)}
        onActions={handleAiActions}
        sensitiveMode={hideSensitive}
        isOffline={isOffline}
      />

      {error && (
        <div className="bg-destructive/15 border-b border-destructive/30 text-destructive px-4 py-2 text-xs flex items-center justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-destructive animate-pulse select-none" />
          <span className="select-none">{error}</span>
          <button
            type="button"
            onClick={() => loadAll(selectedMonth || undefined, selectedYear || undefined, true)}
            disabled={isBackgroundSyncing}
            className="ml-1 font-bold underline underline-offset-2 hover:text-destructive/80 disabled:opacity-60 disabled:cursor-default cursor-pointer"
          >
            {isBackgroundSyncing ? 'Retrying…' : 'Retry'}
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <PullToRefresh
        onRefresh={() => loadAll(selectedMonth || undefined, selectedYear || undefined, true)}
        disabled={loading || isLocked}
      >
      <main className="flex-1 container mx-auto px-4 py-6 sm:py-8 pb-24 md:pb-8 max-w-7xl relative">
        <ErrorBoundary variant="inline" resetKey={activeTab}>
        <Suspense fallback={<ContentViewFallback />}>
        <LaunchReady>
        {/* Keyed on the active tab so every view change replays the gentle
            slide entrance instead of hard-swapping content. Deliberately NOT
            wrapped in <AnimatePresence mode="wait">: gating the incoming view on
            the outgoing one's exit animation could deadlock (an interrupted or
            never-completing exit left the new view unmounted, so the nav showed
            the new tab as active while the old content stayed on screen and
            tapping again was a no-op). Remounting on key change replays the
            entrance without any exit-completion dependency. */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 30, mass: 1 }}
          className="w-full gpu-layer"
        >
        {activeTab === 'dashboard' && (
          <DashboardView
            dashboardData={optimisticDashboardData}
            transactions={allTransactions}
            onSelectPeriod={handleSelectPeriod}
            onNavigate={setActiveTab}
            hideSensitive={hideSensitive}
            hideBalanceAmounts={hideBalanceAmounts}
            walletBalance={totalBalance}
            onToggleBalanceAmounts={handleToggleBalanceAmounts}
            onConfirmSubscription={handleConfirmSubscription}
            onDeletePayment={handleDeletePayment}
            onNavigateToLedger={handleNavigateToLedger}
            wishlist={allWishlist}
            onDiscardSubscription={handleDiscardSubscription}
            onAddTransaction={handleAddTransaction}
            onAddBalanceAdjustment={handleAddBalanceAdjustment}
            isSwitchingCycle={isSwitchingCycle}
          />
        )}        {activeTab === 'settings' && (
          <SettingsView 
            dashboardData={optimisticDashboardData}
            categoriesList={allCategories}
            darkMode={darkMode}
            hideSensitive={hideSensitive}
            onToggleDarkMode={handleToggleDarkMode}
            onToggleHideSensitive={handleToggleHideSensitive}
            onUpdateSettings={handleUpdateSettings}
            onAddCategory={handleAddCategory}
            onDeleteCategory={requestDeleteCategory}
            onApplyCategoryCleanupSuggestion={handleApplyCategoryCleanupSuggestion}
            notifyOnLoginEnabled={modalCheckbox}
            onToggleNotifyOnLogin={(checked) => {
              setModalCheckbox(checked)
              localStorage.setItem('show_notifications_on_login', checked ? 'true' : 'false')
              showToast('Notification preference updated.', 'Settings Saved', 'success')
            }}
            activeSyncId={activeSyncId}
            deletingId={deletingTxId}
            onToast={showToast}
            onNavigateToLedger={handleNavigateToLedger}
          />
        )}

        {activeTab === 'recurring' && (
          <RecurringPaymentsView 
            payments={allRecurringPayments}
            activeRecurringPayments={optimisticDashboardData?.activeRecurringPayments || []}
            transactions={allTransactions}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            cycleDay={optimisticDashboardData?.setting?.cycleDay || 28}
            onAddPayment={handleAddPayment}
            onToggleActive={handleToggleActive}
            onDeletePayment={requestDeletePayment}
            onUpdatePayment={handleUpdatePayment}
            hideSensitive={hideSensitive}
            categories={allCategories}
            currency={optimisticDashboardData?.setting?.currency || 'USD'}
            autoOpenAddForm={autoOpenSubscriptionAdd}
            onResetAutoOpen={() => setAutoOpenSubscriptionAdd(false)}
            isSwitchingCycle={isSwitchingCycle}
            activeSyncId={activeSyncId}
            deletingId={deletingTxId}
            aiDraft={aiRecurringDraft}
            aiEditDraft={aiRecurringEditDraft}
            onAiDraftConsumed={() => setAiRecurringDraft(null)}
            onAiEditDraftConsumed={() => setAiRecurringEditDraft(null)}
          />
        )}

        {activeTab === 'ledger' && (
          <LedgerView 
            transactions={allTransactions}
            autocompleteSuggestions={autocompleteSuggestions}
            onAddTransaction={handleAddTransaction}
            onDeleteTransaction={handleDeleteTransaction}
            onUpdateTransaction={handleUpdateTransaction}
            hideSensitive={hideSensitive}
            categories={allCategories}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            availableYears={optimisticDashboardData?.availableYears || [selectedYear || new Date().getFullYear()]}
            cycleDay={optimisticDashboardData?.setting?.cycleDay || 28}
            onSelectPeriod={handleSelectPeriod}
            incomingCategory={ledgerIncomingCategory}
            incomingSearch={ledgerIncomingSearch}
            incomingDate={ledgerIncomingDate}
            incomingTxType={ledgerIncomingTxType}
            highlightedTxId={highlightedTxId}
            onClearIncomingFilters={() => {
              setLedgerIncomingCategory(null)
              setLedgerIncomingSearch(null)
              setLedgerIncomingDate(null)
              setLedgerIncomingTxType(null)
              setHighlightedTxId(null)
            }}
            showAllCycles={ledgerShowAllCycles}
            onClearAllCycles={() => { setLedgerShowAllCycles(false) }}
            cyclesRange={ledgerCyclesRange}
            currency={optimisticDashboardData?.setting?.currency || 'USD'}
            autoOpenAddForm={autoOpenLedgerAdd}
            onResetAutoOpen={() => setAutoOpenLedgerAdd(false)}
            stabilityBalance={optimisticDashboardData?.categories?.find(c => c.name === 'Stability')?.remaining ?? 0}
            isSwitchingCycle={isSwitchingCycle}
            stabilityTarget={optimisticDashboardData?.setting?.targetStabilityFund ?? 10000}
            essentialsAlloc={optimisticDashboardData?.setting?.essentialsAlloc ?? 0.5}
            growthAlloc={optimisticDashboardData?.setting?.growthAlloc ?? 0.25}
            stabilityAlloc={optimisticDashboardData?.setting?.stabilityAlloc ?? 0.15}
            rewardsAlloc={optimisticDashboardData?.setting?.rewardsAlloc ?? 0.1}
            stabilityOverflowRedirect={optimisticDashboardData?.setting?.stabilityOverflowRedirect}
            onFetchPagedTransactions={api.fetchPagedTransactions}
            onFetchTransactionById={api.fetchTransactionById}
            onExportTransactions={api.exportTransactionsCsv}
            onShowAlert={showAlert}
            activeSyncId={activeSyncId}
            deletingTxId={deletingTxId}
            onStartEditPending={setEditingPendingId}
            receiptScanDraft={activeReceiptScanDraft}
            onReceiptScanStarted={handleReceiptScanStarted}
            onReceiptScanCleared={clearReceiptScanJob}
            onAddFormOpenChange={setIsLedgerAddOpen}
            activeScanJobIds={receiptScanJobIds}
            failedScanJob={failedScanJob}
            aiDraft={aiLedgerDraft}
            aiEditDraft={aiLedgerEditDraft}
            aiExportRequest={aiLedgerExportRequest}
            onAiDraftConsumed={() => setAiLedgerDraft(null)}
            onAiEditDraftConsumed={() => setAiLedgerEditDraft(null)}
            onAiExportRequestConsumed={() => setAiLedgerExportRequest(null)}
          />
        )}

        {activeTab === 'wishlist' && (
          <WishlistView 
            wishlist={allWishlist}
            rewardsBalance={wishlistDashboardData?.categories?.find(c => c.name === 'Rewards')?.remaining ?? 0}
            rewardsTarget={wishlistDashboardData?.categories?.find(c => c.name === 'Rewards')?.target ?? 400}
            pastThreeMonthsRewardsAverage={wishlistDashboardData?.stats?.pastThreeMonthsRewardsAverage ?? 0}
            hasRewardsHistory={wishlistDashboardData?.stats?.hasRewardsHistory ?? false}
            currency={optimisticDashboardData?.setting?.currency || 'USD'}
            hideSensitive={hideSensitive}
            onAddItem={handleAddWishlistItem}
            onUpdateItem={handleUpdateWishlistItem}
            onDeleteItem={requestDeleteWishlistItem}
            onPurchaseItem={handlePurchaseWishlistItem}
            formatSensitive={formatSensitive}
            autoOpenAddModal={autoOpenWishlistAdd}
            onResetAutoOpen={() => setAutoOpenWishlistAdd(false)}
            onNavigateToLedger={handleNavigateToLedger}
            activeSyncId={activeSyncId}
            deletingId={deletingTxId}
            isSwitchingCycle={isSwitchingCycle}
            onStartEditPending={setEditingPendingId}
            aiDraft={aiWishlistDraft}
            aiEditDraft={aiWishlistEditDraft}
            onAiDraftConsumed={() => setAiWishlistDraft(null)}
            onAiEditDraftConsumed={() => setAiWishlistEditDraft(null)}
          />
        )}

        {activeTab === 'drafts' && draftTransactions.length > 0 && (
          <DraftStagingView 
            draftTransactions={draftTransactions}
            onUpdateDraftTransaction={handleUpdateDraftTransaction}
            onDeleteDraftTransaction={requestDeleteDraftTransaction}
            hideSensitive={hideSensitive}
            currency={optimisticDashboardData?.setting?.currency || 'USD'}
            onCancel={() => setActiveTab('ledger')}
            onAddAnother={() => {
              setActiveTab('ledger')
              setAutoOpenLedgerAdd(true)
            }}
          />
        )}
        </motion.div>
        </LaunchReady>
        </Suspense>
        </ErrorBoundary>
      </main>
      </PullToRefresh>

      <PendingSubscriptionsModal
        isOpen={showLoginModal}
        pendingNotifications={optimisticDashboardData?.pendingNotifications || []}
        currency={optimisticDashboardData?.setting?.currency || 'USD'}
        hideSensitive={hideSensitive}
        showOnLoginChecked={modalCheckbox}
        onToggleShowOnLogin={(checked) => {
          setModalCheckbox(checked)
          localStorage.setItem('show_notifications_on_login', checked ? 'true' : 'false')
        }}
        onClose={() => setShowLoginModal(false)}
        onConfirmSubscription={handleConfirmSubscription}
        onDiscardSubscription={handleDiscardSubscription}
        onRemoveSubscription={(recurringPaymentId) => setConfirmModalData({
          title: 'Remove Subscription',
          message: 'Are you sure you want to delete this recurring subscription? This will cancel all future notifications for this subscription.',
          confirmText: 'Remove',
          onConfirm: () => handleDeletePayment(recurringPaymentId)
        })}
      />

      <FailedSyncModal
        isOpen={showFailedOpsModal}
        failedOps={failedOps}
        onClose={() => setShowFailedOpsModal(false)}
        onDiscard={handleDiscardFailedOp}
        onDiscardAll={handleDiscardAllFailedOps}
      />

      <PasswordPromptModal
        isOpen={showPasswordPrompt}
        onClose={() => setShowPasswordPrompt(false)}
        onVerified={() => {
          setHideSensitive(false)
          localStorage.setItem('hide_sensitive', 'false')
          setShowPasswordPrompt(false)
          mutateQueue(prev => enqueue(prev, 'settings', 'update', 'hideSensitive', { hideSensitive: false }))
        }}
        onTryFingerprint={hasFingerprintSetup ? revealSensitiveWithFingerprint : undefined}
      />

      <LockScreen
        isOpen={isLocked && !!token}
        onUnlocked={() => {
          lastUnlockedTimeRef.current = Date.now()
          localStorage.setItem('last_active_time', Date.now().toString())
          sessionStorage.setItem('session_locked', 'false')
          setIsLocked(false)
          const hasCache = hasCachedKey(CACHE_KEYS.dashboardData);
          const { month: cachedMonth, year: cachedYear } = getCachedDashboardPeriod();
          loadAll(cachedMonth, cachedYear, hasCache);
        }}
        onSignOut={handleLogout}
      />

      {/* Footer */}
      <footer className="border-t border-border/40 py-6 pb-24 md:pb-6 bg-background/45 backdrop-blur select-none">
        <div className="container mx-auto px-4 text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} FinancialApp. All rights reserved.
        </div>
      </footer>
      <CustomAlertModal
        isOpen={!!customAlert}
        title={customAlert?.title || 'Notification'}
        message={customAlert?.message || ''}
        onClose={() => setCustomAlert(null)}
      />

      <CustomConfirmModal
        isOpen={!!confirmModalData}
        title={confirmModalData?.title || 'Confirmation'}
        message={confirmModalData?.message || ''}
        confirmText={confirmModalData?.confirmText || 'Confirm'}
        cancelText="Cancel"
        confirmDisabled={confirmModalData?.confirmDisabled || false}
        onConfirm={() => {
          if (confirmModalData) {
            confirmModalData.onConfirm()
            setConfirmModalData(null)
          }
        }}
        onCancel={() => setConfirmModalData(null)}
      />

      {/* Mobile Floating Action Button (FAB) & Speed Dial Menu */}
      {token && (
        <>
          {/* Backdrop Blur Overlay when speed dial is open */}
          <AnimatePresence>
          {isFabOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFabOpen(false)}
              className="md:hidden fixed inset-0 z-30 bg-background/60 backdrop-blur-xs"
            />
          )}
          </AnimatePresence>

          {/* Speed Dial Menu Items — staggered so they cascade out from the
              FAB (nearest first) and collapse back together instantly. */}
          <AnimatePresence>
          {isFabOpen && (
          <motion.div
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={{
              visible: { opacity: 1, transition: { staggerChildren: 0.05, staggerDirection: -1 } },
              hidden: { opacity: 0, transition: { staggerChildren: 0.05, staggerDirection: 1, delayChildren: 0.1 } }
            }}
            style={{ bottom: 'calc(148px + env(safe-area-inset-bottom, 0px))' }}
            className="md:hidden fixed right-8 z-40 flex flex-col gap-3.5 items-end pointer-events-auto"
          >
            {([
              { key: 'wishlist' as const, label: 'Add Wish Goal', Icon: PiggyBank, circleClass: 'bg-pink-500 group-hover:bg-pink-600' },
              { key: 'subscription' as const, label: 'New Subscription', Icon: CreditCard, circleClass: 'bg-violet-500 group-hover:bg-violet-600' },
              { key: 'transaction' as const, label: 'Post Transaction', Icon: Wallet, circleClass: 'bg-emerald-500 group-hover:bg-emerald-600' },
            ]).map(({ key, label, Icon, circleClass }) => (
              <motion.button
                key={key}
                variants={{
                  visible: { opacity: 1, y: 0, scale: 1 },
                  hidden: { opacity: 0, y: 15, scale: 0.9 }
                }}
                whileTap={{ scale: 0.92 }}
                onClick={() => {
                  handleQuickAction(key)
                  setIsFabOpen(false)
                }}
                className="flex items-center gap-2.5 group cursor-pointer focus:outline-none"
              >
                <span className="bg-card border border-border px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-foreground shadow-xs select-none group-hover:bg-muted transition duration-150">
                  {label}
                </span>
                <div className={`size-11 rounded-full ${circleClass} text-white flex items-center justify-center shadow-lg transition`}>
                  <Icon className="size-5" />
                </div>
              </motion.button>
            ))}
          </motion.div>
          )}
          </AnimatePresence>

          {/* Main FAB Toggle Button */}
          <motion.button
            whileTap={{ scale: 0.92 }}
            animate={{
              rotate: (activeTab !== 'drafts' && isFabOpen) ? 135 : 0
            }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            onClick={() => {
              if (activeTab === 'drafts') {
                handleSyncDraftBatch()
              } else {
                setIsFabOpen(prev => !prev)
              }
            }}
            className={`fixed right-6 flex items-center justify-center size-14 rounded-full text-white shadow-xl cursor-pointer ${
              activeTab === 'drafts'
                ? 'bg-gradient-to-tr from-emerald-600 to-green-500 shadow-emerald-500/20 z-40'
                : 'bg-gradient-to-tr from-blue-600 to-sky-500 shadow-blue-500/10 z-40 md:hidden'
            }`}
            style={{
              bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))'
            }}
            title={activeTab === 'drafts' ? 'Sync Batch to Server' : 'Open Menu'}
          >
            {activeTab === 'drafts' ? (
              <Upload className="size-6" />
            ) : (
              <Plus className="size-6" />
            )}
          </motion.button>
        </>
      )}
    </div>
  )
}

export default App
