import { Button } from './components/ui/Button'
import { useState, useMemo, useEffect, useRef, useCallback, lazy, Suspense, type RefObject } from 'react'
import TopNav from "./TopNav.tsx"
import { type AppTab, type InvestmentAllocationOverview } from './types'
import * as api from './lib/api'
import { Loader2, X, Zap } from 'lucide-react'

// Every view is code-split so the initial bundle only ships the shell. Each
// chunk loads on demand behind an instant blank-shell fallback (no flash).
const LoginView = lazy(() => import('./components/LoginView').then(m => ({ default: m.LoginView })))
const AccountCoverageGate = lazy(() => import('./components/AccountCoverageGate').then(m => ({ default: m.AccountCoverageGate })))
import { ToastViewport } from './components/ui/ToastViewport'
import { Skeleton } from './components/ui/Skeleton'
import type { PageSkeletonVariant } from './components/ui/CycleSkeleton'
import { useVisualViewportVars } from './lib/useVisualViewportVars'
import { useNativeAppLifecycle } from './lib/useNativeAppLifecycle'
const LockScreen = lazy(() => import('./components/LockScreen').then(m => ({ default: m.LockScreen })))
const PwaLaunchGate = lazy(() => import('./app/PwaLaunchGate').then(m => ({ default: m.PwaLaunchGate })))
const AiAssistantPanel = lazy(() => import('./components/AiAssistantPanel').then(m => ({ default: m.AiAssistantPanel })))
const CycleSkeleton = lazy(() => import('./components/ui/CycleSkeleton').then(m => ({ default: m.CycleSkeleton })))
import { AppLogo } from './components/ui/AppLogo'
import { syncStatusBarTheme } from './lib/nativeUi'
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
import type { UsePushNotificationsResult } from './app/usePushNotifications'
import type { ScanPollingResults } from './app/RuntimeBackgroundBridges'
import { useAiEntryPoint } from './app/useAiEntryPoint'
import { shouldShowMobileFab, useFabMenu } from './app/useFabMenu'
import { useCurrentCycleDashboard } from './app/useCurrentCycleDashboard'
import { AuthenticatedView } from './app/AuthenticatedView'
import { LaunchReady } from './app/LaunchReady'
import { hideNativeSplashAfterPaint } from './app/launchHandoff'
import { buildAppContextValue } from './app/buildAppContextValue'
import { prefetchFingerprintAssertOptions } from './lib/fingerprintOptionsCache'
import { readAppLocation, updateAppSearch } from './lib/appLocation'
import { mutationBusyLabel } from './components/ui/rowSyncState'
import type { AiInvocationContext } from './lib/api/ai'
import { calculateFreeRewardsBalance, pendingRecurringAmount, pendingRewardsAmount } from './lib/freeRewards'
import { canOpenBlankMutationForm } from './lib/quickAddAvailability'
import { hasCompleteAccountCoverage } from './lib/ledgerAccountCoverage'

const RuntimeBackgroundBridges = lazy(() => import('./app/RuntimeBackgroundBridges').then(module => ({ default: module.RuntimeBackgroundBridges })))
const enableRuntimeBackgroundBridges = import.meta.env.MODE !== 'test'

const EMPTY_PUSH: UsePushNotificationsResult = {
  supported: true,
  loading: true,
  busy: false,
  busyAction: null,
  billRemindersEnabled: false,
  categoryAlertsEnabled: false,
  otherDevicesBillReminders: false,
  otherDevicesCategoryAlerts: false,
  enrolmentRevision: 0,
  guidance: null,
  setChannelEnabled: async () => false,
  refresh: async () => null,
}

const EMPTY_SCANS: ScanPollingResults = {
  receiptScan: { activeReceiptScanDraft: null, failedScanJob: null, receiptScanJobIds: [], handleReceiptScanStarted: () => undefined, clearReceiptScanJob: async () => undefined },
  receiptSplit: { activeReceiptSplitDraft: null, failedReceiptSplitJob: null, receiptSplitJobIds: [], handleReceiptSplitStarted: () => undefined, clearReceiptSplitJob: async () => undefined },
  investmentScan: { activeInvestmentScanDraft: null, failedInvestmentScanJob: null, investmentScanJobIds: [], handleInvestmentScanStarted: () => undefined, clearInvestmentScanJob: async () => undefined },
}

// Instant, flash-free placeholder while a lazily-loaded chunk is fetched at the root level.
const ViewFallback = () => <div className="app-shell min-h-screen" />
const CycleSkeletonFallback = () => (
  <div className="space-y-6" aria-hidden="true">
    <Skeleton className="h-40 w-full rounded-2xl" />
    <Skeleton className="h-64 w-full rounded-2xl" />
  </div>
)
const AppOverlays = lazy(() => import('./app/AppOverlays').then(module => ({ default: module.AppOverlays })))

const AppOverlaysFallback = ({
  isOpen,
  visible,
  onAskAi,
  onPostTransaction,
  postTransactionDisabled,
}: {
  isOpen: boolean
  visible: boolean
  onAskAi: () => void
  onPostTransaction: () => void
  postTransactionDisabled: boolean
}) => (
  <>
    {visible && isOpen && (
      <div role="menu" aria-label="Quick actions">
        <Button
          variant="secondary"
          type="button"
          role="menuitem"
          onClick={onPostTransaction}
          disabled={postTransactionDisabled}
          title={postTransactionDisabled ? 'Reveal sensitive data to make financial changes' : 'Post Transaction'}
          className="fixed right-8 z-40 flex items-center gap-2.5 cursor-pointer"
          style={{ bottom: 'calc(216px + env(safe-area-inset-bottom, 0px))' }}
        >
          <span>Post Transaction</span>
        </Button>
        <Button
          variant="secondary"
          type="button"
          role="menuitem"
          onClick={onAskAi}
          className="fixed right-8 z-40 flex items-center gap-2.5 cursor-pointer"
          style={{ bottom: 'calc(164px + env(safe-area-inset-bottom, 0px))' }}
        >
          <span>Ask AI</span>
        </Button>
      </div>
    )}
  </>
)

const MobileFabTrigger = ({
  isOpen,
  visible,
  onToggle,
  triggerRef,
}: {
  isOpen: boolean
  visible: boolean
  onToggle: () => void
  triggerRef: RefObject<HTMLButtonElement | null>
}) => visible ? (
  <Button
    ref={triggerRef}
    variant="unstyled"
    type="button"
    aria-label={isOpen ? 'Close Menu' : 'Open Menu'}
    title={isOpen ? 'Close Menu' : 'Open Menu'}
    onClick={onToggle}
    className="fixed right-6 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/25 cursor-pointer md:hidden"
    style={{ bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))' }}
    aria-expanded={isOpen}
    aria-controls="mobile-fab-actions"
  >
    {isOpen ? <X className="size-6" /> : <Zap className="size-6" />}
  </Button>
) : null

const AppFooter = () => (
  <footer className="border-t border-border/40 py-6 pb-24 md:pb-6 bg-background/45 backdrop-blur select-none">
    <div className="mx-auto w-full max-w-[1440px] px-4 text-center text-xs text-muted-foreground sm:px-6 lg:px-8">
      &copy; {new Date().getFullYear()} FinancialApp. All rights reserved.
    </div>
  </footer>
)

// Skeleton placeholder for tab navigation to prevent empty squares in the main content area.
const getPageSkeletonVariant = (tab: AppTab): PageSkeletonVariant => tab

function App() {
  const loadAllAbortRef = useRef<AbortController | null>(null)

  useNativeAppLifecycle(hideNativeSplashAfterPaint)

  // 1. Preferences
  const prefs = useAppPreferences()

  // 2. Dialogs
  const dialogs = useAppDialogs()

  const [hasShownModalThisSession, setHasShownModalThisSession] = useState(false)

  const guardSensitive = useCallback(() => {
    if (prefs.sensitivePreferenceStatus === 'pending') {
      dialogs.showToast('Finishing security check before making changes.', 'Security check pending', 'warning')
      return false
    }
    if (!prefs.hideSensitive) return true
    dialogs.showToast('Unhide balances to make changes.', 'Sensitive mode active', 'warning')
    return false
  }, [dialogs.showToast, prefs.hideSensitive, prefs.sensitivePreferenceStatus])

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

  const openSensitivePrompt = useCallback(() => session.setShowPasswordPrompt(true), [session.setShowPasswordPrompt])

  const [push, setPush] = useState<UsePushNotificationsResult>(EMPTY_PUSH)

  // 4. Cycle Navigation
  const persistSelectedPeriodRef = useRef<(month: string, year: number) => void | Promise<void>>(api.selectPeriod)
  const nav = useCycleNavigation({
    loadAll: (m, y, b, shouldCommit) => financial.loadAll(m, y, b, false, shouldCommit),
    handleLogout: session.handleLogout,
    markSessionLocked: session.markSessionLocked,
    setDashboardData: (d) => financial.setDashboardData(d),
    setTransactions: (t) => financial.setTransactions(t),
    setActiveTab: prefs.setActiveTab,
    setLedgerCyclesRange: prefs.setLedgerCyclesRange,
    showAlert: dialogs.showAlert,
    persistPeriod: (month, year) => persistSelectedPeriodRef.current(month, year),
  })

  // 5. Financial Data
  const financial = useFinancialData({
    token: session.token,
    username: session.username,
    lastUnlockedTimeRef: session.lastUnlockedTimeRef,
    isLocked: session.isLocked,
    markSessionLocked: session.markSessionLocked,
    handleLogout: session.handleLogout,
    hideSensitive: prefs.hideSensitive,
    darkMode: prefs.darkMode,
    showToast: dialogs.showToast,
    guardSensitive,
    setConfirmModalData: dialogs.setConfirmModalData,
    onRequestSensitiveReveal: openSensitivePrompt,
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
  useEffect(() => {
    persistSelectedPeriodRef.current = (month, year) => {
      financial.mutateQueue(previous => financial.enqueue(previous, 'settings', 'update', 'selectedPeriod', {
        selectedMonth: month,
        selectedYear: year,
      }))
    }
  }, [financial])

  const [investmentAllocation, setInvestmentAllocation] = useState<InvestmentAllocationOverview | null>(null)
  const [isLedgerAddOpen, setIsLedgerAddOpen] = useState(false)
  const isLedgerAddOpenRef = useRef(isLedgerAddOpen)
  useEffect(() => {
    isLedgerAddOpenRef.current = isLedgerAddOpen
  }, [isLedgerAddOpen])
  const [isReceiptSplitOpen, setIsReceiptSplitOpen] = useState(false)
  const isReceiptSplitOpenRef = useRef(isReceiptSplitOpen)
  useEffect(() => {
    isReceiptSplitOpenRef.current = isReceiptSplitOpen
  }, [isReceiptSplitOpen])
  const [isInvestmentAddOpen, setIsInvestmentAddOpen] = useState(false)
  const isInvestmentAddOpenRef = useRef(isInvestmentAddOpen)
  const [autoOpenInvestmentAdd, setAutoOpenInvestmentAdd] = useState(false)
  useEffect(() => {
    isInvestmentAddOpenRef.current = isInvestmentAddOpen
  }, [isInvestmentAddOpen])

  const activeTabRef = useRef(prefs.activeTab)

  // 6. Receipt scanning
  const [scans, setScans] = useState<ScanPollingResults>(EMPTY_SCANS)
  const { receiptScan, receiptSplit, investmentScan } = scans
  // 7. AI action router
  const rewardsBalanceRef = useRef(0)
  const aiRouter = useAiActionRouter({
    hideSensitive: prefs.hideSensitive,
    showToast: dialogs.showToast,
    handleSelectPeriod: nav.handleSelectPeriod,
    handleNavigateToLedger: nav.handleNavigateToLedger,
    setConfirmModalData: dialogs.setConfirmModalData,
    allTransactions: financial.allTransactions,
    handleDeleteTransaction: financial.handleDeleteTransaction,
    allRecurringPayments: financial.allRecurringPayments,
    allWishlist: financial.allWishlist,
    // Read through a ref: the current-cycle dashboard this is derived from is resolved further
    // down the component, and a claim must be checked against the balance at dispatch time.
    getRewardsBalance: () => rewardsBalanceRef.current,
    handleToggleActive: financial.handleToggleActive,
    handleUpdateReminder: financial.handleUpdateReminder,
    optimisticDashboardData: financial.optimisticDashboardData,
    handleDiscardSubscription: financial.handleDiscardSubscription,
    handleConfirmSubscription: financial.handleConfirmSubscription,
    handlePurchaseWishlistItem: financial.handlePurchaseWishlistItem,
    handleUnpurchaseWishlistItem: financial.handleUnpurchaseWishlistItem,
    requestDeletePayment: financial.requestDeletePayment,
    requestDeleteWishlistItem: financial.requestDeleteWishlistItem,
    allCategories: financial.allCategories,
    allLedgerAccounts: financial.allAccounts,
    handleStageDraftTransactions: financial.handleStageDraftTransactions,
  })

  // Shadow global alert
  const alert = (message: string) => dialogs.showAlert(message, 'Notification')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', prefs.darkMode)
    const surface = prefs.darkMode ? '#0b0e14' : '#fcfcfc'
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
  const aiEntryPoint = useAiEntryPoint()
  const launchAiExplanation = useCallback((context: AiInvocationContext, prompt: string) => {
    aiEntryPoint.launch(context, prompt)
    setIsAiOpen(true)
  }, [aiEntryPoint.launch])
  const fabMenu = useFabMenu(prefs.activeTab)
  const fabTriggerRef = useRef<HTMLButtonElement>(null)

  // Apply the destination the AI action router settled on. Keyed on the intent's nonce, so this
  // fires once per assistant turn even when the turn ends on the tab the user is already looking
  // at — the previous inline `setActiveTab` calls could be swallowed in that case, which is why a
  // repeated "add a transaction" stopped opening the Drafts view after the first one. The
  // record ids feed the views' existing scroll-to-and-highlight behaviour.
  const aiNavigation = aiRouter.state.aiNavigation
  useEffect(() => {
    if (!aiNavigation) return
    if (aiNavigation.tab === 'recurring' && aiNavigation.recurringId) {
      nav.handleNavigateToRecurring(aiNavigation.recurringId)
    } else if (aiNavigation.tab === 'ledger' && aiNavigation.ledgerTxId) {
      nav.setHighlightedTxId(aiNavigation.ledgerTxId)
      prefs.setActiveTab('ledger')
    } else if (aiNavigation.tab === 'reports' && aiNavigation.cycleKey) {
      prefs.setActiveTab('reports')
    } else {
      prefs.setActiveTab(aiNavigation.tab)
    }
    aiRouter.dispatch({ aiNavigation: null })
  }, [aiNavigation?.nonce])

  // Redirect from drafts if empty. `prefs` itself is deliberately not a dependency — it is a new
  // object every render, which made this run after every commit.
  useEffect(() => {
    if (prefs.activeTab === 'drafts' && financial.draftTransactions.length === 0) {
      prefs.setActiveTab('ledger')
    }
  }, [prefs.activeTab, financial.draftTransactions, prefs.setActiveTab])

  // Tab exit cleanup: drop modal-opening intents and deep-link highlights only when leaving the tab.
  useEffect(() => {
    const prevTab = activeTabRef.current
    if (prevTab !== prefs.activeTab) {
      if (prevTab === 'ledger') {
        nav.setAutoOpenLedgerAdd(false)
        nav.setAutoOpenLedgerTxType(null)
        nav.setAutoOpenLedgerPrefill(null)
        nav.setAutoOpenReceiptSplit(false)
        if (nav.highlightedTxId) nav.clearHighlightedTx()
      }
      if (prevTab === 'recurring') {
        nav.setAutoOpenSubscriptionAdd(false)
        if (nav.highlightedRecurringId) nav.clearHighlightedRecurring()
        if (nav.highlightedLoanId) nav.clearHighlightedLoan()
      }
      if (prevTab === 'wishlist') {
        nav.setAutoOpenWishlistAdd(false)
      }
      if (prevTab === 'reports') {
        if (nav.highlightedReportSection || nav.highlightedReportCategory) nav.clearHighlightedReportSection()
      }
      if (prevTab === 'settings') {
        if (nav.highlightedAccountId) nav.clearHighlightedAccount()
      }
      activeTabRef.current = prefs.activeTab
    }
  }, [
    prefs.activeTab,
    nav.setAutoOpenLedgerAdd,
    nav.setAutoOpenLedgerTxType,
    nav.setAutoOpenLedgerPrefill,
    nav.setAutoOpenReceiptSplit,
    nav.setAutoOpenSubscriptionAdd,
    nav.setAutoOpenWishlistAdd,
    nav.highlightedTxId,
    nav.clearHighlightedTx,
    nav.highlightedRecurringId,
    nav.clearHighlightedRecurring,
    nav.highlightedLoanId,
    nav.clearHighlightedLoan,
    nav.highlightedReportSection,
    nav.highlightedReportCategory,
    nav.clearHighlightedReportSection,
    nav.highlightedAccountId,
    nav.clearHighlightedAccount,
  ])

  useEffect(() => {
    if (nav.selectedMonth && nav.selectedYear) {
      updateAppSearch({ month: nav.selectedMonth, year: nav.selectedYear })
    }
  }, [nav.selectedMonth, nav.selectedYear])

  // Global search shortcut (Cmd+K / Ctrl+K).
  //
  // Three guards, each for a failure this had: it must not steal the keystroke while the user is
  // typing (the transaction form and the AI composer both use Ctrl+K-adjacent muscle memory, and
  // Firefox binds Ctrl+K to its own search bar), it must not open on top of another overlay, and
  // it opens rather than toggles -- a toggle fired while search was already open behind a
  // password prompt closed it invisibly.
  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false
      if (target.isContentEditable) return true
      const tag = target.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
    }
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return
      if (event.defaultPrevented || isTypingTarget(event.target)) return
      // This effect is registered above the unauthenticated/locked early returns, so it would
      // otherwise latch the overlay open on the login screen and reveal it on the next sign-in.
      if (!session.token || session.isLocked || dialogs.showSearch) return
      event.preventDefault()
      dialogs.setShowSearch(true)
    }
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [dialogs.showSearch, dialogs.setShowSearch, session.token, session.isLocked])

  const {
    currentCycleMonth,
    currentCyclePeriod,
    isCurrentCycleLoading,
    todayDashboardData,
  } = useCurrentCycleDashboard({
    token: session.token,
    optimisticDashboardData: financial.optimisticDashboardData,
    hasQueuedWrites: financial.pendingOps.length > 0,
  })
  const currentPendingNotifications = todayDashboardData?.pendingNotifications || []
  // The Rewards pool is a *current-cycle* quantity: earmarks are today's, so pairing them with a
  // past cycle's balance would divide the wrong money. Falling back to the selected cycle keeps
  // something on screen during a cold start, and `isWishlistCycleStale` below is what stops the
  // page rendering that fallback as if it were the pool.
  const wishlistDashboardData = todayDashboardData || financial.optimisticDashboardData
  const isWishlistCycleStale = isCurrentCycleLoading || !todayDashboardData
  const wishlistPendingRewardsDeduction = pendingRewardsAmount(wishlistDashboardData?.activeRecurringPayments)
  const wishlistPendingEssentialsDeduction = pendingRecurringAmount(wishlistDashboardData?.activeRecurringPayments, 'Essentials')
  const wishlistRewardsBalance = wishlistDashboardData?.categories?.find(c => c.name === 'Rewards')?.remaining ?? 0
  const wishlistFreeRewardsBalance = calculateFreeRewardsBalance(
    wishlistRewardsBalance,
    financial.allSavingsGoals,
    wishlistPendingRewardsDeduction,
  )
  useEffect(() => {
    rewardsBalanceRef.current = wishlistFreeRewardsBalance
  }, [wishlistFreeRewardsBalance])

  // End-of-cycle summary: fires once when a new cycle begins (persisted server-side so it can't
  // re-fire on navigation or on another device), and is re-openable from Reports for any ended
  // cycle. The summary reads live data for the selected cycle, so edits are always reflected.
  const cycleSummary = useCycleSummary({
    token: session.token,
    dashboardData: financial.dashboardData,
    optimisticDashboardData: financial.optimisticDashboardData,
    selectedTransactions: financial.allTransactions,
    onMarkSummarySeen: financial.handleMarkSummarySeen,
  })
  useEffect(() => {
    if (!cycleSummary.isOpen || !session.token) return
    if (financial.loanLoadStatus !== 'idle' && financial.loanLoadStatus !== 'cached') return
    void financial.loadLoans().catch(error => {
      console.warn('Could not load loans for the cycle summary', error)
    })
  }, [cycleSummary.isOpen, financial.loadLoans, financial.loanLoadStatus, session.token])

  const handleToggleHideSensitive = async () => {
    if (prefs.sensitivePreferenceStatus !== 'resolved') return
    if (prefs.hideSensitive) {
      openSensitivePrompt()
    } else {
      prefs.setHideSensitive(true)
      if (session.hasFingerprintSetup) {
        void prefetchFingerprintAssertOptions().catch(() => undefined)
      }
      financial.handleUpdateHideSensitivePreference(true)
    }
  }

  useEffect(() => {
    if (prefs.hideSensitive) dialogs.setConfirmModalData(null)
  }, [prefs.hideSensitive, dialogs.setConfirmModalData])

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
    sensitivePreferenceStatus: prefs.sensitivePreferenceStatus,
    currency: financial.optimisticDashboardData?.setting?.currency || 'USD',
    darkMode: prefs.darkMode,
    activeSyncId: financial.activeSyncId,
    activeSyncIds: financial.activeSyncIds,
    deletingId: financial.deletingTxId,
    isSyncing: financial.isBackgroundSyncing || financial.pendingOps.length > 0 || financial.activeSyncIds.length > 0,
    isOffline: financial.isOffline,
    formatSensitive: financial.formatSensitive,
    showToast: dialogs.showToast,
    guardSensitive: guardSensitive,
    confirm: dialogs.setConfirmModalData,
    operations: financial.activeOps,
    queueMutation: (entity, type, targetId, payload, isUndo) => {
      if (!guardSensitive()) return false
      return financial.queueMutation(entity, type, targetId, payload, isUndo)
    },
  }), [
    prefs.hideSensitive,
    prefs.sensitivePreferenceStatus,
    financial.optimisticDashboardData?.setting?.currency,
    prefs.darkMode,
    financial.activeSyncId,
    financial.activeSyncIds,
    financial.deletingTxId,
    financial.isBackgroundSyncing,
    financial.pendingOps.length,
    financial.activeOps,
    financial.queueMutation,
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

  if (session.isPwaLaunchGateLocked) {
    return (
      <Suspense fallback={<ViewFallback />}>
        <PwaLaunchGate
          appContextValue={appContextValue}
          toasts={dialogs.toasts}
          onDismissToast={dialogs.dismissToast}
          username={session.username}
          onTryDeviceUnlock={session.unlockPwaLaunchGateWithDevice}
          onUnlocked={session.handlePwaLaunchGateUnlocked}
          onSignOut={session.handleLogout}
        />
      </Suspense>
    )
  }

  if (financial.loading && !financial.optimisticDashboardData) {
    return (
      <LaunchReady>
        <div
          data-testid="app-loading-skeleton"
          className="app-shell min-h-screen min-h-dvh text-foreground"
          aria-busy="true"
          aria-label="Loading your financial data securely"
        >
          <div className="safe-screen-inset mx-auto w-full max-w-[1440px] space-y-6 [--safe-screen-block:1.5rem] sm:[--safe-screen-inline:1.5rem] lg:[--safe-screen-inline:2rem]">
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
            <Suspense fallback={<CycleSkeletonFallback />}>
              <CycleSkeleton variant={getPageSkeletonVariant(prefs.activeTab)} fullPage />
            </Suspense>
          </div>
        </div>
      </LaunchReady>
    )
  }

  if (session.isLocked && !!session.token) {
    return (
      <LaunchReady>
        <AppProvider value={appContextValue}>
          <div className="app-shell min-h-screen text-foreground flex flex-col selection:bg-primary/25 selection:text-foreground">
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

  if (!hasCompleteAccountCoverage(financial.allAccounts)) {
    return (
      <LaunchReady>
        <Suspense fallback={<ViewFallback />}>
          <AccountCoverageGate
            accounts={financial.allAccounts}
            currency={financial.optimisticDashboardData?.setting?.currency || 'USD'}
            loading={financial.loading}
            error={financial.error}
            hideSensitive={prefs.hideSensitive}
            formatSensitive={financial.formatSensitive}
            onAddAccount={financial.handleAddAccount}
            onUpdateAccount={financial.handleUpdateAccount}
            onRetry={() => financial.loadAll(nav.selectedMonth || undefined, nav.selectedYear || undefined, true)}
          />
        </Suspense>
      </LaunchReady>
    )
  }

  return (
    <AppProvider value={appContextValue}>
      <div className="app-shell min-h-screen text-foreground flex flex-col selection:bg-primary/25 selection:text-foreground">
        {enableRuntimeBackgroundBridges && <Suspense fallback={null}>
          <RuntimeBackgroundBridges
            account={session.username}
            token={session.token}
            urgentPush={prefs.activeTab === 'settings'}
            isOffline={financial.isOffline}
            activeTabRef={activeTabRef}
            isLedgerAddOpenRef={isLedgerAddOpenRef}
            isReceiptSplitOpenRef={isReceiptSplitOpenRef}
            isInvestmentAddOpenRef={isInvestmentAddOpenRef}
            setActiveTab={prefs.setActiveTab}
            setAutoOpenLedgerAdd={nav.setAutoOpenLedgerAdd}
            setAutoOpenReceiptSplit={nav.setAutoOpenReceiptSplit}
            setAutoOpenInvestmentAdd={setAutoOpenInvestmentAdd}
            showToast={dialogs.showToast}
            onPushChange={setPush}
            onScansChange={setScans}
            onInvestmentAllocationChange={setInvestmentAllocation}
          />
        </Suspense>}
        <ToastViewport toasts={dialogs.toasts} onDismiss={dialogs.dismissToast} />

        <TopNav
          activeTab={prefs.activeTab}
          onTabChange={prefs.setActiveTab}
          onQuickAction={nav.handleQuickAction}
          onAskAI={() => setIsAiOpen(true)}
          onOpenSearch={() => dialogs.setShowSearch(true)}
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
                ? mutationBusyLabel('syncing')
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

        <Suspense fallback={null}>
          <AiAssistantPanel
            isOpen={isAiOpen}
            onClose={() => setIsAiOpen(false)}
            onActions={aiRouter.handleAiActions}
            sensitiveMode={prefs.hideSensitive}
            isOffline={financial.isOffline}
            hasPendingLocalChanges={financial.pendingOps.length > 0 || financial.failedOps.length > 0 ||
              financial.draftTransactions.length > 0 || financial.activeSyncId != null}
            invocation={aiEntryPoint.invocation}
            onInvocationConsumed={aiEntryPoint.consume}
            surface={prefs.activeTab}
          />
        </Suspense>

        {financial.error && (
          <div className="bg-destructive/15 border-b border-destructive/30 text-destructive px-4 py-2 text-xs flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-destructive animate-pulse select-none" />
            <span className="select-none">{financial.error}</span>
            <Button variant="unstyled"
              type="button"
              onClick={() => financial.loadAll(nav.selectedMonth || undefined, nav.selectedYear || undefined, true)}
              disabled={financial.isBackgroundSyncing}
              className="ml-1 font-bold underline underline-offset-2 hover:text-destructive/80 disabled:opacity-60 disabled:cursor-default cursor-pointer"
            >
              {financial.isBackgroundSyncing ? 'Retrying…' : 'Retry'}
            </Button>
          </div>
        )}

        <AuthenticatedView
          prefs={prefs}
          financial={financial}
          nav={nav}
          session={session}
          dialogs={dialogs}
          push={push}
          aiRouter={aiRouter}
          cycleSummary={cycleSummary}
          investmentAllocation={investmentAllocation}
          receiptScan={receiptScan}
          receiptSplit={receiptSplit}
          investmentScan={investmentScan}
          apiClient={api}
          todayDashboardData={todayDashboardData}
          wishlistDashboardData={wishlistDashboardData}
          wishlistRewardsBalance={wishlistRewardsBalance}
          wishlistPendingRewardsDeduction={wishlistPendingRewardsDeduction}
          wishlistPendingEssentialsDeduction={wishlistPendingEssentialsDeduction}
          isWishlistCycleStale={isWishlistCycleStale}
          currentPendingNotificationsCount={currentPendingNotifications.length}
          currentCycleMonth={currentCycleMonth}
          currentCycleYear={currentCyclePeriod.year}
          isCurrentCycleLoading={isCurrentCycleLoading}
          autoOpenInvestmentAdd={autoOpenInvestmentAdd}
          setAutoOpenInvestmentAdd={setAutoOpenInvestmentAdd}
          setIsLedgerAddOpen={setIsLedgerAddOpen}
          setIsReceiptSplitOpen={setIsReceiptSplitOpen}
          setIsInvestmentAddOpen={setIsInvestmentAddOpen}
          handleToggleDarkMode={handleToggleDarkMode}
          handleToggleHideSensitive={handleToggleHideSensitive}
          handleToggleBalanceAmounts={handleToggleBalanceAmounts}
          alert={alert}
          onExplainWithAi={launchAiExplanation}
        />

        <AppFooter />

        <MobileFabTrigger
          isOpen={fabMenu.isOpen}
          visible={shouldShowMobileFab(prefs.activeTab)}
          onToggle={fabMenu.toggle}
          triggerRef={fabTriggerRef}
        />

        <Suspense fallback={<AppOverlaysFallback
          isOpen={fabMenu.isOpen}
          visible={shouldShowMobileFab(prefs.activeTab)}
          onAskAi={() => {
            setIsAiOpen(true)
            fabMenu.close()
          }}
          onPostTransaction={() => {
            nav.handleQuickAction('transaction')
            fabMenu.close()
          }}
          postTransactionDisabled={!canOpenBlankMutationForm(prefs.hideSensitive, prefs.sensitivePreferenceStatus)}
        />}>
          <AppOverlays
            dialogs={dialogs}
            financial={financial}
            session={session}
            prefs={prefs}
            nav={nav}
            cycleSummary={cycleSummary}
            fabMenu={fabMenu}
            fabTriggerRef={fabTriggerRef}
            todayDashboardData={todayDashboardData}
            currentPendingNotifications={currentPendingNotifications}
            setIsAiOpen={setIsAiOpen}
          />
        </Suspense>
      </div>
    </AppProvider>
  )
}

export default App
