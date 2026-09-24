import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react'
import TopNav from "./TopNav.tsx"
import * as api from './lib/api'
import { ToastViewport } from './components/ui/ToastViewport'
import { AlertBanner } from './components/ui/AlertBanner'
import { useNativeAppLifecycle } from './lib/useNativeAppLifecycle'
import { hasActiveWebAuthnRequest } from './lib/webauthnRequest'
import { shouldLockNativeAppForStateChange } from './lib/nativeAppLifecyclePolicy'
import { getStatus } from './lib/errors'
const AiAssistantPanel = lazy(() => import('./components/AiAssistantPanel').then(m => ({ default: m.AiAssistantPanel })))
import { AppProvider } from './contexts/AppProvider'
import { Button } from './components/ui/Button'

// Domain Hooks
import { useAppPreferences } from './app/useAppPreferences'
import { useAppSession } from './app/useAppSession'
import { useFinancialData } from './app/useFinancialData'
import { useCycleNavigation } from './app/useCycleNavigation'
import { useAiActionRouter } from './app/useAiActionRouter'
import { useAppDialogs } from './app/useAppDialogs'
import { useCycleSummary } from './app/useCycleSummary'
import { useAiEntryPoint } from './app/useAiEntryPoint'
import { shouldShowMobileFab, useFabMenu } from './app/useFabMenu'
import { useCurrentCycleDashboard } from './app/useCurrentCycleDashboard'
import { AuthenticatedView } from './app/AuthenticatedView'
import { hideNativeSplashAfterPaint } from './app/launchHandoff'
import { useAppRootContext } from './app/useAppRootContext'
import { prefetchFingerprintAssertOptions } from './lib/fingerprintOptionsCache'
import { readAppLocation, updateAppSearch } from './lib/appLocation'
import { mutationBusyLabel } from './components/ui/rowSyncState'
import type { AiInvocationContext } from './lib/api/ai'
import { calculateFreeRewardsBalance, pendingRecurringAmount, pendingRewardsAmount } from './lib/freeRewards'
import { canOpenBlankMutationForm } from './lib/quickAddAvailability'
import {
  AppFooter,
  AppOverlaysFallback,
  MobileFabTrigger,
} from './app/AppShellComponents'
import { AppGateways } from './app/AppGateways'
import { useTabNavigationCleanup } from './app/useTabNavigationCleanup'
import { useAppThemeAndShortcuts } from './app/useAppThemeAndShortcuts'
import { useNativePushActions } from './app/useNativePushActions'
import { useNativeNavigation } from './lib/useNativeNavigation'

const RuntimeBackgroundBridges = lazy(() => import('./app/RuntimeBackgroundBridges').then(module => ({ default: module.RuntimeBackgroundBridges })))
const enableRuntimeBackgroundBridges = import.meta.env.MODE !== 'test'

import { useAppModalState } from './app/useAppModalState'

const AppOverlays = lazy(() => import('./app/AppOverlays').then(module => ({ default: module.AppOverlays })))

function App() {
  useNativeNavigation()
  const loadAllAbortRef = useRef<AbortController | null>(null)

  // 1. Preferences
  const prefs = useAppPreferences()

  // 2. Dialogs
  const dialogs = useAppDialogs()


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

  const modals = useAppModalState()
  const { push, setPush, scans, setScans, investmentAllocation, setInvestmentAllocation, isLedgerAddOpenRef, isReceiptSplitOpenRef, isInvestmentAddOpenRef, autoOpenInvestmentAdd, setAutoOpenInvestmentAdd, setIsLedgerAddOpen, setIsReceiptSplitOpen, setIsInvestmentAddOpen } = modals
  const { receiptScan, receiptSplit, investmentScan } = scans

  // 4. Cycle Navigation
  const persistSelectedPeriodRef = useRef<(month: string, year: number) => void | Promise<void>>(api.selectPeriod)
  const nav = useCycleNavigation({
    // Cycle navigation owns rollback and user feedback, so unlike ordinary background refreshes
    // it must observe a failed fetch instead of treating it as a successful switch.
    loadAll: (m, y, b, shouldCommit) => financial.loadAll(m, y, b, true, shouldCommit),
    handleLogout: session.handleLogout,
    markSessionLocked: session.markSessionLocked,
    setDashboardData: (d) => financial.setDashboardData(d),
    setTransactions: (t) => financial.setTransactions(t),
    setActiveTab: prefs.setActiveTab,
    setLedgerCyclesRange: prefs.setLedgerCyclesRange,
    showAlert: dialogs.showAlert,
    persistPeriod: (month, year) => persistSelectedPeriodRef.current(month, year),
  })

  useNativePushActions(
    session.isSessionResolved
      && Boolean(session.token)
      && !session.isLocked
      && !session.isNativeAppGateLocked
      && !session.isPwaLaunchGateLocked,
    {
      verifySession: async () => {
        try {
          await api.fetchAuthStatus(session.username)
          return true
        } catch (error) {
          if (getStatus(error) === 401) await session.handleLogout()
          return false
        }
      },
      openRecurringPayment: nav.handleNavigateToRecurring,
      openCategoryAlerts: () => nav.handleNavigateToReportSection('category-limits'),
    },
  )

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
    loadAllAbortRef,
    selectedMonth: nav.selectedMonth,
    setSelectedMonth: nav.setSelectedMonth,
    selectedYear: nav.selectedYear,
    setSelectedYear: nav.setSelectedYear,
    setShowFailedOpsModal: dialogs.setShowFailedOpsModal,
    onNavigateToLedger: nav.handleNavigateToLedger,
  })
  useEffect(() => {
    persistSelectedPeriodRef.current = (month, year) => {
      financial.mutateQueue(previous => financial.enqueue(previous, 'settings', 'update', 'selectedPeriod', {
        selectedMonth: month,
        selectedYear: year,
      }))
    }
  }, [financial])
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

  useAppThemeAndShortcuts({
    darkMode: prefs.darkMode,
    token: session.token,
    isLocked: session.isLocked,
    showSearch: dialogs.showSearch,
    setShowSearch: dialogs.setShowSearch,
  })

  const handleNativeAppStateChange = useCallback(async (isActive: boolean) => {
    if (isActive) {
      await hideNativeSplashAfterPaint()
      return
    }
    if (!shouldLockNativeAppForStateChange(isActive, hasActiveWebAuthnRequest())) return
    await session.lockNativeAppGate()
  }, [session.lockNativeAppGate])
  useNativeAppLifecycle(handleNativeAppStateChange)

  const [isAiOpen, setIsAiOpen] = useState(false)
  const aiEntryPoint = useAiEntryPoint()
  const launchAiExplanation = useCallback((context: AiInvocationContext, prompt: string) => {
    aiEntryPoint.launch(context, prompt)
    setIsAiOpen(true)
  }, [aiEntryPoint.launch])
  const fabMenu = useFabMenu(prefs.activeTab)
  const fabTriggerRef = useRef<HTMLButtonElement>(null)

  const aiNavigation = aiRouter.state.aiNavigation
  useEffect(() => {
    if (!aiNavigation) return
    if (aiNavigation.tab === 'recurring' && aiNavigation.recurringId) {
      nav.handleNavigateToRecurring(aiNavigation.recurringId)
    } else if (aiNavigation.tab === 'wishlist' && aiNavigation.wishlistItemId) {
      nav.handleNavigateToReward(aiNavigation.wishlistItemId)
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

  // Redirect from drafts if empty.
  useEffect(() => {
    if (prefs.activeTab === 'drafts' && financial.draftTransactions.length === 0) {
      prefs.setActiveTab('ledger')
    }
  }, [prefs.activeTab, financial.draftTransactions, prefs.setActiveTab])

  // Tab exit cleanup
  const activeTabRef = useTabNavigationCleanup(prefs.activeTab, nav)

  useEffect(() => {
    if (nav.selectedMonth && nav.selectedYear) {
      updateAppSearch({ month: nav.selectedMonth, year: nav.selectedYear })
    }
  }, [nav.selectedMonth, nav.selectedYear])

  const {
    currentCycleMonth,
    currentCyclePeriod,
    isCurrentCycle,
    isCurrentCycleLoading,
    isCurrentCycleStale,
    todayDashboardData,
  } = useCurrentCycleDashboard({
    token: session.token,
    optimisticDashboardData: financial.optimisticDashboardData,
    hasQueuedWrites: financial.pendingOps.length > 0,
  })
  const currentPendingNotifications = todayDashboardData?.pendingNotifications || []

  const wishlistDashboardData = todayDashboardData || financial.optimisticDashboardData
  const isWishlistCycleStale = isCurrentCycleLoading || isCurrentCycleStale || !todayDashboardData
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
    const nextHidden = !prefs.hideFinancialFigures
    prefs.setHideFinancialFigures(nextHidden)
  }

  const handleToggleDarkMode = () => {
    const newDark = !prefs.darkMode
    prefs.setDarkMode(newDark)
    financial.handleUpdateDarkModePreference(newDark)
  }

  const appContextValue = useAppRootContext({
    prefs,
    financial,
    dialogs,
    guardSensitive,
  })

  return (
    <AppGateways
      session={session}
      prefs={prefs}
      dialogs={dialogs}
      financial={financial}
      nav={nav}
      appContextValue={appContextValue}
    >
      <AppProvider value={appContextValue}>
        <div className="app-shell min-h-screen text-foreground flex flex-col selection:bg-primary/25 selection:text-foreground">
        {enableRuntimeBackgroundBridges && <Suspense fallback={null}>
          <RuntimeBackgroundBridges
            session={session}
            bridge={[nav, openSensitivePrompt, prefs.setActiveTab, setAutoOpenInvestmentAdd]}
            urgentPush={prefs.activeTab === 'settings'}
            isOffline={financial.isOffline}
            activeTabRef={activeTabRef}
            isLedgerAddOpenRef={isLedgerAddOpenRef}
            isReceiptSplitOpenRef={isReceiptSplitOpenRef}
            isInvestmentAddOpenRef={isInvestmentAddOpenRef}
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
          isSyncing={financial.isBackgroundSyncing || Boolean(financial.activeSyncId) || financial.activeSyncIds.length > 0}
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
          cycleDay={financial.optimisticDashboardData?.setting?.cycleDay}
        />

        <Suspense fallback={null}>
          <AiAssistantPanel
            isOpen={isAiOpen}
            onClose={() => setIsAiOpen(false)}
            onActions={aiRouter.handleAiActions}
            sensitiveMode={prefs.hideSensitive}
            isOffline={financial.isOffline}
            invocation={aiEntryPoint.invocation}
            onInvocationConsumed={aiEntryPoint.consume}
            surface={prefs.activeTab}
            accounts={financial.allAccounts}
          />
        </Suspense>

        {financial.error && (
          <AlertBanner
            variant={financial.error.startsWith('Sync pending:') ? 'info' : 'error'}
            className="justify-center rounded-none border-x-0 border-t-0 px-4 py-2"
          >
            <div className="flex items-center justify-center gap-2">
            <span className="select-none">{financial.error}</span>
            <Button variant="tertiary"
              type="button"
              onClick={() => financial.loadAll(nav.selectedMonth || undefined, nav.selectedYear || undefined, true)}
              disabled={financial.isBackgroundSyncing}
              className="ml-1 font-bold underline underline-offset-2 hover:text-destructive/80 disabled:opacity-60 disabled:cursor-default cursor-pointer"
            >
              {financial.isBackgroundSyncing ? 'Retrying…' : 'Retry'}
            </Button>
            </div>
          </AlertBanner>
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
          isCurrentCycle={isCurrentCycle}
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
            apiClient={api}
          />
        </Suspense>
      </div>
    </AppProvider>
    </AppGateways>
  )
}

export default App
