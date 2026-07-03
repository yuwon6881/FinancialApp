import { useState, useMemo, useEffect, useRef, useCallback, lazy, Suspense, type ReactNode } from 'react'
import { App as CapacitorApp } from '@capacitor/app'
import { SplashScreen } from '@capacitor/splash-screen'
import './App.css'
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
import { ToastViewport, type ToastMessage, type ToastTone } from './components/ui/ToastViewport'
import { CardSkeleton, Skeleton } from './components/ui/Skeleton'
import { CACHE_KEYS, getCachedJSON, setCachedJSON, hasCachedKey, getCachedDashboardPeriod } from './lib/cache'
import { PendingSubscriptionsModal } from './components/PendingSubscriptionsModal'
import { PasswordPromptModal } from './components/PasswordPromptModal'
import { LockScreen } from './components/LockScreen'
import { AppLogo } from './components/ui/AppLogo'

const createLocalId = (prefix: string, separator = '_') => {
  return `${prefix}${separator}${Date.now()}${separator}${Math.random().toString(36).substring(2, 9)}`
}

// Instant, flash-free placeholder while a lazily-loaded chunk is fetched.
const ViewFallback = () => <div className="app-shell min-h-screen" />

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
    void CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) void hideNativeSplashAfterPaint()
    }).then(handle => {
      cleanup = () => { void handle.remove() }
    })

    return () => cleanup?.()
  }, [])
  
  const [transactions, setTransactions] = useState<Transaction[]>(() => getCachedJSON(CACHE_KEYS.transactions, []))
  const [recurringPayments, setRecurringPayments] = useState<RecurringPayment[]>(() => getCachedJSON(CACHE_KEYS.recurringPayments, []))
  const [categoriesList, setCategoriesList] = useState<TransactionCategory[]>(() => getCachedJSON(CACHE_KEYS.categories, []))
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(() => getCachedJSON(CACHE_KEYS.dashboardData, null))
  const [wishlist, setWishlist] = useState<WishlistItem[]>(() => getCachedJSON(CACHE_KEYS.wishlist, []))

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(() => !hasCachedKey(CACHE_KEYS.dashboardData))

  // Sync Queue States
  const [pendingTransactions, setPendingTransactions] = useState<Transaction[]>(() => getCachedJSON(CACHE_KEYS.pendingTransactions, []))
  const [isBackgroundSyncing, setIsBackgroundSyncing] = useState<boolean>(false)
  const [actionLoading, setActionLoading] = useState<boolean>(false)
  const [activeSyncId, setActiveSyncId] = useState<string | null>(null)
  const [syncBackoffUntil, setSyncBackoffUntil] = useState<number>(0)
  const [syncCountdownMs, setSyncCountdownMs] = useState<number>(0)
  const [editingPendingId, setEditingPendingId] = useState<string | null>(null)
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
      return stored ? JSON.parse(stored) : []
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

  const showToast = (message: string, title: string = 'Notification', tone: ToastTone = 'info') => {
    const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 7)
    setToasts(prev => [...prev.slice(-3), { id, message, title, tone }])
  }

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }

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
        setIsLocked(true)
        sessionStorage.setItem('session_locked', 'true')
        api.lockSession().catch(err => console.warn('Failed to lock session on server:', err))
      }
    }, 15000)
    return () => clearInterval(interval)
  }, [token, isLocked])

  // Password Prompt for revealing sensitive information
  const [showPasswordPrompt, setShowPasswordPrompt] = useState<boolean>(false)

  // Login Notification Modal States
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false)
  const [hasShownModalThisSession, setHasShownModalThisSession] = useState<boolean>(false)
  const [modalCheckbox, setModalCheckbox] = useState<boolean>(
    localStorage.getItem('show_notifications_on_login') !== 'false'
  )

  const handleLogout = async () => {
    if (pendingTransactions.length > 0) {
      localStorage.setItem('pending_transactions_backup', JSON.stringify(pendingTransactions));
    }

    await api.logout()
    setToken(null)
    setUsername('')
    setDashboardData(null)
    setTransactions([])
    setRecurringPayments([])
    setPendingTransactions([])
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

      // Save to localStorage cache
      setCachedJSON(CACHE_KEYS.dashboardData, dbData)
      setCachedJSON(CACHE_KEYS.transactions, txs)
      setCachedJSON(CACHE_KEYS.recurringPayments, recs)
      setCachedJSON(CACHE_KEYS.categories, cats)
      setCachedJSON(CACHE_KEYS.wishlist, wishes)

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
      if (err.message && (err.message.includes('401') || err.message.toLowerCase().includes('unauthorized'))) {
        handleLogout()
      } else if (err.message && err.message.includes('423')) {
        setIsLocked(true)
        sessionStorage.setItem('session_locked', 'true')
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
    setToken(newToken)
    setUsername(newUsername)
    localStorage.setItem('auth_username', newUsername)
    sessionStorage.setItem('session_locked', 'false')
    localStorage.setItem('last_active_time', Date.now().toString())
    setIsLocked(false)

    // Restore any backed up pending transactions
    const cachedBackup = localStorage.getItem('pending_transactions_backup');
    if (cachedBackup) {
      try {
        const backedUpTxs = JSON.parse(cachedBackup);
        if (Array.isArray(backedUpTxs) && backedUpTxs.length > 0) {
          setPendingTransactions(backedUpTxs);
          localStorage.setItem(CACHE_KEYS.pendingTransactions, cachedBackup);
        }
      } catch (e) {
        console.error('Failed to parse backed up pending transactions:', e);
      }
      localStorage.removeItem('pending_transactions_backup');
    }
  }

  // Period / Settings changes
  const handleSelectPeriod = async (month: string, year: number) => {
    try {
      await api.selectPeriod(month, year)
      await loadAll(month, year)
    } catch (err) {
      console.error(err)
      alert('Error updating active month.')
    }
  }

  const handleUpdateSettings = async (settings: {
    targetStabilityFund: number
    essentialsAlloc: number
    growthAlloc: number
    stabilityAlloc: number
    rewardsAlloc: number
    cycleDay: number
    currency?: string
  }) => {
    try {
      await api.updateSettings({ ...settings, darkMode, hideSensitive })
      await loadAll(selectedMonth || undefined, selectedYear || undefined)
    } catch (err) {
      console.error(err)
      alert('Error updating configuration on server.')
    }
  }

  // Custom Categories & Accounts modifiers
  const handleAddCategory = async (newCat: Omit<TransactionCategory, 'id'>) => {
    try {
      await api.addCategory(newCat)
      await loadAll(selectedMonth || undefined, selectedYear || undefined)
    } catch (err: any) {
      console.error(err)
      alert(err.message || 'Error adding category.')
    }
  }

  const handleDeleteCategory = async (id: string) => {
    try {
      await api.deleteCategory(id)
      await loadAll(selectedMonth || undefined, selectedYear || undefined)
    } catch (err: any) {
      console.error(err)
      alert(err.message || 'Error deleting category.')
    }
  }

  const requestDeleteCategory = (id: string) => {
    const category = categoriesList.find(cat => cat.id === id)
    setConfirmModalData({
      title: 'Delete Category',
      message: `Delete "${category?.name || 'this category'}"? Existing transactions that use it may keep the old category name, but it will no longer be available for new entries.`,
      confirmText: 'Delete',
      onConfirm: () => { void handleDeleteCategory(id) }
    })
  }


  // Transaction modifiers
  const handleEditPendingTransaction = (id: string, updatedTx: Omit<Transaction, 'id'>) => {
    if (id === activeSyncId) return;
    setPendingTransactions(prev => prev.map(t => {
      if (t.id === id) {
        return { ...t, ...updatedTx } as Transaction;
      }
      return t;
    }));
  };

  const handleDeletePendingTransaction = (id: string) => {
    if (id === activeSyncId) return;
    setPendingTransactions(prev => prev.filter(t => t.id !== id));
  };

  const handleAddTransaction = async (newTx: Omit<Transaction, 'id'>) => {
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

  const handleAddBalanceAdjustment = async (newTx: Omit<Transaction, 'id'>) => {
    setActionLoading(true)
    try {
      await api.addTransaction(newTx)
      triggerVibration(20)
      await loadAll(selectedMonth || undefined, selectedYear || undefined)
      showToast('Balance adjustment recorded in ledger.', 'Ledger updated', 'success')
    } catch (err) {
      console.error(err)
      alert('Error adding balance adjustment on the server.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleUpdateDraftTransaction = (id: string, updated: Transaction) => {
    setDraftTransactions(prev => prev.map(t => t.id === id ? updated : t));
    triggerVibration(15);
  };

  const handleDeleteDraftTransaction = (id: string) => {
    setDraftTransactions(prev => prev.filter(t => t.id !== id));
    triggerVibration(30);
  };

  const requestDeleteDraftTransaction = (id: string) => {
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

    const finalPending = draftTransactions.map(d => {
      const tempId = createLocalId('temp');
      const serverTxId = createLocalId('tx', '-');
      return {
        ...d,
        id: tempId,
        serverTxId
      };
    });

    setDraftTransactions([]);
    triggerVibration([25, 45, 25]);
    setPendingTransactions(prev => [...prev, ...finalPending]);
    showToast(`${finalPending.length} transaction${finalPending.length > 1 ? 's' : ''} queued for sync.`, 'Sync queued', 'success')
  };

  const handleDeleteTransaction = async (id: string) => {
    if (id.startsWith('temp_')) {
      handleDeletePendingTransaction(id);
      if (id === editingPendingId) {
        setEditingPendingId(null);
      }
      return;
    }

    setActionLoading(true)
    try {
      await api.deleteTransaction(id)
      triggerVibration(30)
      await loadAll(selectedMonth || undefined, selectedYear || undefined)
      showToast('Transaction deleted.', 'Ledger updated', 'success')
    } catch (err) {
      console.error(err)
      alert('Error deleting transaction on the server.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleUpdateTransaction = async (id: string, updatedTx: Omit<Transaction, 'id'>) => {
    if (id.startsWith('temp_')) {
      handleEditPendingTransaction(id, updatedTx);
      setEditingPendingId(null);
      return;
    }

    setActionLoading(true)
    try {
      await api.updateTransaction(id, updatedTx)
      triggerVibration(15)
      await loadAll(selectedMonth || undefined, selectedYear || undefined)
      showToast('Transaction updated.', 'Ledger updated', 'success')
    } catch (err) {
      console.error(err)
      alert('Error updating transaction on the server.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleConfirmSubscription = async (noti: any, paidDate: string) => {
    try {
      await api.addTransaction({
        id: noti.id,
        date: paidDate,
        description: noti.name,
        amount: -Math.abs(noti.amount),
        category: noti.category,
        ledgerCategory: noti.ledgerCategory
      })
      await loadAll(selectedMonth || undefined, selectedYear || undefined)
      showToast('Subscription payment added to ledger.', 'Payment confirmed', 'success')
    } catch (err) {
      console.error(err)
      alert('Error confirming subscription payment.')
    }
  }

  const handleDiscardSubscription = async (noti: any) => {
    try {
      await api.addTransaction({
        id: noti.id,
        date: noti.billingDate,
        description: `[Discarded] ${noti.name}`,
        amount: 0,
        category: noti.category,
        ledgerCategory: 'Discarded'
      })
      await loadAll(selectedMonth || undefined, selectedYear || undefined)
      showToast('Subscription cycle skipped.', 'Payment skipped', 'info')
    } catch (err) {
      console.error(err)
      alert('Error discarding subscription payment.')
    }
  }


  // Recurring payment modifiers
  const handleAddPayment = async (newPay: Omit<RecurringPayment, 'id'>) => {
    try {
      await api.addRecurringPayment(newPay)
      await loadAll(selectedMonth || undefined, selectedYear || undefined)
    } catch (err) {
      console.error(err)
      alert('Error adding recurring payment on the server.')
    }
  }

  const handleToggleActive = async (id: string) => {
    try {
      await api.toggleRecurringPayment(id)
      await loadAll(selectedMonth || undefined, selectedYear || undefined)
    } catch (err) {
      console.error(err)
      alert('Error toggling payment status on the server.')
    }
  }

  const handleUpdatePayment = async (id: string, payment: RecurringPayment) => {
    try {
      await api.updateRecurringPayment(id, payment)
      await loadAll(selectedMonth || undefined, selectedYear || undefined)
    } catch (err) {
      console.error(err)
      alert('Error updating recurring payment on the server.')
    }
  }

  const handleDeletePayment = async (id: string) => {
    try {
      await api.deleteRecurringPayment(id)
      await loadAll(selectedMonth || undefined, selectedYear || undefined)
    } catch (err) {
      console.error(err)
      alert('Error deleting recurring payment on the server.')
    }
  }

  const requestDeletePayment = (id: string) => {
    const payment = recurringPayments.find(p => p.id === id)
    setConfirmModalData({
      title: 'Delete Subscription',
      message: `Delete "${payment?.name || 'this recurring subscription'}"? This will cancel all future notifications for this subscription.`,
      confirmText: 'Delete',
      onConfirm: () => { void handleDeletePayment(id) }
    })
  }

  // Wish List modifiers
  const handleAddWishlistItem = async (newWish: Partial<WishlistItem>) => {
    try {
      await api.addWishlistItem(newWish)
      await loadAll(selectedMonth || undefined, selectedYear || undefined)
    } catch (err: any) {
      console.error(err)
      alert(err.message || 'Error adding wishlist item.')
    }
  }

  const handleUpdateWishlistItem = async (id: number, updatedWish: WishlistItem) => {
    try {
      await api.updateWishlistItem(id, updatedWish)
      await loadAll(selectedMonth || undefined, selectedYear || undefined)
    } catch (err: any) {
      console.error(err)
      alert(err.message || 'Error updating wishlist item.')
    }
  }

  const handleDeleteWishlistItem = async (id: number) => {
    try {
      await api.deleteWishlistItem(id)
      await loadAll(selectedMonth || undefined, selectedYear || undefined)
    } catch (err: any) {
      console.error(err)
      alert(err.message || 'Error deleting wishlist item.')
    }
  }

  const requestDeleteWishlistItem = async (id: number): Promise<void> => {
    const item = wishlist.find(w => w.id === id)
    setConfirmModalData({
      title: 'Delete Wishlist Item',
      message: `Delete "${item?.name || 'this wishlist item'}"? This removes the savings goal from your wishlist.`,
      confirmText: 'Delete',
      onConfirm: () => { void handleDeleteWishlistItem(id) }
    })
  }

  const handlePurchaseWishlistItem = async (id: number) => {
    try {
      await api.purchaseWishlistItem(id)
      await loadAll(selectedMonth || undefined, selectedYear || undefined)
    } catch (err: any) {
      console.error(err)
      alert(err.message || 'Error purchasing wishlist item.')
    }
  }

  // Save pending transactions to localStorage whenever they change
  useEffect(() => {
    setCachedJSON(CACHE_KEYS.pendingTransactions, pendingTransactions)
  }, [pendingTransactions])

  // Warming ping and background sync are managed by wakeUpAndSync below

  // Background Sync Queue Worker Refs
  const pendingTxRef = useRef(pendingTransactions);
  const editingPendingIdRef = useRef(editingPendingId);
  const syncBackoffUntilRef = useRef(syncBackoffUntil);

  useEffect(() => {
    pendingTxRef.current = pendingTransactions;
  }, [pendingTransactions]);

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

    try {
      while (true) {
        const queue = pendingTxRef.current;
        const nextTx = queue[0];
        if (!nextTx) break;

        if (nextTx.id === editingPendingIdRef.current) {
          break;
        }

        if (Date.now() < syncBackoffUntilRef.current) {
          break;
        }

        setActiveSyncId(nextTx.id);

        try {
          const { id, serverTxId, ...txPayload } = nextTx as any;
          delete txPayload.isPendingSync;
          const payloadToSend = {
            ...txPayload,
            id: serverTxId || id
          };
          await api.addTransaction(payloadToSend);

          // Keep the optimistic row visible until the refreshed server row is loaded.
          await loadAll(selectedMonth || undefined, selectedYear || undefined, true);

          const updatedQueue = pendingTxRef.current.filter(item => item.id !== nextTx.id);
          pendingTxRef.current = updatedQueue;
          setPendingTransactions(updatedQueue);
          setError(null);
        } catch (err: any) {
          console.error('Failed to sync transaction:', err);
          if (err.message && (err.message.includes('401') || err.message.toLowerCase().includes('unauthorized'))) {
            handleLogout();
            break;
          } else {
            setError('Sync pending: Server is offline or waking up...');
            const backoff = Date.now() + 15000;
            syncBackoffUntilRef.current = backoff;
            setSyncBackoffUntil(backoff);
            break;
          }
        }
      }
    } finally {
      setActiveSyncId(null);
      setIsBackgroundSyncing(false);
      isSyncingRef.current = false;
    }
  }, [token, selectedMonth, selectedYear]);

  useEffect(() => {
    if (!token || pendingTransactions.length === 0) return;

    if (Date.now() < syncBackoffUntil) {
      const remaining = syncBackoffUntil - Date.now();
      const t = setTimeout(() => {
        syncBackoffUntilRef.current = 0;
        setSyncBackoffUntil(0);
      }, remaining);
      return () => clearTimeout(t);
    }

    processQueue();
  }, [token, pendingTransactions, syncBackoffUntil, processQueue]);

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

  // Combine synced and pending transactions
  const allTransactions = useMemo(() => {
    return [...pendingTransactions, ...transactions];
  }, [pendingTransactions, transactions]);

  // Create optimistic dashboardData from server data + pending queue
  const optimisticDashboardData = useMemo(() => {
    if (!dashboardData) return null;
    
    const data = { ...dashboardData };
    data.stats = { ...data.stats };
    data.categories = data.categories.map(c => ({ ...c }));
    data.recentTransactions = [...data.recentTransactions];

    pendingTransactions.forEach(t => {
      data.stats.totalBalance += t.amount;
      
      if (!data.recentTransactions.some(rt => rt.id === t.id)) {
        data.recentTransactions = [t, ...data.recentTransactions];
      }

      const catName = t.category || t.ledgerCategory;
      const cat = data.categories.find(c => c.name.toLowerCase() === catName.toLowerCase());
      if (cat) {
        cat.netChange += t.amount;
        cat.remaining += t.amount;
      }
      
      if (t.amount > 0) {
        data.stats.monthlyInflow += t.amount;
        if (t.ledgerCategory.startsWith('IncomeSplit:')) {
          data.stats.monthlyIncome += t.amount;
        }
      } else {
        data.stats.monthlyExpenses += Math.abs(t.amount);
      }
    });

    return data;
  }, [dashboardData, pendingTransactions]);

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

  const handleToggleHideSensitive = () => {
    if (hideSensitive) {
      setShowPasswordPrompt(true)
    } else {
      setHideSensitive(true)
      localStorage.setItem('hide_sensitive', 'true')
      api.updateHideSensitive(true).catch(err => console.warn('Hide sensitive sync failed:', err))
    }
  }

  const handleToggleDarkMode = async () => {
    const newDark = !darkMode
    setDarkMode(newDark)
    localStorage.setItem('dark_mode', newDark.toString())
    // Persist to server (non-blocking, non-fatal)
    api.updateDarkMode(newDark).catch(err => console.warn('Dark mode sync failed:', err))
  }

  const triggerVibration = (pattern: number | number[] = 15) => {
    if (navigator.vibrate) {
      try {
        navigator.vibrate(pattern)
      } catch {
        // Some browsers reject vibrate() calls outside a user gesture; safe to ignore.
      }
    }
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
        isSyncing={isBackgroundSyncing || pendingTransactions.length > 0}
        syncLabel={
          syncCountdownMs > 0
            ? `Retrying ${Math.ceil(syncCountdownMs / 1000)}s`
            : activeSyncId
              ? 'Syncing 1 item'
              : pendingTransactions.length > 0
                ? `${pendingTransactions.length} queued`
                : isBackgroundSyncing
                  ? 'Refreshing'
                  : undefined
        }
        onDiscardSubscription={handleDiscardSubscription}
        draftCount={draftTransactions.length}
      />

      {error && (
        <div className="bg-destructive/15 border-b border-destructive/30 text-destructive px-4 py-2 text-xs flex items-center justify-center gap-2 select-none">
          <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Content Area */}
      <PullToRefresh
        onRefresh={() => loadAll(selectedMonth || undefined, selectedYear || undefined, true)}
        disabled={loading || actionLoading || isLocked}
      >
      <main className="flex-1 container mx-auto px-4 py-6 sm:py-8 pb-24 md:pb-8 max-w-7xl relative">
        {(loading || actionLoading) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-[1.5px] transition-all duration-150">
            <div className="app-panel flex items-center gap-2.5 px-4 py-3 rounded-xl bg-card/95 border border-border/80 shadow-xl text-sm font-bold text-foreground select-none pointer-events-none animate-in zoom-in-95 duration-150">
              <Loader2 className="animate-spin text-blue-500 size-4" />
              Syncing changes...
            </div>
          </div>
        )}
        <ErrorBoundary variant="inline" resetKey={activeTab}>
        <Suspense fallback={<ViewFallback />}>
        <LaunchReady>
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
            wishlist={wishlist}
            isHoveringWallet={isHoveringWallet}
            onDiscardSubscription={handleDiscardSubscription}
            onAddTransaction={handleAddTransaction}
            onAddBalanceAdjustment={handleAddBalanceAdjustment}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            dashboardData={optimisticDashboardData}
            categoriesList={categoriesList}
            darkMode={darkMode}
            hideSensitive={hideSensitive}
            onToggleDarkMode={handleToggleDarkMode}
            onToggleHideSensitive={handleToggleHideSensitive}
            onUpdateSettings={handleUpdateSettings}
            onAddCategory={handleAddCategory}
            onDeleteCategory={requestDeleteCategory}
          />
        )}

        {activeTab === 'recurring' && (
          <RecurringPaymentsView 
            payments={recurringPayments}
            activeRecurringPayments={optimisticDashboardData?.activeRecurringPayments || []}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            cycleDay={optimisticDashboardData?.setting?.cycleDay || 28}
            onAddPayment={handleAddPayment}
            onToggleActive={handleToggleActive}
            onDeletePayment={requestDeletePayment}
            onUpdatePayment={handleUpdatePayment}
            hideSensitive={hideSensitive}
            categories={categoriesList}
            currency={optimisticDashboardData?.setting?.currency || 'USD'}
            autoOpenAddForm={autoOpenSubscriptionAdd}
            onResetAutoOpen={() => setAutoOpenSubscriptionAdd(false)}
            onConfirmSubscription={handleConfirmSubscription}
            onDiscardSubscription={handleDiscardSubscription}
          />
        )}

        {activeTab === 'ledger' && (
          <LedgerView 
            transactions={allTransactions}
            onAddTransaction={handleAddTransaction}
            onDeleteTransaction={handleDeleteTransaction}
            onUpdateTransaction={handleUpdateTransaction}
            hideSensitive={hideSensitive}
            categories={categoriesList}
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
            stabilityTarget={optimisticDashboardData?.setting?.targetStabilityFund ?? 10000}
            essentialsAlloc={optimisticDashboardData?.setting?.essentialsAlloc ?? 0.5}
            growthAlloc={optimisticDashboardData?.setting?.growthAlloc ?? 0.25}
            stabilityAlloc={optimisticDashboardData?.setting?.stabilityAlloc ?? 0.15}
            rewardsAlloc={optimisticDashboardData?.setting?.rewardsAlloc ?? 0.1}
            onFetchPagedTransactions={api.fetchPagedTransactions}
            onExportTransactions={api.exportTransactionsCsv}
            onShowAlert={showAlert}
            activeSyncId={activeSyncId}
            onStartEditPending={setEditingPendingId}
          />
        )}

        {activeTab === 'wishlist' && (
          <WishlistView 
            wishlist={wishlist}
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
          api.updateHideSensitive(false).catch(err => console.warn('Hide sensitive sync failed:', err))
        }}
      />

      <LockScreen
        isOpen={isLocked && !!token}
        onUnlocked={() => {
          localStorage.setItem('last_active_time', Date.now().toString())
          sessionStorage.setItem('session_locked', 'false')
          setIsLocked(false)
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
          {isFabOpen && (
            <div 
              onClick={() => setIsFabOpen(false)}
              className="md:hidden fixed inset-0 z-30 bg-background/60 backdrop-blur-xs animate-in fade-in duration-200"
            />
          )}

          {/* Speed Dial Menu Items */}
          <div
            style={{ bottom: 'calc(148px + env(safe-area-inset-bottom, 0px))' }}
            className={`md:hidden fixed right-8 z-40 flex flex-col gap-3.5 items-end transition-all duration-300 ${isFabOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'}`}
          >
            {/* Action 1: Add Wish Goal */}
            <button
              onClick={() => {
                handleQuickAction('wishlist')
                setIsFabOpen(false)
              }}
              className="flex items-center gap-2.5 group cursor-pointer focus:outline-none"
            >
              <span className="bg-card border border-border px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-foreground shadow-xs select-none group-hover:bg-muted transition duration-150">
                Add Wish Goal
              </span>
              <div className="size-11 rounded-full bg-pink-500 group-hover:bg-pink-600 text-white flex items-center justify-center shadow-lg active:scale-95 transition">
                <PiggyBank className="size-5" />
              </div>
            </button>

            {/* Action 2: New Subscription */}
            <button
              onClick={() => {
                handleQuickAction('subscription')
                setIsFabOpen(false)
              }}
              className="flex items-center gap-2.5 group cursor-pointer focus:outline-none"
            >
              <span className="bg-card border border-border px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-foreground shadow-xs select-none group-hover:bg-muted transition duration-150">
                New Subscription
              </span>
              <div className="size-11 rounded-full bg-violet-500 group-hover:bg-violet-600 text-white flex items-center justify-center shadow-lg active:scale-95 transition">
                <CreditCard className="size-5" />
              </div>
            </button>

            {/* Action 3: Post Transaction */}
            <button
              onClick={() => {
                handleQuickAction('transaction')
                setIsFabOpen(false)
              }}
              className="flex items-center gap-2.5 group cursor-pointer focus:outline-none"
            >
              <span className="bg-card border border-border px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-foreground shadow-xs select-none group-hover:bg-muted transition duration-150">
                Post Transaction
              </span>
              <div className="size-11 rounded-full bg-emerald-500 group-hover:bg-emerald-600 text-white flex items-center justify-center shadow-lg active:scale-95 transition">
                <Wallet className="size-5" />
              </div>
            </button>
          </div>

          {/* Main FAB Toggle Button */}
          <button
            onClick={() => {
              if (activeTab === 'drafts') {
                handleSyncDraftBatch()
              } else {
                setIsFabOpen(prev => !prev)
              }
            }}
            className={`fixed right-6 flex items-center justify-center size-14 rounded-full text-white shadow-xl hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer ${
              activeTab === 'drafts'
                ? 'bg-gradient-to-tr from-emerald-600 to-green-500 shadow-emerald-500/20 z-40'
                : 'bg-gradient-to-tr from-blue-600 to-sky-500 shadow-blue-500/10 z-40 md:hidden'
            }`}
            style={{
              bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
              transform: (activeTab !== 'drafts' && isFabOpen) ? 'rotate(135deg)' : 'rotate(0deg)'
            }}
            title={activeTab === 'drafts' ? 'Sync Batch to Server' : 'Open Menu'}
          >
            {activeTab === 'drafts' ? (
              <Upload className="size-6" />
            ) : (
              <Plus className="size-7" />
            )}
          </button>
        </>
      )}
    </div>
  )
}

export default App
