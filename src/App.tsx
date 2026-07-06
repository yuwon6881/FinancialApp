import { useState, useMemo, useEffect, useRef, useCallback, lazy, Suspense, type ReactNode } from 'react'
import { App as CapacitorApp } from '@capacitor/app'
import { AnimatePresence, motion } from 'framer-motion'
import { SplashScreen } from '@capacitor/splash-screen'
import TopNav from "./TopNav.tsx"
import { ErrorBoundary } from './components/ErrorBoundary'
import { APP_TABS, type AppTab, type Transaction, type RecurringPayment, type DashboardData, type TransactionCategory, type WishlistItem } from './types'
import * as api from './lib/api'
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
import { formatCurrencyVal } from './lib/utils'
import { CustomAlertModal } from './components/ui/CustomAlertModal'
import { CustomConfirmModal } from './components/ui/CustomConfirmModal'
import { PullToRefresh } from './components/ui/PullToRefresh'
import { ToastViewport, type ToastMessage, type ToastTone, type ToastAction } from './components/ui/ToastViewport'
import { CardSkeleton, Skeleton } from './components/ui/Skeleton'
import { CACHE_KEYS, getCachedJSON, getCachedTransactions, sanitizeTransactions, setCachedJSON, hasCachedKey, getCachedDashboardPeriod, getCachedOps, getCachedCycleSnapshot, setCachedCycleSnapshot } from './lib/cache'
import { backupModalDraftsOnLogout, restoreModalDraftsOnLogin, clearAllModalDrafts } from './lib/modalDrafts'
import { enqueue, applyOpsToList, createFinalId, createLocalWishlistId, DISPATCH, sanitizeQueuedOps, getSyncSuccessToast, type QueuedOp, type EntityKind } from './lib/outbox'
import { PendingSubscriptionsModal } from './components/PendingSubscriptionsModal'
import { PasswordPromptModal } from './components/PasswordPromptModal'
import { LockScreen } from './components/LockScreen'
import { AppLogo } from './components/ui/AppLogo'
import { triggerHaptic } from './lib/haptics'
import { isPlatformAuthenticatorAvailable, getFingerprintAssertion } from './lib/webauthn'

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

const LaunchReady = ({ children }: { children: ReactNode }) => {
  useEffect(() => {
    void finishLaunchHandoff()
  }, [])

  return <>{children}</>
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
  
  const [transactions, setTransactions] = useState<Transaction[]>(() => getCachedTransactions(CACHE_KEYS.transactions))
  const [recurringPayments, setRecurringPayments] = useState<RecurringPayment[]>(() => getCachedJSON(CACHE_KEYS.recurringPayments, []))
  const [categoriesList, setCategoriesList] = useState<TransactionCategory[]>(() => getCachedJSON(CACHE_KEYS.categories, []))
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(() => getCachedJSON(CACHE_KEYS.dashboardData, null))
  const [wishlist, setWishlist] = useState<WishlistItem[]>(() => getCachedJSON(CACHE_KEYS.wishlist, []))

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



  const [selectedMonth, setSelectedMonth] = useState<string>(() => getCachedDashboardPeriod().month || '')
  const [selectedYear, setSelectedYear] = useState<number>(() => getCachedDashboardPeriod().year || 0)
  const [ledgerIncomingCategory, setLedgerIncomingCategory] = useState<string | null>(null)
  const [ledgerIncomingDate, setLedgerIncomingDate] = useState<string | null>(null)
  const [ledgerIncomingTxType, setLedgerIncomingTxType] = useState<'inflow' | 'outflow' | null>(null)
  const [ledgerShowAllCycles, setLedgerShowAllCycles] = useState(false)
  const [autoOpenLedgerAdd, setAutoOpenLedgerAdd] = useState(false)
  const [autoOpenSubscriptionAdd, setAutoOpenSubscriptionAdd] = useState(false)
  const [autoOpenWishlistAdd, setAutoOpenWishlistAdd] = useState(false)
  const [isHoveringWallet, setIsHoveringWallet] = useState(false)
  const [highlightedTxId, setHighlightedTxId] = useState<string | null>(null)
  const [hideSensitive, setHideSensitive] = useState<boolean>(() => {
    return localStorage.getItem('hide_sensitive') !== 'false'
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
    message: string
    confirmText?: string
    onConfirm: () => void
  } | null>(null)
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const showToast = (message: string, title: string = 'Notification', tone: ToastTone = 'info', action?: ToastAction) => {
    const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 7)
    setToasts(prev => [...prev.slice(-3), { id, message, title, tone, action }])
  }

  // "Before" snapshots for undo, keyed by `${entity}:${targetId}`. Captured at the moment
  // of a reversible update/delete so the drain loop can build a compensating op once the
  // change has synced. First-write-wins per key: if several edits to the same record are
  // coalesced into one queued op (and one toast), undo reverts to the earliest known state.
  const undoSnapshotsRef = useRef<Map<string, any>>(new Map())
  const snapshotForUndo = (entity: EntityKind, targetId: string, obj: any) => {
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
  const buildUndoAction = (op: QueuedOp, result: any): ToastAction | undefined => {
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
        const realId = result && result.id != null ? String(result.id) : String(op.targetId)
        return { label: 'Undo', onAction: () => mutateQueue(prev => enqueue(prev, 'wishlistItem', 'delete', realId, undefined, true)) }
      }

      // Deletes -> re-add the captured record (reusing its id where the API accepts one).
      case 'transaction:delete':
        if (!before) return undefined
        return { label: 'Undo', onAction: () => mutateQueue(prev => enqueue(prev, 'transaction', 'add', String(before.id), { ...before }, true)) }
      case 'recurringPayment:delete':
        if (!before) return undefined
        return { label: 'Undo', onAction: () => mutateQueue(prev => enqueue(prev, 'recurringPayment', 'add', String(before.id), { ...before }, true)) }
      case 'category:delete':
        if (!before) return undefined
        return { label: 'Undo', onAction: () => mutateQueue(prev => enqueue(prev, 'category', 'add', String(before.id), { ...before }, true)) }
      case 'wishlistItem:delete': {
        if (!before) return undefined
        // Wishlist ids are server-generated, so a re-add takes a fresh local placeholder id.
        const placeholderId = String(createLocalWishlistId())
        const payload = { ...before }
        delete payload.id
        return { label: 'Undo', onAction: () => mutateQueue(prev => enqueue(prev, 'wishlistItem', 'add', placeholderId, payload, true)) }
      }

      // Updates -> restore the captured prior values.
      case 'transaction:update':
        if (!before) return undefined
        return { label: 'Undo', onAction: () => mutateQueue(prev => enqueue(prev, 'transaction', 'update', String(op.targetId), { ...before }, true)) }
      case 'recurringPayment:update':
        if (!before) return undefined
        return { label: 'Undo', onAction: () => mutateQueue(prev => enqueue(prev, 'recurringPayment', 'update', String(op.targetId), { ...before }, true)) }
      case 'wishlistItem:update':
        if (!before) return undefined
        return { label: 'Undo', onAction: () => mutateQueue(prev => enqueue(prev, 'wishlistItem', 'update', String(op.targetId), { ...before }, true)) }

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

  // Shadow the global alert function
  const alert = (message: string) => showAlert(message, 'Notification')

  // Apply/remove the 'dark' class on <html> whenever darkMode changes,
  // and keep the PWA/browser chrome (theme-color) in sync with the active theme.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', darkMode ? '#0a0d14' : '#f6f8fc')
  }, [darkMode])

  // Keep visual viewport CSS vars in sync so fixed bottom-sheet modals stay
  // pinned to the visible area while the mobile keyboard opens, closes, or
  // pans the layout viewport.
  useEffect(() => {
    const vv = window.visualViewport
    const root = document.documentElement
    let viewportRaf = 0
    let activeFocusEl: HTMLElement | null = null
    let activeFocusPanel: HTMLElement | null = null
    let focusSettleTimer = 0
    let focusMaxTimer = 0
    const viewportVars = new Map<string, string>()

    const setViewportVar = (name: string, value: number) => {
      const next = `${value.toFixed(2)}px`
      if (viewportVars.get(name) === next) return
      viewportVars.set(name, next)
      root.style.setProperty(name, next)
    }

    const applyViewport = () => {
      const h = vv ? vv.height : window.innerHeight
      const w = vv ? vv.width : window.innerWidth
      const top = vv ? vv.offsetTop : 0
      const left = vv ? vv.offsetLeft : 0
      setViewportVar('--app-vvh', h)
      setViewportVar('--app-vvw', w)
      setViewportVar('--app-vv-top', top)
      setViewportVar('--app-vv-left', left)
    }

    const scheduleViewport = () => {
      if (viewportRaf) return
      viewportRaf = window.requestAnimationFrame(() => {
        viewportRaf = 0
        applyViewport()
      })
    }

    const ensureFocusedFieldVisible = (el: HTMLElement, panel: HTMLElement) => {
      if (document.activeElement !== el || !panel.contains(el)) return
      const panelRect = panel.getBoundingClientRect()
      const elRect = el.getBoundingClientRect()
      const topPadding = 18
      const bottomPadding = 40

      if (elRect.bottom > panelRect.bottom - bottomPadding) {
        panel.scrollTop += elRect.bottom - panelRect.bottom + bottomPadding
      } else if (elRect.top < panelRect.top + topPadding) {
        panel.scrollTop -= panelRect.top + topPadding - elRect.top
      }
    }

    const clearFocusCorrection = () => {
      if (focusSettleTimer) window.clearTimeout(focusSettleTimer)
      if (focusMaxTimer) window.clearTimeout(focusMaxTimer)
      focusSettleTimer = 0
      focusMaxTimer = 0
    }

    const runFocusCorrection = () => {
      clearFocusCorrection()
      const el = activeFocusEl
      const panel = activeFocusPanel
      if (!el || !panel || document.activeElement !== el || !panel.contains(el)) return
      window.requestAnimationFrame(() => ensureFocusedFieldVisible(el, panel))
    }

    const scheduleFocusCorrection = (delay: number, withMaxTimer = false) => {
      if (!activeFocusEl || !activeFocusPanel) return
      if (focusSettleTimer) window.clearTimeout(focusSettleTimer)
      focusSettleTimer = window.setTimeout(runFocusCorrection, delay)
      if (withMaxTimer && !focusMaxTimer) {
        focusMaxTimer = window.setTimeout(runFocusCorrection, 720)
      }
    }

    const isSheetLayout = () => window.matchMedia('(max-width: 639px)').matches
    const handleFocusIn = (e: FocusEvent) => {
      if (!isSheetLayout()) return
      const el = e.target as HTMLElement | null
      if (!el || !el.matches?.('input, textarea, select')) return
      const panel = el.closest('.sheet-panel') as HTMLElement | null
      if (!panel) return

      activeFocusEl = el
      activeFocusPanel = panel
      root.classList.add('sheet-keyboard-focus')
      scheduleFocusCorrection(260, true)
    }

    const handleFocusOut = () => {
      window.setTimeout(() => {
        const active = document.activeElement as HTMLElement | null
        if (active?.closest?.('.sheet-panel')) return
        activeFocusEl = null
        activeFocusPanel = null
        clearFocusCorrection()
        root.classList.remove('sheet-keyboard-focus')
      }, 0)
    }

    const handleViewportChange = () => {
      scheduleViewport()
      if (activeFocusEl && activeFocusPanel) {
        scheduleFocusCorrection(140)
      }
    }

    applyViewport()
    vv?.addEventListener('resize', handleViewportChange)
    vv?.addEventListener('scroll', handleViewportChange)
    window.addEventListener('resize', handleViewportChange)
    document.addEventListener('focusin', handleFocusIn)
    document.addEventListener('focusout', handleFocusOut)

    return () => {
      vv?.removeEventListener('resize', handleViewportChange)
      vv?.removeEventListener('scroll', handleViewportChange)
      window.removeEventListener('resize', handleViewportChange)
      document.removeEventListener('focusin', handleFocusIn)
      document.removeEventListener('focusout', handleFocusOut)
      if (viewportRaf) window.cancelAnimationFrame(viewportRaf)
      clearFocusCorrection()
      root.classList.remove('sheet-keyboard-focus')
    }
  }, [])

  // Inactivity Auto-Lock
  const LOCK_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes
  const lastUnlockedTimeRef = useRef<number>(0)
  const [isLocked, setIsLocked] = useState<boolean>(() => {
    return sessionStorage.getItem('session_locked') === 'true'
  })

  // Inactivity tracking - update last_active_time in localStorage
  useEffect(() => {
    if (!token || isLocked) return
    localStorage.setItem('last_active_time', Date.now().toString())
    const updateActivity = () => {
      localStorage.setItem('last_active_time', Date.now().toString())
    }
    // Throttle to once per 5 seconds
    let lastUpdate = 0
    const throttled = () => {
      const now = Date.now()
      if (now - lastUpdate > 5000) {
        lastUpdate = now
        updateActivity()
      }
    }
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
    events.forEach(e => window.addEventListener(e, throttled, { passive: true }))
    return () => events.forEach(e => window.removeEventListener(e, throttled))
  }, [token, isLocked])

  // Check inactivity every 15 seconds and lock if exceeded
  useEffect(() => {
    if (!token || isLocked) return
    const interval = setInterval(() => {
      const lastActive = Number(localStorage.getItem('last_active_time') || Date.now())
      if (Date.now() - lastActive > LOCK_TIMEOUT_MS) {
        api.lockSession()
          .then(() => {
            setIsLocked(true)
            sessionStorage.setItem('session_locked', 'true')
          })
          .catch(err => {
            if (err?.message && (err.message.includes('401') || err.message.toLowerCase().includes('unauthorized'))) {
              handleLogout()
            } else {
              console.warn('Failed to lock session on server, bypassing local lock to prevent fake lock state:', err)
            }
          })
      }
    }, 15000)
    return () => clearInterval(interval)
  }, [token, isLocked])

  // Password Prompt for revealing sensitive information
  const [showPasswordPrompt, setShowPasswordPrompt] = useState<boolean>(false)
  const [hasFingerprintSetup, setHasFingerprintSetup] = useState<boolean>(false)

  useEffect(() => {
    if (!token) return
    isPlatformAuthenticatorAvailable().then(available => {
      if (!available) return
      api.fetchAuthStatus().then(res => setHasFingerprintSetup(res.hasFingerprint)).catch(() => undefined)
    })
  }, [token])

  // Cycle switching state for skeleton loader
  const [isSwitchingCycle, setIsSwitchingCycle] = useState<boolean>(false)

  // Login Notification Modal States
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false)
  const [hasShownModalThisSession, setHasShownModalThisSession] = useState<boolean>(false)
  const [modalCheckbox, setModalCheckbox] = useState<boolean>(
    localStorage.getItem('show_notifications_on_login') !== 'false'
  )

  const handleLogout = async () => {
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
    localStorage.removeItem(CACHE_KEYS.pendingTransactions)
    localStorage.removeItem(CACHE_KEYS.pendingOperations)
    localStorage.removeItem('failed_operations')
    localStorage.removeItem('draft_transactions')
    clearAllModalDrafts()
    setIsLocked(false)
  }

  // Fetch initial ledger and dashboard statistics
  async function loadAll(month?: string, year?: number, isBackground = false) {
    if (!token) return
    if (!isBackground) {
      setLoading(true)
    } else {
      setIsBackgroundSyncing(true)
    }
    try {
      const dbData = await api.fetchDashboard(month, year)
      const [txs, recs, cats, wishes] = await Promise.all([
        api.fetchTransactions(dbData.setting.selectedMonth, dbData.setting.selectedYear),
        api.fetchRecurringPayments(),
        api.fetchCategories(),
        api.fetchWishlist().catch(() => [])
      ])
      setSelectedMonth(dbData.setting.selectedMonth)
      setSelectedYear(dbData.setting.selectedYear)
      setDashboardData(dbData)
      setTransactions(txs)
      setRecurringPayments(recs)
      setCategoriesList(cats)
      setWishlist(wishes)
      setError(null)
      isServerAwakeRef.current = true
      setIsLocked(false)
      sessionStorage.setItem('session_locked', 'false')

      // Save to localStorage cache
      setCachedJSON(CACHE_KEYS.dashboardData, dbData)
      setCachedJSON(CACHE_KEYS.transactions, txs)
      setCachedJSON(CACHE_KEYS.recurringPayments, recs)
      setCachedJSON(CACHE_KEYS.categories, cats)
      setCachedJSON(CACHE_KEYS.wishlist, wishes)
      setCachedCycleSnapshot(dbData.setting.selectedMonth, dbData.setting.selectedYear, dbData, txs)

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
    } catch (err: any) {
      console.error(err)
      const isJustLoggedIn = Date.now() - lastUnlockedTimeRef.current < 10000
      if (err.message && (err.message.includes('401') || err.message.toLowerCase().includes('unauthorized'))) {
        if (!isJustLoggedIn) {
          handleLogout()
        } else {
          setError(null)
        }
      } else if (err.message && err.message.includes('423')) {
        if (Date.now() - lastUnlockedTimeRef.current > 15000) {
          setIsLocked(true)
          sessionStorage.setItem('session_locked', 'true')
        }
      } else {
        setError('Could not connect to the database API server. Running in offline view mode.')
        isServerAwakeRef.current = false
      }
    } finally {
      setLoading(false)
      setIsBackgroundSyncing(false)
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
    localStorage.setItem('last_active_time', Date.now().toString())
    lastUnlockedTimeRef.current = Date.now()
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
    } catch (err: any) {
      console.error(err)
      if (err.message && (err.message.includes('401') || err.message.toLowerCase().includes('unauthorized'))) {
        handleLogout()
      } else {
        alert('Error updating active month.')
      }
    } finally {
      setIsSwitchingCycle(false)
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

  const handleDeleteCategory = (id: string) => {
    snapshotForUndo('category', String(id), allCategories.find(cat => String(cat.id) === String(id)))
    mutateQueue(prev => enqueue(prev, 'category', 'delete', id))
  }

  const requestDeleteCategory = (id: string) => {
    if (hideSensitive) { showToast('Unhide balances to make changes.', 'Sensitive mode active', 'warning'); return }
    const category = categoriesList.find(cat => cat.id === id)
    setConfirmModalData({
      title: 'Delete Category',
      message: `Delete "${category?.name || 'this category'}"? Existing transactions that use it may keep the old category name, but it will no longer be available for new entries.`,
      confirmText: 'Delete',
      onConfirm: () => { handleDeleteCategory(id) }
    })
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

  const handleConfirmSubscription = (noti: any, paidDate: string) => {
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

  const handleDiscardSubscription = (noti: any) => {
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
    mutateQueue(prev => enqueue(prev, 'recurringPayment', 'update', id, payment))
  }

  const handleDeletePayment = (id: string) => {
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
    mutateQueue(prev => enqueue(prev, 'wishlistItem', 'update', String(id), updatedWish))
  }

  const handleDeleteWishlistItem = (id: number) => {
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
    mutateQueue(prev => enqueue(prev, 'wishlistItem', 'purchase', String(id)))
  }

  // Save pending operations to localStorage whenever they change
  useEffect(() => {
    setCachedJSON(CACHE_KEYS.pendingOperations, pendingOps)
  }, [pendingOps])

  useEffect(() => {
    setCachedJSON('failed_operations', failedOps)
  }, [failedOps])

  // Background Sync Queue Worker Refs
  const pendingOpsRef = useRef(pendingOps);
  const draftTxRef = useRef(draftTransactions);
  const failedOpsRef = useRef(failedOps);
  const usernameRef = useRef(username);
  const editingPendingIdRef = useRef(editingPendingId);
  const syncBackoffUntilRef = useRef(syncBackoffUntil);

  useEffect(() => {
    pendingOpsRef.current = pendingOps;
  }, [pendingOps]);

  // Single entry point for every queue mutation. Computes the next queue from the
  // *ref* (the synchronous source of truth) rather than React state, then writes
  // ref and state together. This is what makes concurrent mutations safe: an Undo
  // click that enqueues a compensating op while the drain loop is awaiting a
  // dispatch reads-and-writes the same ref the loop does, so neither clobbers the
  // other's change (the earlier plain-value writes lost whichever landed second).
  const mutateQueue = useCallback((updater: (prev: QueuedOp[]) => QueuedOp[]) => {
    const next = updater(pendingOpsRef.current);
    // Deliberate synchronous ref write: this ref *is* the live queue the drain
    // loop reads mid-await, so it must update now, not after the next render.
    // eslint-disable-next-line react-hooks/immutability
    pendingOpsRef.current = next;
    setPendingOps(next);
  }, []);

  useEffect(() => {
    draftTxRef.current = draftTransactions;
  }, [draftTransactions]);

  useEffect(() => {
    failedOpsRef.current = failedOps;
  }, [failedOps]);

  useEffect(() => {
    usernameRef.current = username;
  }, [username]);

  useEffect(() => {
    editingPendingIdRef.current = editingPendingId;
  }, [editingPendingId]);

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

  const processQueue = useCallback(async () => {
    if (!token || isSyncingRef.current) return;
    isSyncingRef.current = true;
    setIsBackgroundSyncing(true);

    let processedAny = false;
    const successfulOps: Array<{ op: QueuedOp; result: any }> = [];

    try {
      while (true) {
        const queue = pendingOpsRef.current;
        const nextOp = queue[0];
        if (!nextOp) break;

        if (nextOp.targetId === editingPendingIdRef.current || nextOp.id === editingPendingIdRef.current) {
          break;
        }

        if (Date.now() < syncBackoffUntilRef.current) {
          break;
        }

        setActiveSyncId(nextOp.targetId);

        try {
          const key = `${nextOp.entity}:${nextOp.type}`;
          const dispatchFn = DISPATCH[key];
          if (!dispatchFn) {
            console.error(`No dispatch handler for ${key}`);
            // Drop just this op by id (never by index): a concurrent enqueue may
            // have shifted positions while we were in this iteration.
            mutateQueue(prev => prev.filter(item => item.id !== nextOp.id));
            continue;
          }

          const result = await dispatchFn(nextOp);

          // Functional removal keyed off the live queue, so any op enqueued during
          // the await above (e.g. an Undo tap) is preserved rather than clobbered.
          mutateQueue(prev => {
            let next = prev.filter(item => item.id !== nextOp.id);
            if (nextOp.entity === 'wishlistItem' && nextOp.type === 'add' && result && result.id) {
              const realIdStr = String(result.id);
              next = next.map(op => (op.entity === 'wishlistItem' && op.targetId === nextOp.targetId)
                ? { ...op, targetId: realIdStr }
                : op);
            }
            return next;
          });

          setRecentlyCompletedOps(prev => [...prev, { ...nextOp, isCompleted: true }]);
          setTimeout(() => {
            setRecentlyCompletedOps(prev => prev.filter(op => op.id !== nextOp.id));
          }, 3000);

          setError(null);
          processedAny = true;
          successfulOps.push({ op: nextOp, result });
        } catch (err: any) {
          console.error(`Failed to sync ${nextOp.entity}:${nextOp.type}:`, err);
          const isAuthError = err.message && (err.message.includes('401') || err.message.toLowerCase().includes('unauthorized'));
          const isLockError = err.message && err.message.includes('423');
          const isJustLoggedIn = Date.now() - lastUnlockedTimeRef.current < 10000;

          if (isAuthError && !isJustLoggedIn) {
            handleLogout();
            break;
          } else if (isAuthError || isLockError) {
            // Either a spurious 401 racing a fresh login, or the session is
            // momentarily locked (423) -- wait it out without burning a
            // retry or ever moving the op to failedOps.
            setError(isLockError ? 'Sync pending: session is locked...' : 'Sync pending: reconnecting...');
            const backoff = Date.now() + (isLockError ? 15000 : 3000);
            syncBackoffUntilRef.current = backoff;
            setSyncBackoffUntil(backoff);
            break;
          } else {
            const updatedRetryCount = (nextOp.retryCount || 0) + 1;
            if (updatedRetryCount >= 5) {
              const opDesc = nextOp.payload?.description || nextOp.payload?.name || nextOp.entity;
              showToast(`Couldn't sync '${opDesc}' — removed from queue`, 'Sync Failed', 'error');

              mutateQueue(prev => prev.filter(item => item.id !== nextOp.id));
              setFailedOps(prev => [...prev, { ...nextOp, retryCount: updatedRetryCount }]);
              continue;
            } else {
              // Bump retry on this op by id (not index 0) so a concurrently
              // enqueued op that jumped ahead doesn't get the retry count instead.
              mutateQueue(prev => prev.map(item =>
                item.id === nextOp.id ? { ...item, retryCount: updatedRetryCount } : item
              ));

              setError('Sync pending: Server is offline or waking up...');
              const backoff = Date.now() + 15000;
              syncBackoffUntilRef.current = backoff;
              setSyncBackoffUntil(backoff);
              break;
            }
          }
        }
      }

      if (processedAny) {
        try {
          await loadAll(selectedMonth || undefined, selectedYear || undefined, true);
        } catch (refreshErr) {
          console.error('Post-sync dashboard refresh failed:', refreshErr);
        }
        
        // Show toasts only after UI is refreshed so they are fully "final". Copy (and any
        // opt-out) lives in one place — lib/outbox.ts — so new op types need no changes here.
        successfulOps.forEach(({ op, result }) => {
          const toast = getSyncSuccessToast(op)
          if (toast) {
            showToast(toast.message, toast.title, toast.tone, op.isUndo ? undefined : buildUndoAction(op, result))
          }
        })
      }
    } finally {
      setActiveSyncId(null);
      setDeletingTxId(null);
      setIsBackgroundSyncing(false);
      isSyncingRef.current = false;
    }
  }, [token, selectedMonth, selectedYear, mutateQueue]);

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

  const allTransactions = useMemo(() => {
    return applyOpsToList(transactions, activeOps, 'transaction');
  }, [activeOps, transactions]);

  const allRecurringPayments = useMemo(() => {
    return applyOpsToList(recurringPayments, activeOps, 'recurringPayment');
  }, [activeOps, recurringPayments]);

  const allWishlist = useMemo(() => {
    return applyOpsToList(wishlist, activeOps, 'wishlistItem');
  }, [activeOps, wishlist]);

  const allCategories = useMemo(() => {
    return applyOpsToList(categoriesList, activeOps, 'category');
  }, [activeOps, categoriesList]);

  // Create optimistic dashboardData from server data + pending queue
  const optimisticDashboardData = useMemo(() => {
    if (!dashboardData) return null;
    
    const data = { ...dashboardData };
    data.setting = { ...data.setting };
    data.stats = { ...data.stats };
    data.categories = data.categories.map(c => ({ ...c }));
    data.recentTransactions = [...allTransactions];

    // Check if settings op queued
    const settingsOps = pendingOps.filter(o => o.entity === 'settings' && o.type === 'update');
    settingsOps.forEach(op => {
      if (op.payload) {
        data.setting = { ...data.setting, ...op.payload };
      }
    });

    const txOps = pendingOps.filter(o => o.entity === 'transaction');
    txOps.forEach(op => {
      if (op.type === 'add' && op.payload) {
        const amount = op.payload.amount || 0;
        data.stats.totalBalance += amount;
        const catName = op.payload.category || op.payload.ledgerCategory || '';
        const cat = data.categories.find(c => c.name.toLowerCase() === catName.toLowerCase());
        if (cat) {
          cat.netChange += amount;
          cat.remaining += amount;
        }
        if (amount > 0) {
          data.stats.monthlyInflow += amount;
          if ((op.payload.ledgerCategory || '').startsWith('IncomeSplit:')) {
            data.stats.monthlyIncome += amount;
          }
        } else {
          data.stats.monthlyExpenses += Math.abs(amount);
        }
      } else if (op.type === 'update' && op.payload) {
        const orig = transactions.find(t => String(t.id) === String(op.targetId));
        const oldAmount = orig ? orig.amount : 0;
        const newAmount = op.payload.amount !== undefined ? op.payload.amount : oldAmount;
        const diff = newAmount - oldAmount;
        data.stats.totalBalance += diff;
        const catName = op.payload.category || op.payload.ledgerCategory || (orig ? (orig.category || orig.ledgerCategory) : '');
        const cat = data.categories.find(c => c.name.toLowerCase() === catName.toLowerCase());
        if (cat) {
          cat.netChange += diff;
          cat.remaining += diff;
        }
        if (diff > 0) {
          data.stats.monthlyInflow += diff;
        } else if (diff < 0) {
          data.stats.monthlyExpenses += Math.abs(diff);
        }
      } else if (op.type === 'delete') {
        const orig = transactions.find(t => String(t.id) === String(op.targetId));
        const oldAmount = orig ? orig.amount : 0;
        data.stats.totalBalance -= oldAmount;
        const catName = orig ? (orig.category || orig.ledgerCategory) : '';
        const cat = data.categories.find(c => c.name.toLowerCase() === catName.toLowerCase());
        if (cat) {
          cat.netChange -= oldAmount;
          cat.remaining -= oldAmount;
        }
        if (oldAmount > 0) {
          data.stats.monthlyInflow -= oldAmount;
        } else {
          data.stats.monthlyExpenses -= Math.abs(oldAmount);
        }
      }
    });

    return data;
  }, [dashboardData, pendingOps, transactions, allTransactions]);

  const formatSensitive = (val: number) => {
    const formatted = formatCurrencyVal(val, optimisticDashboardData?.setting?.currency || 'USD')
    return (
      <span className={hideSensitive ? 'blur-sm select-none pointer-events-none inline-block transition-[filter] duration-200' : 'transition-[filter] duration-200'}>
        {formatted}
      </span>
    )
  }

  // Calculate Net Worth for Top Nav summary display
  const totalBalance = useMemo(() => {
    if (optimisticDashboardData) {
      return optimisticDashboardData.stats.totalBalance
    }
    return allTransactions.reduce((acc, t) => acc + t.amount, 0)
  }, [allTransactions, optimisticDashboardData])

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
      setLedgerIncomingDate(null)
      setLedgerIncomingTxType(null)
      setLedgerCyclesRange('monthly')
      setLedgerShowAllCycles(false)
    }
  }, [activeTab])

  const handleNavigateToLedger = (options: {
    category?: string | null
    date?: string | null
    txType?: 'inflow' | 'outflow' | null
    range?: 'monthly' | '3month' | '6month' | 'yearly'
    highlightedTxId?: string | null
    showAllCycles?: boolean
  }) => {
    setLedgerIncomingCategory(options.category || null)
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
    if (!(await isPlatformAuthenticatorAvailable())) return false
    try {
      const status = await api.fetchAuthStatus()
      if (!status.hasFingerprint) return false
      const { challengeId, options } = await api.getFingerprintAssertOptions()
      const credential = await getFingerprintAssertion(options)
      await api.verifyFingerprintAssert(challengeId, credential)
      setHideSensitive(false)
      localStorage.setItem('hide_sensitive', 'false')
      mutateQueue(prev => enqueue(prev, 'settings', 'update', 'hideSensitive', { hideSensitive: false }))
      return true
    } catch (err) {
      console.warn('Fingerprint prompt failed/cancelled:', err)
      return false
    }
  }

  const handleToggleHideSensitive = async () => {
    if (hideSensitive) {
      const revealed = await revealSensitiveWithFingerprint()
      if (!revealed) {
        setShowPasswordPrompt(true)
      }
    } else {
      setHideSensitive(true)
      localStorage.setItem('hide_sensitive', 'true')
      mutateQueue(prev => enqueue(prev, 'settings', 'update', 'hideSensitive', { hideSensitive: true }))
    }
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
        totalBalance={totalBalance}
        onQuickAction={handleQuickAction}
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
        onMouseEnterWallet={() => setIsHoveringWallet(true)}
        onMouseLeaveWallet={() => setIsHoveringWallet(false)}
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
        onDiscardSubscription={handleDiscardSubscription}
        draftCount={draftTransactions.length}
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
            onConfirmSubscription={handleConfirmSubscription}
            onDeletePayment={handleDeletePayment}
            onNavigateToLedger={handleNavigateToLedger}
            wishlist={allWishlist}
            isHoveringWallet={isHoveringWallet}
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
            notifyOnLoginEnabled={modalCheckbox}
            onToggleNotifyOnLogin={(checked) => {
              setModalCheckbox(checked)
              localStorage.setItem('show_notifications_on_login', checked ? 'true' : 'false')
              showToast('Notification preference updated.', 'Settings Saved', 'success')
            }}
            activeSyncId={activeSyncId}
            deletingId={deletingTxId}
            onToast={showToast}
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
          />
        )}

        {activeTab === 'ledger' && (
          <LedgerView 
            transactions={allTransactions}
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
            incomingDate={ledgerIncomingDate}
            incomingTxType={ledgerIncomingTxType}
            highlightedTxId={highlightedTxId}
            onClearIncomingFilters={() => {
              setLedgerIncomingCategory(null)
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
            onFetchPagedTransactions={api.fetchPagedTransactions}
            onExportTransactions={api.exportTransactionsCsv}
            onShowAlert={showAlert}
            activeSyncId={activeSyncId}
            deletingTxId={deletingTxId}
            onStartEditPending={setEditingPendingId}
          />
        )}

        {activeTab === 'wishlist' && (
          <WishlistView 
            wishlist={allWishlist}
            rewardsBalance={optimisticDashboardData?.categories?.find(c => c.name === 'Rewards')?.remaining ?? 0}
            rewardsTarget={optimisticDashboardData?.categories?.find(c => c.name === 'Rewards')?.target ?? 400}
            pastThreeMonthsRewardsAverage={optimisticDashboardData?.stats?.pastThreeMonthsRewardsAverage ?? 0}
            hasRewardsHistory={optimisticDashboardData?.stats?.hasRewardsHistory ?? false}
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
