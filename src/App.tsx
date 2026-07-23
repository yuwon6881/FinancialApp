import { useState, useMemo, useEffect, useRef, useCallback, lazy, Suspense, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Capacitor } from '@capacitor/core'
import { SplashScreen } from '@capacitor/splash-screen'
import TopNav from "./TopNav.tsx"
import { ErrorBoundary } from './components/ErrorBoundary'
import { type AppTab, type DashboardData } from './types'
import * as api from './lib/api'
import { Loader2, Upload, Wallet, CreditCard, PiggyBank, Sparkles, X, Zap } from 'lucide-react'

// Every view is code-split so the initial bundle only ships the shell. Each
// chunk loads on demand behind an instant blank-shell fallback (no flash).
const LoginView = lazy(() => import('./components/LoginView').then(m => ({ default: m.LoginView })))
const DashboardView = lazy(() => import('./components/DashboardView').then(m => ({ default: m.DashboardView })))
const ReportsView = lazy(() => import('./components/ReportsView').then(m => ({ default: m.ReportsView })))
const RecurringPaymentsView = lazy(() => import('./components/RecurringPaymentsView').then(m => ({ default: m.RecurringPaymentsView })))
const LedgerView = lazy(() => import('./components/LedgerView').then(m => ({ default: m.LedgerView })))
const WishlistView = lazy(() => import('./components/WishlistView').then(m => ({ default: m.WishlistView })))
const SettingsView = lazy(() => import('./components/SettingsView').then(m => ({ default: m.SettingsView })))
const DraftStagingView = lazy(() => import('./components/DraftStagingView').then(m => ({ default: m.DraftStagingView })))
const InvestmentsView = lazy(() => import('./components/InvestmentsView').then(m => ({ default: m.InvestmentsView })))

import { CustomAlertModal } from './components/ui/CustomAlertModal'
import { CustomConfirmModal } from './components/ui/CustomConfirmModal'
import { PullToRefresh } from './components/ui/PullToRefresh'
import { ToastViewport } from './components/ui/ToastViewport'
import { CycleSkeleton, Skeleton, type PageSkeletonVariant } from './components/ui/Skeleton'
import { clearLocalFinancialData, getCachedCycleSnapshot } from './lib/cache'
import { useVisualViewportVars } from './lib/useVisualViewportVars'
import { useReceiptScanPolling } from './lib/useReceiptScanPolling'
import { useNativeAppLifecycle } from './lib/useNativeAppLifecycle'
const PendingSubscriptionsModal = lazy(() => import('./components/PendingSubscriptionsModal').then(m => ({ default: m.PendingSubscriptionsModal })))
const FailedSyncModal = lazy(() => import('./components/FailedSyncModal').then(m => ({ default: m.FailedSyncModal })))
const PasswordPromptModal = lazy(() => import('./components/PasswordPromptModal').then(m => ({ default: m.PasswordPromptModal })))
const LockScreen = lazy(() => import('./components/LockScreen').then(m => ({ default: m.LockScreen })))
const AiAssistantPanel = lazy(() => import('./components/AiAssistantPanel').then(m => ({ default: m.AiAssistantPanel })))
const CycleSummaryModal = lazy(() => import('./components/CycleSummaryModal').then(m => ({ default: m.CycleSummaryModal })))
import { AppLogo } from './components/ui/AppLogo'
import { syncStatusBarTheme } from './lib/nativeUi'
import { getCurrentCycleYearAndMonth, MONTH_NAMES } from './lib/cycle'
import type { AppContextValue } from './contexts/AppContext'
import { AppProvider } from './contexts/AppProvider'

// Domain Hooks
import { useAppPreferences } from './app/useAppPreferences'
import { useAppSession } from './app/useAppSession'
import { useFinancialData } from './app/useFinancialData'
import { useCycleNavigation } from './app/useCycleNavigation'
import { useAiActionRouter } from './app/useAiActionRouter'
import { useAppDialogs } from './app/useAppDialogs'
import { useCycleSummary } from './app/useCycleSummary'
import { usePushNotifications } from './app/usePushNotifications'
import { buildAppContextValue } from './app/buildAppContextValue'
import { getErrorName } from './lib/errors'
import { prefetchFingerprintAssertOptions } from './lib/fingerprintOptionsCache'
import { readAppLocation, updateAppSearch } from './lib/appLocation'

// Instant, flash-free placeholder while a lazily-loaded chunk is fetched at the root level.
const ViewFallback = () => <div className="app-shell min-h-screen" />

// Skeleton placeholder for tab navigation to prevent empty squares in the main content area.
const getPageSkeletonVariant = (tab: AppTab): PageSkeletonVariant => tab

const ContentViewFallback = ({ tab }: { tab: AppTab }) => (
  <div className="w-full pt-2 animate-in fade-in duration-300">
    <CycleSkeleton variant={getPageSkeletonVariant(tab)} fullPage />
  </div>
)

const fabMenuVariants = {
  hidden: {
    transition: { staggerChildren: 0.04 },
  },
  visible: {
    transition: {
      delayChildren: 0.06,
      staggerChildren: 0.08,
      // Reveal from the action nearest the FAB and work upwards.
      staggerDirection: -1,
    },
  },
}

const fabActionVariants = {
  hidden: { opacity: 0, scale: 0.7, y: 18 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 260, damping: 18 },
  },
}

const nextPaint = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
const wait = (ms: number) => new Promise<void>(resolve => window.setTimeout(resolve, ms))

const waitForStableAppPaint = async () => {
  await nextPaint()
  await nextPaint()
  await nextPaint()
  await wait(180)
}

const hideNativeSplashAfterPaint = async () => {
  if (!Capacitor.isNativePlatform()) return
  await waitForStableAppPaint()
  await SplashScreen.hide().catch(() => undefined)
}

let launchHandoffPromise: Promise<void> | null = null

const finishLaunchHandoff = () => {
  if (launchHandoffPromise) return launchHandoffPromise

  launchHandoffPromise = (async () => {
    // Keep the document splash above React until several complete frames have
    // painted. This closes the translucent WebAPK handoff gap seen in Chrome
    // without delaying subsequent in-app view changes.
    await waitForStableAppPaint()
    document.getElementById('__splash')?.remove()

    // Chrome's installed PWA splash is browser-owned. Only call the Capacitor
    // plugin in the native shell, where it actually controls the launch window.
    if (Capacitor.isNativePlatform()) {
      await SplashScreen.hide().catch(() => undefined)
    }
  })()

  return launchHandoffPromise
}

const LaunchReady = ({ children }: { children: ReactNode }) => {
  useEffect(() => {
    void finishLaunchHandoff()
  }, [])

  return <>{children}</>
}

function App() {
  const loadAllAbortRef = useRef<AbortController | null>(null)
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  useNativeAppLifecycle(hideNativeSplashAfterPaint)

  // 1. Preferences
  const prefs = useAppPreferences()

  // 2. Dialogs
  const dialogs = useAppDialogs()

  const [hasShownModalThisSession, setHasShownModalThisSession] = useState(false)

  const guardSensitive = useCallback(() => {
    if (!prefs.hideSensitive) return true
    dialogs.showToast('Unhide balances to make changes.', 'Sensitive mode active', 'warning')
    return false
  }, [prefs.hideSensitive, dialogs.showToast])

  // 3. Session
  const session = useAppSession({
    hideSensitive: prefs.hideSensitive,
    setHideSensitive: prefs.setHideSensitive,
    onPreferenceOwnerChange: prefs.setPreferenceOwner,
    loadAllAbortRef,
    loadAll: (m, y, b) => {
      const route = readAppLocation()
      return financial.loadAll(m || route.month || undefined, y || route.year || undefined, b)
    },
    onLogoutBackupAndCleanup: (username) => financial.handleLogoutCleanup(username),
    onLoginSuccessRestore: (username) => financial.handleLoginSuccessRestore(username),
  })

  const push = usePushNotifications(
    !!session.token && !session.isLocked,
    dialogs.showToast,
  )

  // 4. Cycle Navigation
  const nav = useCycleNavigation({
    loadAll: (m, y, b, shouldCommit) => financial.loadAll(m, y, b, false, shouldCommit),
    handleLogout: session.handleLogout,
    markSessionLocked: session.markSessionLocked,
    setDashboardData: (d) => financial.setDashboardData(d),
    setTransactions: (t) => financial.setTransactions(t),
    setActiveTab: prefs.setActiveTab,
    setLedgerCyclesRange: prefs.setLedgerCyclesRange,
  })

  // 5. Financial Data
  const financial = useFinancialData({
    token: session.token,
    lastUnlockedTimeRef: session.lastUnlockedTimeRef,
    isLocked: session.isLocked,
    markSessionLocked: session.markSessionLocked,
    handleLogout: session.handleLogout,
    hideSensitive: prefs.hideSensitive,
    darkMode: prefs.darkMode,
    showToast: dialogs.showToast,
    guardSensitive,
    setConfirmModalData: dialogs.setConfirmModalData,
    resolveHideSensitive: prefs.resolveHideSensitive,
    markSensitivePreferenceUnavailable: prefs.markSensitivePreferenceUnavailable,
    setDarkMode: prefs.setDarkMode,
    notifyOnLogin: prefs.notifyOnLogin,
    loadAllAbortRef,
    selectedMonth: nav.selectedMonth,
    setSelectedMonth: nav.setSelectedMonth,
    selectedYear: nav.selectedYear,
    setSelectedYear: nav.setSelectedYear,
    setHasShownModalThisSession,
    hasShownModalThisSession,
    setShowLoginModal: dialogs.setShowLoginModal,
  })

  const [isLedgerAddOpen, setIsLedgerAddOpen] = useState(false)
  const isLedgerAddOpenRef = useRef(isLedgerAddOpen)
  useEffect(() => {
    isLedgerAddOpenRef.current = isLedgerAddOpen
  }, [isLedgerAddOpen])

  const activeTabRef = useRef(prefs.activeTab)
  useEffect(() => {
    activeTabRef.current = prefs.activeTab
  }, [prefs.activeTab])

  // 6. Receipt scanning
  const {
    activeReceiptScanDraft,
    failedScanJob,
    receiptScanJobIds,
    handleReceiptScanStarted,
    clearReceiptScanJob,
  } = useReceiptScanPolling({
    token: session.token,
    activeTabRef,
    isLedgerAddOpenRef,
    isMountedRef,
    setActiveTab: prefs.setActiveTab,
    setAutoOpenLedgerAdd: nav.setAutoOpenLedgerAdd,
    showToast: dialogs.showToast,
  })

  // 7. AI action router
  const aiRouter = useAiActionRouter({
    hideSensitive: prefs.hideSensitive,
    showToast: dialogs.showToast,
    setActiveTab: prefs.setActiveTab,
    handleSelectPeriod: nav.handleSelectPeriod,
    handleNavigateToLedger: nav.handleNavigateToLedger,
    setConfirmModalData: dialogs.setConfirmModalData,
    allTransactions: financial.allTransactions,
    handleDeleteTransaction: financial.handleDeleteTransaction,
    allRecurringPayments: financial.allRecurringPayments,
    allWishlist: financial.allWishlist,
    handleToggleActive: financial.handleToggleActive,
    optimisticDashboardData: financial.optimisticDashboardData,
    handleDiscardSubscription: financial.handleDiscardSubscription,
    handleConfirmSubscription: financial.handleConfirmSubscription,
    handlePurchaseWishlistItem: financial.handlePurchaseWishlistItem,
    handleUnpurchaseWishlistItem: financial.handleUnpurchaseWishlistItem,
    requestDeletePayment: financial.requestDeletePayment,
    requestDeleteWishlistItem: financial.requestDeleteWishlistItem,
    allCategories: financial.allCategories,
    handleStageDraftTransactions: financial.handleStageDraftTransactions,
  })

  // Shadow global alert
  const alert = (message: string) => dialogs.showAlert(message, 'Notification')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', prefs.darkMode)
    const surface = prefs.darkMode ? '#0a0d14' : '#f6f8fc'
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', surface)
    // Paint the root + body surface to match the active theme. In a standalone
    // PWA the status-bar (top) and gesture-nav (bottom) safe-area regions, plus
    // any overscroll area, take the page background — the hard-coded dark launch
    // color in index.html otherwise showed through as black bars in light mode.
    // color-scheme also nudges the OS to tint its own chrome to match.
    document.documentElement.style.backgroundColor = surface
    document.body.style.backgroundColor = surface
    document.documentElement.style.colorScheme = prefs.darkMode ? 'dark' : 'light'
    void syncStatusBarTheme(prefs.darkMode)
  }, [prefs.darkMode])

  useVisualViewportVars()

  const [isAiOpen, setIsAiOpen] = useState(false)
  const [isFabOpen, setIsFabOpen] = useState(false)

  useEffect(() => {
    setIsFabOpen(false)
  }, [prefs.activeTab])

  useEffect(() => {
    if (!isFabOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsFabOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [isFabOpen])

  // Redirect from drafts if empty
  useEffect(() => {
    if (prefs.activeTab === 'drafts' && financial.draftTransactions.length === 0) {
      prefs.setActiveTab('ledger')
    }
  }, [prefs.activeTab, financial.draftTransactions, prefs])

  // Depend only on the stable identities (activeTab + the memoized/setter fns),
  // NOT the whole `nav`/`prefs` objects — those are re-created every render, so
  // including them made this effect run on every render. Because
  // `clearIncomingFilters` now resets `ledgerIncomingFilters` to a fresh `[]`
  // (a new reference that never bails out of a re-render), that turned into an
  // infinite setState→render→effect loop (React error #185) whenever the active
  // tab was not the ledger.
  useEffect(() => {
    if (prefs.activeTab !== 'ledger') {
      nav.clearIncomingFilters()
      prefs.setLedgerCyclesRange('monthly')
    }
  }, [prefs.activeTab, nav.clearIncomingFilters, prefs.setLedgerCyclesRange])

  // Drop the subscription highlight (state + `?subscription=` param) whenever we
  // leave the Recurring tab. Without this, navigating away mid-highlight — before
  // the card's fade-out fires onClearHighlight — leaves the id set, so every later
  // visit to Recurring re-scrolls and re-highlights the last-clicked subscription.
  useEffect(() => {
    if (prefs.activeTab !== 'recurring' && nav.highlightedRecurringId) {
      nav.clearHighlightedRecurring()
    }
  }, [prefs.activeTab, nav.highlightedRecurringId, nav.clearHighlightedRecurring])

  useEffect(() => {
    if (nav.selectedMonth && nav.selectedYear) {
      updateAppSearch({ month: nav.selectedMonth, year: nav.selectedYear })
    }
  }, [nav.selectedMonth, nav.selectedYear])

  const [currentCycleDashboardData, setCurrentCycleDashboardData] = useState<DashboardData | null>(null)
  const currentCycleDashboardRef = useRef<DashboardData | null>(null)
  const [isCurrentCycleLoading, setIsCurrentCycleLoading] = useState(false)
  const currentCycleDay = financial.optimisticDashboardData?.setting.cycleDay || 28
  const currentCyclePeriod = getCurrentCycleYearAndMonth(currentCycleDay)
  const currentCycleMonth = MONTH_NAMES[currentCyclePeriod.monthIndex - 1]
  const selectedCycleIsCurrent = financial.optimisticDashboardData?.setting.selectedMonth === currentCycleMonth &&
    financial.optimisticDashboardData?.setting.selectedYear === currentCyclePeriod.year

  useEffect(() => {
    if (!session.token || !financial.optimisticDashboardData) return

    const currentData = financial.optimisticDashboardData
    const cycleDay = currentData.setting.cycleDay || 28
    const { year, monthIndex } = getCurrentCycleYearAndMonth(cycleDay)
    const month = MONTH_NAMES[monthIndex - 1]
    const matchesCurrentPeriod = (data: DashboardData | null) =>
      data?.setting.selectedMonth === month && data.setting.selectedYear === year

    if (matchesCurrentPeriod(currentData)) {
      currentCycleDashboardRef.current = currentData
      setCurrentCycleDashboardData(currentData)
      setIsCurrentCycleLoading(false)
      return
    }

    if (!matchesCurrentPeriod(currentCycleDashboardRef.current)) {
      const cached = getCachedCycleSnapshot(month, year)?.dashboardData || null
      currentCycleDashboardRef.current = matchesCurrentPeriod(cached) ? cached : null
      if (currentCycleDashboardRef.current) setCurrentCycleDashboardData(currentCycleDashboardRef.current)
    }

    setIsCurrentCycleLoading(!currentCycleDashboardRef.current)
    const ac = new AbortController()
    Promise.all([
      api.fetchDashboard(month, year, ac.signal, false),
      api.fetchDashboardInsights(month, year, ac.signal)
    ]).then(([core, insights]) => {
      const merged: DashboardData = {
        ...core,
        setting: {
          ...core.setting,
          selectedMonth: month,
          selectedYear: year,
        },
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
      currentCycleDashboardRef.current = merged
      setCurrentCycleDashboardData(merged)
    }).catch(err => {
      if (getErrorName(err) !== 'AbortError') {
        console.warn('Could not load the current-cycle Today view', err)
      }
    }).finally(() => {
      if (!ac.signal.aborted) setIsCurrentCycleLoading(false)
    })

    return () => ac.abort()
  }, [session.token, financial.optimisticDashboardData])

  const todayDashboardData = selectedCycleIsCurrent
    ? financial.optimisticDashboardData
    : currentCycleDashboardData?.setting.selectedMonth === currentCycleMonth &&
        currentCycleDashboardData.setting.selectedYear === currentCyclePeriod.year
      ? currentCycleDashboardData
      : null
  const currentPendingNotifications = todayDashboardData?.pendingNotifications || []
  const wishlistDashboardData = todayDashboardData || financial.optimisticDashboardData

  // End-of-cycle summary: fires once when a new cycle begins (persisted server-side so it can't
  // re-fire on navigation or on another device), and is re-openable from Reports for any ended
  // cycle. The summary reads live data for the selected cycle, so edits are always reflected.
  const cycleSummary = useCycleSummary({
    token: session.token,
    dashboardData: financial.dashboardData,
    optimisticDashboardData: financial.optimisticDashboardData,
    onMarkSummarySeen: financial.handleMarkSummarySeen,
  })

  const handleToggleHideSensitive = async () => {
    if (prefs.sensitivePreferenceStatus !== 'resolved') return
    if (prefs.hideSensitive) {
      session.setShowPasswordPrompt(true)
    } else {
      prefs.setHideSensitive(true)
      if (session.hasFingerprintSetup) {
        void prefetchFingerprintAssertOptions().catch(() => undefined)
      }
      financial.handleUpdateHideSensitivePreference(true)
    }
  }

  const retrySensitivePreference = () => {
    prefs.beginSensitivePreferenceResolution()
    void financial.loadAll(nav.selectedMonth || undefined, nav.selectedYear || undefined, true)
  }

  const handleToggleBalanceAmounts = () => {
    const nextHidden = !prefs.hideBalanceAmounts
    prefs.setHideBalanceAmounts(nextHidden)
  }

  const handleToggleDarkMode = () => {
    const newDark = !prefs.darkMode
    prefs.setDarkMode(newDark)
    financial.handleUpdateDarkModePreference(newDark)
  }

  const appContextValue = useMemo<AppContextValue>(() => buildAppContextValue({
    hideSensitive: prefs.hideSensitive,
    currency: financial.optimisticDashboardData?.setting?.currency || 'USD',
    darkMode: prefs.darkMode,
    activeSyncId: financial.activeSyncId,
    deletingId: financial.deletingTxId,
    isSyncing: financial.isBackgroundSyncing || financial.pendingOps.length > 0,
    isOffline: financial.isOffline,
    formatSensitive: financial.formatSensitive,
    showToast: dialogs.showToast,
    guardSensitive: guardSensitive,
    confirm: dialogs.setConfirmModalData,
  }), [
    prefs.hideSensitive,
    financial.optimisticDashboardData?.setting?.currency,
    prefs.darkMode,
    financial.activeSyncId,
    financial.deletingTxId,
    financial.isBackgroundSyncing,
    financial.pendingOps.length,
    financial.isOffline,
    financial.formatSensitive,
    dialogs.showToast,
    guardSensitive,
    dialogs.setConfirmModalData,
  ])

  if (!session.isSessionResolved) {
    return (
      <LaunchReady>
        <ViewFallback />
      </LaunchReady>
    )
  }

  if (!session.token) {
    return (
      <Suspense fallback={<ViewFallback />}>
        <LaunchReady>
          <LoginView onLoginSuccess={session.handleLoginSuccess} />
        </LaunchReady>
      </Suspense>
    )
  }

  if (financial.loading && !financial.optimisticDashboardData) {
    return (
      <LaunchReady>
        <div
          data-testid="app-loading-skeleton"
          className="app-shell min-h-screen text-foreground"
          aria-busy="true"
          aria-label="Loading your financial data securely"
        >
          <div className="mx-auto w-full max-w-[1440px] px-4 py-6 space-y-6 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AppLogo className="size-10 rounded-xl" pulse />
                <div>
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="mt-2 h-2 w-20" />
                </div>
              </div>
              <div role="status" aria-live="polite" aria-atomic="true" className="flex items-center gap-2 text-xs font-semibold text-blue-500">
                <Loader2 className="animate-spin size-5" aria-hidden="true" />
                <span className="hidden sm:inline">Loading your financial data securely…</span>
              </div>
            </div>
            <CycleSkeleton variant={getPageSkeletonVariant(prefs.activeTab)} fullPage />
          </div>
        </div>
      </LaunchReady>
    )
  }

  if (session.isLocked && !!session.token) {
    return (
      <LaunchReady>
        <AppProvider value={appContextValue}>
          <div className="app-shell min-h-screen text-foreground flex flex-col selection:bg-blue-500/20 selection:text-blue-500">
            <ToastViewport toasts={dialogs.toasts} onDismiss={dialogs.dismissToast} />
            <LockScreen
              isOpen
              username={session.username}
              onUnlocked={session.handleUnlocked}
              onSignOut={session.handleLogout}
            />
          </div>
        </AppProvider>
      </LaunchReady>
    )
  }

  return (
    <AppProvider value={appContextValue}>
      <div className="app-shell min-h-screen text-foreground flex flex-col selection:bg-blue-500/20 selection:text-blue-500">
        <ToastViewport toasts={dialogs.toasts} onDismiss={dialogs.dismissToast} />

        <TopNav
          activeTab={prefs.activeTab}
          onTabChange={prefs.setActiveTab}
          onQuickAction={nav.handleQuickAction}
          onAskAI={() => setIsAiOpen(true)}
          hideSensitive={prefs.hideSensitive}
          sensitivePreferenceStatus={prefs.sensitivePreferenceStatus}
          onToggleHideSensitive={handleToggleHideSensitive}
          onRetrySensitivePreference={retrySensitivePreference}
          onLogout={session.handleLogout}
          username={session.username}
          pendingNotifications={currentPendingNotifications}
          onOpenNotifications={() => dialogs.setShowLoginModal(true)}
          darkMode={prefs.darkMode}
          onToggleDarkMode={handleToggleDarkMode}
          isSyncing={financial.isBackgroundSyncing || financial.pendingOps.length > 0}
          isOffline={financial.isOffline}
          syncLabel={
            financial.syncCountdownMs > 0
              ? `Retrying ${Math.ceil(financial.syncCountdownMs / 1000)}s`
              : financial.activeSyncId
                ? 'Syncing...'
                : financial.pendingOps.length > 0
                  ? `${financial.pendingOps.length} queued`
                  : financial.isBackgroundSyncing
                    ? 'Refreshing'
                    : undefined
          }
          failedOpsCount={financial.failedOps.length}
          onOpenFailedOps={() => dialogs.setShowFailedOpsModal(true)}
          draftCount={financial.draftTransactions.length}
        />

        <AiAssistantPanel
          isOpen={isAiOpen}
          onClose={() => setIsAiOpen(false)}
          onActions={aiRouter.handleAiActions}
          sensitiveMode={prefs.hideSensitive}
          isOffline={financial.isOffline}
        />

        {financial.error && (
          <div className="bg-destructive/15 border-b border-destructive/30 text-destructive px-4 py-2 text-xs flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-destructive animate-pulse select-none" />
            <span className="select-none">{financial.error}</span>
            <button
              type="button"
              onClick={() => financial.loadAll(nav.selectedMonth || undefined, nav.selectedYear || undefined, true)}
              disabled={financial.isBackgroundSyncing}
              className="ml-1 font-bold underline underline-offset-2 hover:text-destructive/80 disabled:opacity-60 disabled:cursor-default cursor-pointer"
            >
              {financial.isBackgroundSyncing ? 'Retrying…' : 'Retry'}
            </button>
          </div>
        )}

        <PullToRefresh
          onRefresh={() => financial.loadAll(nav.selectedMonth || undefined, nav.selectedYear || undefined, true)}
          disabled={financial.loading || session.isLocked}
        >
          <main
            className="relative mx-auto w-full min-w-0 max-w-[1440px] flex-1 px-4 py-6 pb-24 sm:px-6 sm:py-8 md:pb-8 lg:px-8"
            aria-busy={prefs.sensitivePreferenceStatus === 'pending' || financial.loading}
          >
            <ErrorBoundary variant="inline" resetKey={prefs.activeTab}>
              <Suspense fallback={<ContentViewFallback tab={prefs.activeTab} />}>
                <LaunchReady>
                  <motion.div
                    key={prefs.activeTab}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30, mass: 1 }}
                    className="w-full gpu-layer"
                  >
                    {prefs.activeTab === 'dashboard' && (
                      <DashboardView
                        dashboardData={todayDashboardData}
                        onNavigate={prefs.setActiveTab}
                        hideBalanceAmounts={prefs.hideBalanceAmounts}
                        walletBalance={financial.totalBalance}
                        onToggleBalanceAmounts={handleToggleBalanceAmounts}
                        pendingNotificationCount={currentPendingNotifications.length}
                        onOpenNotifications={() => dialogs.setShowLoginModal(true)}
                        onNavigateToLedger={options => nav.handleNavigateToLedger({
                          ...options,
                          targetMonth: currentCycleMonth,
                          targetYear: currentCyclePeriod.year,
                        })}
                        wishlist={financial.allWishlist}
                        isSwitchingCycle={isCurrentCycleLoading || !todayDashboardData}
                      />
                    )}

                    {prefs.activeTab === 'reports' && (
                      <ReportsView
                        dashboardData={financial.optimisticDashboardData}
                        transactions={financial.allTransactions}
                        wishlist={financial.allWishlist}
                        hideBalanceAmounts={prefs.hideBalanceAmounts}
                        onSelectPeriod={nav.handleSelectPeriod}
                        onNavigate={prefs.setActiveTab}
                        onNavigateToRecurring={nav.handleNavigateToRecurring}
                        onNavigateToLedger={nav.handleNavigateToLedger}
                        onAddBalanceAdjustment={financial.handleAddBalanceAdjustment}
                        isSwitchingCycle={nav.isSwitchingCycle}
                        onViewCycleSummary={cycleSummary.openManual}
                      />
                    )}

                    {prefs.activeTab === 'settings' && (
                      <SettingsView 
                        dashboardData={financial.optimisticDashboardData}
                        categoriesList={financial.allCategories}
                        onToggleDarkMode={handleToggleDarkMode}
                        onToggleHideSensitive={handleToggleHideSensitive}
                        sensitivePreferenceStatus={prefs.sensitivePreferenceStatus}
                        onUpdateSettings={financial.handleUpdateSettings}
                        onAddCategory={financial.handleAddCategory}
                        onUpdateCategoryCycleLimit={financial.handleUpdateCategoryCycleLimit}
                        onDeleteCategory={financial.requestDeleteCategory}
                        onApplyCategoryCleanupSuggestion={financial.handleApplyCategoryCleanupSuggestion}
                        notifyOnLoginEnabled={prefs.notifyOnLogin}
                        onToggleNotifyOnLogin={(checked) => {
                          prefs.setNotifyOnLogin(checked)
                          dialogs.showToast('Notification preference updated.', 'Settings Saved', 'success')
                        }}
                        pushEnabled={push.enabled}
                        pushSupported={push.supported}
                        pushBusy={push.busy || push.loading}
                        pushGuidance={push.guidance}
                        onTogglePushEnabled={(checked) => {
                          if (checked) void push.enable()
                          else void push.disable()
                        }}
                        onNavigateToLedger={nav.handleNavigateToLedger}
                        onClearLocalFinancialData={() => {
                          const month = nav.selectedMonth
                          const year = nav.selectedYear
                          void (async () => {
                            try {
                              await financial.handleLogoutCleanup(session.username, false)
                            } finally {
                              clearLocalFinancialData()
                            }
                            await financial.loadAll(month, year, true)
                            dialogs.showToast(
                              'Cached financial data and offline drafts were removed from this device.',
                              'Local Data Cleared',
                              'success',
                            )
                          })()
                        }}
                      />
                    )}

                    {prefs.activeTab === 'recurring' && (
                      <RecurringPaymentsView 
                        payments={financial.allRecurringPayments}
                        activeRecurringPayments={financial.optimisticDashboardData?.activeRecurringPayments || []}
                        transactions={financial.allTransactions}
                        selectedMonth={nav.selectedMonth}
                        selectedYear={nav.selectedYear}
                        cycleDay={financial.optimisticDashboardData?.setting?.cycleDay || 28}
                        onAddPayment={financial.handleAddPayment}
                        onToggleActive={financial.handleToggleActive}
                        onDeletePayment={financial.requestDeletePayment}
                        onUpdatePayment={financial.handleUpdatePayment}
                        categories={financial.allCategories}
                        autoOpenAddForm={nav.autoOpenSubscriptionAdd}
                        onResetAutoOpen={() => nav.setAutoOpenSubscriptionAdd(false)}
                        isSwitchingCycle={nav.isSwitchingCycle}
                        highlightedRecurringId={nav.highlightedRecurringId}
                        onClearHighlightedRecurring={nav.clearHighlightedRecurring}
                        globalPushEnabled={push.accountEnabled}
                        onUpdateReminder={financial.handleUpdateReminder}
                        onRequestPayEarly={financial.requestPayEarly}
                        aiDraft={aiRouter.state.aiRecurringDraft}
                        aiEditDraft={aiRouter.state.aiRecurringEditDraft}
                        onAiDraftConsumed={() => aiRouter.dispatch({ type: 'CONSUME_RECURRING_DRAFT' })}
                        onAiEditDraftConsumed={() => aiRouter.dispatch({ type: 'CONSUME_RECURRING_EDIT_DRAFT' })}
                      />
                    )}

                    {prefs.activeTab === 'ledger' && (
                      <LedgerView 
                        transactions={financial.allTransactions}
                        autocompleteSuggestions={financial.autocompleteSuggestions}
                        onAddTransaction={(tx) => financial.handleAddTransaction(tx, prefs.setActiveTab)}
                        onDeleteTransaction={financial.handleDeleteTransaction}
                        onUpdateTransaction={financial.handleUpdateTransaction}
                        categories={financial.allCategories}
                        selectedMonth={nav.selectedMonth}
                        selectedYear={nav.selectedYear}
                        availableYears={financial.optimisticDashboardData?.availableYears || [nav.selectedYear || new Date().getFullYear()]}
                        cycleDay={financial.optimisticDashboardData?.setting?.cycleDay || 28}
                        onSelectPeriod={nav.handleSelectPeriod}
                        incomingCategory={nav.ledgerIncomingFilters[0] || null}
                        incomingFilters={nav.ledgerIncomingFilters}
                        incomingSearch={nav.ledgerIncomingSearch}
                        incomingStartDate={nav.ledgerIncomingStartDate}
                        incomingEndDate={nav.ledgerIncomingEndDate}
                        incomingMinAmount={nav.ledgerIncomingMinAmount}
                        incomingMaxAmount={nav.ledgerIncomingMaxAmount}
                        incomingRecurringOnly={nav.ledgerIncomingRecurringOnly}
                        incomingWishlistOnly={nav.ledgerIncomingWishlistOnly}
                        incomingTxType={nav.ledgerIncomingTxType}
                        highlightedTxId={nav.highlightedTxId}
                        onClearIncomingFilters={nav.clearIncomingFilters}
                        showAllCycles={nav.ledgerShowAllCycles}
                        onClearAllCycles={() => { nav.setLedgerShowAllCycles(false) }}
                        cyclesRange={prefs.ledgerCyclesRange}
                        autoOpenAddForm={nav.autoOpenLedgerAdd}
                        onResetAutoOpen={() => nav.setAutoOpenLedgerAdd(false)}
                        stabilityBalance={financial.optimisticDashboardData?.categories?.find(c => c.name === 'Stability')?.remaining ?? 0}
                        isSwitchingCycle={nav.isSwitchingCycle}
                        stabilityTarget={financial.optimisticDashboardData?.setting?.targetStabilityFund ?? 10000}
                        essentialsAlloc={financial.optimisticDashboardData?.setting?.essentialsAlloc ?? 0.5}
                        growthAlloc={financial.optimisticDashboardData?.setting?.growthAlloc ?? 0.25}
                        stabilityAlloc={financial.optimisticDashboardData?.setting?.stabilityAlloc ?? 0.15}
                        rewardsAlloc={financial.optimisticDashboardData?.setting?.rewardsAlloc ?? 0.1}
                        stabilityOverflowRedirect={financial.optimisticDashboardData?.setting?.stabilityOverflowRedirect}
                        onFetchPagedTransactions={api.fetchPagedTransactions}
                        onFetchTransactionById={api.fetchTransactionById}
                        onExportTransactions={api.exportTransactionsCsv}
                        onShowAlert={alert}
                        onStartEditPending={financial.setEditingPendingId}
                        receiptScanDraft={activeReceiptScanDraft}
                        onReceiptScanStarted={handleReceiptScanStarted}
                        onReceiptScanCleared={clearReceiptScanJob}
                        onAddFormOpenChange={setIsLedgerAddOpen}
                        activeScanJobIds={receiptScanJobIds}
                        failedScanJob={failedScanJob}
                        aiEditDraft={aiRouter.state.aiLedgerEditDraft}
                        aiExportRequest={aiRouter.state.aiLedgerExportRequest}
                        onAiEditDraftConsumed={() => aiRouter.dispatch({ type: 'CONSUME_LEDGER_EDIT_DRAFT' })}
                        onAiExportRequestConsumed={() => aiRouter.dispatch({ type: 'CONSUME_EXPORT_REQUEST' })}
                      />
                    )}

                    {prefs.activeTab === 'wishlist' && (
                      <WishlistView 
                        wishlist={financial.allWishlist}
                        transactions={financial.allTransactions}
                        rewardsBalance={wishlistDashboardData?.categories?.find(c => c.name === 'Rewards')?.remaining ?? 0}
                        rewardsTarget={wishlistDashboardData?.categories?.find(c => c.name === 'Rewards')?.target ?? 400}
                        pastThreeMonthsRewardsAverage={wishlistDashboardData?.stats?.pastThreeMonthsRewardsAverage ?? 0}
                        hasRewardsHistory={wishlistDashboardData?.stats?.hasRewardsHistory ?? false}
                        onAddItem={financial.handleAddWishlistItem}
                        onUpdateItem={financial.handleUpdateWishlistItem}
                        onDeleteItem={financial.requestDeleteWishlistItem}
                        onPurchaseItem={financial.handlePurchaseWishlistItem}
                        autoOpenAddModal={nav.autoOpenWishlistAdd}
                        onResetAutoOpen={() => nav.setAutoOpenWishlistAdd(false)}
                        onNavigateToLedger={nav.handleNavigateToLedger}
                        cycleDay={financial.optimisticDashboardData?.setting?.cycleDay || 28}
                        onFetchClaimedWishlist={api.fetchClaimedWishlistPage}
                        isSwitchingCycle={nav.isSwitchingCycle}
                        onStartEditPending={financial.setEditingPendingId}
                        aiDraft={aiRouter.state.aiWishlistDraft}
                        aiEditDraft={aiRouter.state.aiWishlistEditDraft}
                        onAiDraftConsumed={() => aiRouter.dispatch({ type: 'CONSUME_WISHLIST_DRAFT' })}
                        onAiEditDraftConsumed={() => aiRouter.dispatch({ type: 'CONSUME_WISHLIST_EDIT_DRAFT' })}
                      />
                    )}

                    {prefs.activeTab === 'drafts' && financial.draftTransactions.length > 0 && (
                      <DraftStagingView 
                        draftTransactions={financial.draftTransactions}
                        categories={financial.allCategories}
                        onUpdateDraftTransaction={financial.handleUpdateDraftTransaction}
                        onDeleteDraftTransaction={financial.requestDeleteDraftTransaction}
                        hideSensitive={prefs.hideSensitive}
                        currency={financial.optimisticDashboardData?.setting?.currency || 'USD'}
                        onCancel={() => prefs.setActiveTab('ledger')}
                        onAddAnother={() => {
                          prefs.setActiveTab('ledger')
                          nav.setAutoOpenLedgerAdd(true)
                        }}
                      />
                    )}

                    {prefs.activeTab === 'investments' && (
                      <InvestmentsView onNavigate={prefs.setActiveTab} />
                    )}
                  </motion.div>
                </LaunchReady>
              </Suspense>
            </ErrorBoundary>
          </main>
        </PullToRefresh>

        <PendingSubscriptionsModal
          isOpen={dialogs.showLoginModal}
          pendingNotifications={currentPendingNotifications}
          currency={todayDashboardData?.setting.currency || financial.optimisticDashboardData?.setting?.currency || 'USD'}
          hideSensitive={prefs.hideSensitive}
          showOnLoginChecked={prefs.notifyOnLogin}
          onToggleShowOnLogin={(checked) => {
            prefs.setNotifyOnLogin(checked)
          }}
          onClose={() => dialogs.setShowLoginModal(false)}
          onConfirmSubscription={financial.handleConfirmSubscription}
          onDiscardSubscription={financial.handleDiscardSubscription}
          onRemoveSubscription={(recurringPaymentId) => dialogs.setConfirmModalData({
            title: 'Remove Subscription',
            message: 'Are you sure you want to delete this recurring subscription? This will cancel all future notifications for this subscription.',
            confirmText: 'Remove',
            onConfirm: () => financial.handleDeletePayment(recurringPaymentId)
          })}
        />

        {cycleSummary.target && (
          <CycleSummaryModal
            isOpen={cycleSummary.isOpen}
            onClose={cycleSummary.onClose}
            data={cycleSummary.data}
            previousData={cycleSummary.previousData}
            isLoading={cycleSummary.isLoading}
            loadError={cycleSummary.loadError}
            wishlist={financial.allWishlist}
            transactions={financial.allTransactions}
            monthIndex={cycleSummary.target.monthIndex}
            year={cycleSummary.target.year}
            cycleDay={cycleSummary.cycleDay}
            variant={cycleSummary.variant}
            onViewLedger={() => {
              const month = MONTH_NAMES[cycleSummary.target!.monthIndex - 1]
              const year = cycleSummary.target!.year
              cycleSummary.onClose()
              void nav.handleSelectPeriod(month, year)
              prefs.setActiveTab('ledger')
            }}
          />
        )}

        <FailedSyncModal
          isOpen={dialogs.showFailedOpsModal}
          failedOps={financial.failedOps}
          onClose={() => dialogs.setShowFailedOpsModal(false)}
          onDiscard={financial.discardFailedOp}
          onDiscardAll={financial.discardAllFailedOps}
        />

        <PasswordPromptModal
          isOpen={session.showPasswordPrompt}
          onClose={() => session.setShowPasswordPrompt(false)}
          onVerified={() => {
            prefs.setHideSensitive(false)
            session.setShowPasswordPrompt(false)
            financial.handleUpdateHideSensitivePreference(false)
          }}
          onTryFingerprint={session.hasFingerprintSetup ? session.revealSensitiveWithFingerprint : undefined}
        />

        <LockScreen
          isOpen={session.isLocked && !!session.token}
          username={session.username}
          onUnlocked={session.handleUnlocked}
          onSignOut={session.handleLogout}
        />

        <footer className="border-t border-border/40 py-6 pb-24 md:pb-6 bg-background/45 backdrop-blur select-none">
          <div className="mx-auto w-full max-w-[1440px] px-4 text-center text-xs text-muted-foreground sm:px-6 lg:px-8">
            &copy; {new Date().getFullYear()} FinancialApp. All rights reserved.
          </div>
        </footer>

        <CustomAlertModal
          isOpen={!!dialogs.customAlert}
          title={dialogs.customAlert?.title || 'Notification'}
          message={dialogs.customAlert?.message || ''}
          onClose={() => dialogs.setCustomAlert(null)}
        />

        <CustomConfirmModal
          isOpen={!!dialogs.confirmModalData}
          title={dialogs.confirmModalData?.title || 'Confirmation'}
          message={dialogs.confirmModalData?.message || ''}
          confirmText={dialogs.confirmModalData?.confirmText || 'Confirm'}
          cancelText="Cancel"
          variant={dialogs.confirmModalData?.variant || 'danger'}
          confirmDisabled={dialogs.confirmModalData?.confirmDisabled || false}
          onConfirm={() => {
            if (dialogs.confirmModalData) {
              dialogs.confirmModalData.onConfirm()
              dialogs.setConfirmModalData(null)
            }
          }}
          onCancel={() => dialogs.setConfirmModalData(null)}
        />

        {session.token && (
          <>
            <AnimatePresence>
              {isFabOpen && prefs.activeTab !== 'drafts' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="md:hidden fixed inset-0 z-30 bg-background/45 backdrop-blur-sm cursor-pointer"
                  onClick={() => setIsFabOpen(false)}
                  aria-hidden="true"
                />
              )}
            </AnimatePresence>

            <AnimatePresence>
              {isFabOpen && prefs.activeTab !== 'drafts' && (
                <motion.div
                  variants={fabMenuVariants}
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                  className="md:hidden fixed right-8 z-40 flex flex-col gap-3.5 items-end pointer-events-auto"
                  style={{ bottom: 'calc(148px + env(safe-area-inset-bottom, 0px))' }}
                >
                  {([
                    { key: 'wishlist' as const, label: 'Add Wish Goal', Icon: PiggyBank, color: 'bg-pink-500' },
                    { key: 'subscription' as const, label: 'New Subscription', Icon: CreditCard, color: 'bg-violet-500' },
                    { key: 'transaction' as const, label: 'Post Transaction', Icon: Wallet, color: 'bg-emerald-500' },
                    { key: 'ai' as const, label: 'Ask AI', Icon: Sparkles, color: 'bg-indigo-500' },
                  ]).map(({ key, label, Icon, color }) => (
                    <motion.button
                      key={key}
                      type="button"
                      variants={fabActionVariants}
                      whileTap={{ scale: 0.92 }}
                      onClick={() => {
                        if (key === 'ai') {
                          setIsAiOpen(true)
                        } else {
                          nav.handleQuickAction(key)
                        }
                        setIsFabOpen(false)
                      }}
                      className="flex items-center gap-2.5 group cursor-pointer"
                    >
                      <span className="bg-card border border-border px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-foreground shadow-xs">{label}</span>
                      <span className={`size-11 rounded-full ${color} text-white flex items-center justify-center shadow-lg`}><Icon className="size-5" /></span>
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() => {
                if (prefs.activeTab === 'drafts') {
                  financial.handleSyncDraftBatch()
                } else {
                  setIsFabOpen(prev => !prev)
                }
              }}
              className={`fixed right-6 flex items-center justify-center size-14 rounded-full text-white shadow-xl cursor-pointer ${
                prefs.activeTab === 'drafts'
                  ? 'bg-gradient-to-tr from-emerald-600 to-green-500 shadow-emerald-500/20 z-40'
                  : 'bg-gradient-to-tr from-blue-600 to-sky-500 shadow-blue-500/10 z-40 md:hidden'
              }`}
              style={{
                bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))'
              }}
              title={prefs.activeTab === 'drafts' ? 'Sync Batch to Server' : isFabOpen ? 'Close Menu' : 'Open Menu'}
              aria-label={prefs.activeTab === 'drafts' ? 'Sync Batch to Server' : isFabOpen ? 'Close Menu' : 'Open Menu'}
              aria-expanded={prefs.activeTab === 'drafts' ? undefined : isFabOpen}
            >
              {prefs.activeTab === 'drafts' ? (
                <Upload className="size-6" />
              ) : isFabOpen ? (
                <X className="size-6" />
              ) : (
                <Zap className="size-6" />
              )}
            </motion.button>
          </>
        )}
      </div>
    </AppProvider>
  )
}

export default App
