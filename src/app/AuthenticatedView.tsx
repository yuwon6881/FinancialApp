import { lazy, Suspense, type Dispatch, type SetStateAction } from 'react'
import type { AppTab, DashboardData } from '../types'
import { clearLocalFinancialData } from '../lib/cache'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { PullToRefresh } from '../components/ui/PullToRefresh'
import { Skeleton } from '../components/ui/Skeleton'
import type { PageSkeletonVariant } from '../components/ui/CycleSkeleton'
import { LaunchReady } from './LaunchReady'
import type { useAiActionRouter } from './useAiActionRouter'
import type { useAppDialogs } from './useAppDialogs'
import type { useAppPreferences } from './useAppPreferences'
import type { useAppSession } from './useAppSession'
import type { useCycleNavigation } from './useCycleNavigation'
import type { useCycleSummary } from './useCycleSummary'
import type { useFinancialData } from './useFinancialData'
import type { useInvestmentRefreshCoordinator } from './useInvestmentRefreshCoordinator'
import type { usePushNotifications } from './usePushNotifications'
import { shouldShowMobileFab } from './useFabMenu'
import type { useInvestmentScanPolling } from '../lib/useInvestmentScanPolling'
import type { useReceiptScanPolling } from '../lib/useReceiptScanPolling'
import type { useReceiptSplitPolling } from '../lib/useReceiptSplitPolling'
import { getCycleYearAndMonthForDate, MONTH_NAMES } from '../lib/cycle'
import { buildMutationSuccessToast, buildUndoSuccessToast } from '../lib/mutationToast'
import type { AiInvocationContext } from '../lib/api/ai'
const DashboardView = lazy(() => import('../components/DashboardView').then(module => ({ default: module.DashboardView })))
const ReportsView = lazy(() => import('../components/ReportsView').then(module => ({ default: module.ReportsView })))
const RecurringPaymentsView = lazy(() => import('../components/RecurringPaymentsView').then(module => ({ default: module.RecurringPaymentsView })))
const LedgerView = lazy(() => import('../components/LedgerView').then(module => ({ default: module.LedgerView })))
const CommitmentsRewardsView = lazy(() => import('../components/CommitmentsRewardsView').then(module => ({ default: module.CommitmentsRewardsView })))
const SettingsView = lazy(() => import('../components/SettingsView').then(module => ({ default: module.SettingsView })))
const DraftStagingView = lazy(() => import('../components/DraftStagingView').then(module => ({ default: module.DraftStagingView })))
const InvestmentsView = lazy(() => import('../components/InvestmentsView').then(module => ({ default: module.InvestmentsView })))
const DocumentsView = lazy(() => import('../components/DocumentsView').then(module => ({ default: module.DocumentsView })))
const CycleSkeleton = lazy(() => import('../components/ui/CycleSkeleton').then(module => ({ default: module.CycleSkeleton })))

const getPageSkeletonVariant = (tab: AppTab): PageSkeletonVariant => tab

const ContentViewFallback = ({ tab }: { tab: AppTab }) => (
  <div className="w-full pt-2 view-enter">
    <Suspense fallback={<div className="space-y-6" aria-hidden="true"><Skeleton className="h-40 w-full rounded-2xl" /><Skeleton className="h-64 w-full rounded-2xl" /></div>}>
      <CycleSkeleton variant={getPageSkeletonVariant(tab)} fullPage />
    </Suspense>
  </div>
)

interface AuthenticatedViewProps {
  prefs: ReturnType<typeof useAppPreferences>
  financial: ReturnType<typeof useFinancialData>
  nav: ReturnType<typeof useCycleNavigation>
  session: ReturnType<typeof useAppSession>
  dialogs: ReturnType<typeof useAppDialogs>
  push: ReturnType<typeof usePushNotifications>
  aiRouter: ReturnType<typeof useAiActionRouter>
  cycleSummary: ReturnType<typeof useCycleSummary>
  investmentAllocation: ReturnType<typeof useInvestmentRefreshCoordinator>
  receiptScan: ReturnType<typeof useReceiptScanPolling>
  receiptSplit: ReturnType<typeof useReceiptSplitPolling>
  investmentScan: ReturnType<typeof useInvestmentScanPolling>
  apiClient: typeof import('../lib/api')
  todayDashboardData: DashboardData | null
  wishlistDashboardData: DashboardData | null
  wishlistRewardsBalance: number
  wishlistPendingRewardsDeduction: number
  wishlistPendingEssentialsDeduction: number
  /** True while the Rewards figures on hand belong to a cycle other than the current one. */
  isWishlistCycleStale: boolean
  currentPendingNotificationsCount: number
  currentCycleMonth: string
  currentCycleYear: number
  isCurrentCycleLoading: boolean
  autoOpenInvestmentAdd: boolean
  setAutoOpenInvestmentAdd: Dispatch<SetStateAction<boolean>>
  setIsLedgerAddOpen: Dispatch<SetStateAction<boolean>>
  setIsReceiptSplitOpen: Dispatch<SetStateAction<boolean>>
  setIsInvestmentAddOpen: Dispatch<SetStateAction<boolean>>
  handleToggleDarkMode: () => void
  handleToggleHideSensitive: () => void
  handleToggleBalanceAmounts: () => void
  alert: (message: string) => void
  onExplainWithAi: (context: AiInvocationContext, prompt: string) => void
}

export function AuthenticatedView({
  prefs,
  financial,
  nav,
  session,
  dialogs,
  push,
  aiRouter,
  cycleSummary,
  investmentAllocation,
  receiptScan,
  receiptSplit,
  investmentScan,
  apiClient,
  todayDashboardData,
  wishlistDashboardData,
  wishlistRewardsBalance,
  wishlistPendingRewardsDeduction,
  wishlistPendingEssentialsDeduction,
  isWishlistCycleStale,
  currentPendingNotificationsCount,
  currentCycleMonth,
  currentCycleYear,
  isCurrentCycleLoading,
  autoOpenInvestmentAdd,
  setAutoOpenInvestmentAdd,
  setIsLedgerAddOpen,
  setIsReceiptSplitOpen,
  setIsInvestmentAddOpen,
  handleToggleDarkMode,
  handleToggleHideSensitive,
  handleToggleBalanceAmounts,
  alert,
  onExplainWithAi,
}: AuthenticatedViewProps) {
  const {
    activeReceiptScanDraft,
    failedScanJob,
    receiptScanJobIds,
    handleReceiptScanStarted,
    clearReceiptScanJob,
  } = receiptScan
  const {
    activeReceiptSplitDraft,
    failedReceiptSplitJob,
    handleReceiptSplitStarted,
    clearReceiptSplitJob,
  } = receiptSplit
  // Compared on month AND year, unlike useCurrentCycleDashboard's own month-only check: an
  // emergency-fund offer attached to a same-month cycle a year back would draw from balances that
  // have nothing to do with it.
  const isSelectedCycleCurrent =
    financial.optimisticDashboardData?.setting?.selectedMonth === currentCycleMonth &&
    financial.optimisticDashboardData?.setting?.selectedYear === currentCycleYear

  const {
    activeInvestmentScanDraft,
    failedInvestmentScanJob,
    investmentScanJobIds,
    handleInvestmentScanStarted,
    clearInvestmentScanJob,
  } = investmentScan

  // Failures here reach the user as toasts, like every other failure in the app. A blocking
  // window.alert also lands as a system dialog inside the installed PWA and the native shell,
  // and the common case is not an error at all: a document whose linked transaction has since
  // been deleted, which is worth a sentence, not a modal that has to be dismissed.
  const openLinkedVaultTransaction = async (transactionId: string) => {
    const cannotOpen = (message: string) => dialogs.showToast(message, 'Linked transaction', 'warning')
    try {
      const transaction = await apiClient.fetchTransactionById(transactionId)
      const match = /^(\d{4})-(\d{2})-/.exec(transaction.date)
      if (!match) {
        cannotOpen('This document records a date the ledger cannot open.')
        return
      }
      const monthIndex = Number(match[2]) - 1
      const day = Number(transaction.date.slice(8, 10))
      if (monthIndex < 0 || monthIndex >= MONTH_NAMES.length || day < 1 || day > 31) {
        cannotOpen('This document records a date the ledger cannot open.')
        return
      }
      const cycleDay = financial.optimisticDashboardData?.setting?.cycleDay || 28
      const cycle = getCycleYearAndMonthForDate(new Date(Number(match[1]), monthIndex, day), cycleDay)
      nav.handleNavigateToLedger({
        highlightedTxId: transaction.id,
        showAllCycles: false,
        range: 'monthly',
        targetMonth: MONTH_NAMES[cycle.monthIndex - 1],
        targetYear: cycle.year,
      })
    } catch {
      cannotOpen('The transaction this document was attached to could not be opened. It may have been deleted.')
    }
  }

  return (
    <>
      <PullToRefresh
        onRefresh={() => financial.loadAll(nav.selectedMonth || undefined, nav.selectedYear || undefined, true)}
        disabled={financial.loading || session.isLocked}
      >
        {/* overflow-x-clip, not overflow-x-hidden: `hidden` would force overflow-y
            to `auto` and bring back the second vertical scrollbar this container
            used to have, while `clip` contains a rogue-width view without ever
            creating a scroll container. */}
        <main
          className={`${shouldShowMobileFab(prefs.activeTab) ? 'pb-fab-safe' : 'pb-nav-safe'} relative mx-auto w-full min-w-0 max-w-[1440px] flex-1 overflow-x-clip px-4 py-6 sm:px-6 sm:py-8 lg:px-8`}
          aria-busy={prefs.sensitivePreferenceStatus === 'pending' || financial.loading}
        >
          <ErrorBoundary variant="inline" resetKey={prefs.activeTab}>
            <Suspense fallback={<ContentViewFallback tab={prefs.activeTab} />}>
              <LaunchReady>
                <div
                  key={prefs.activeTab}
                  className="w-full view-enter"
                >
                  {prefs.activeTab === 'dashboard' && (
                    <DashboardView
                      dashboardData={todayDashboardData}
                      onNavigate={prefs.setActiveTab}
                      hideBalanceAmounts={prefs.hideBalanceAmounts}
                      walletBalance={financial.optimisticDashboardData?.stats.totalBalance ?? financial.totalBalance}
                      onToggleBalanceAmounts={handleToggleBalanceAmounts}
                      pendingNotificationCount={currentPendingNotificationsCount}
                      onOpenNotifications={() => dialogs.setShowLoginModal(true)}
                      onNavigateToLedger={options => nav.handleNavigateToLedger({
                        ...options,
                        targetMonth: currentCycleMonth,
                        targetYear: currentCycleYear,
                      })}
                      wishlist={financial.allWishlist}
                      savingsGoals={financial.allSavingsGoals}
                      isSwitchingCycle={isCurrentCycleLoading || !todayDashboardData}
                      investmentAllocation={investmentAllocation}
                      onNavigateToCategoryLimits={() => nav.handleNavigateToReportSection('category-limits')}
                    />
                  )}

                  {prefs.activeTab === 'reports' && (
                    <ReportsView
                      dashboardData={financial.optimisticDashboardData}
                      transactions={financial.allTransactions}
                      wishlist={financial.allWishlist}
                      savingsGoals={financial.allSavingsGoals}
                      hideBalanceAmounts={prefs.hideBalanceAmounts}
                      onSelectPeriod={nav.handleSelectPeriod}
                      onNavigate={prefs.setActiveTab}
                      onNavigateToRecurring={nav.handleNavigateToRecurring}
                      onNavigateToLedger={nav.handleNavigateToLedger}
                      onAddBalanceAdjustment={financial.handleAddBalanceAdjustment}
                      isSwitchingCycle={nav.isSwitchingCycle}
                      highlightedSection={nav.highlightedReportSection}
                      onClearHighlightedSection={nav.clearHighlightedReportSection}
                      onViewCycleSummary={cycleSummary.openManual}
                      onExplainWithAi={cycleKey => onExplainWithAi({
                        surface: 'reports',
                        preset: 'report-review',
                        cycleKey,
                        hasPendingLocalChanges: financial.pendingOps.length > 0 || financial.failedOps.length > 0 ||
                          financial.draftTransactions.length > 0 || financial.activeSyncId != null,
                      }, 'Explain this cycle')}
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
                      onUpdateCategoryType={financial.handleUpdateCategoryType}
                      onDeleteCategory={financial.requestDeleteCategory}
                      onApplyCategoryCleanupSuggestion={financial.handleApplyCategoryCleanupSuggestion}
                      accounts={financial.allAccounts}
                      onAddAccount={financial.handleAddAccount}
                      onUpdateAccount={financial.handleUpdateAccount}
                      onRequestDeleteAccount={financial.requestDeleteAccount}
                      notifyOnLoginEnabled={prefs.notifyOnLogin}
                      onToggleNotifyOnLogin={(checked) => {
                        const previous = prefs.notifyOnLogin
                        prefs.setNotifyOnLogin(checked)
                        const copy = buildMutationSuccessToast({
                          entity: 'Settings',
                          action: 'Updated',
                          message: `Login notifications were ${checked ? 'enabled' : 'disabled'}.`,
                        })
                        dialogs.showToast(copy.message, copy.title, copy.tone, {
                          label: 'Undo',
                          onAction: () => {
                            prefs.setNotifyOnLogin(previous)
                            const undoCopy = buildUndoSuccessToast('Login notifications', 'settings')
                            dialogs.showToast(undoCopy.message, undoCopy.title, undoCopy.tone)
                          },
                        })
                      }}
                      pushSupported={push.supported}
                      pushLoading={push.loading}
                      pushBusyAction={push.busyAction}
                      pushGuidance={push.guidance}
                      billRemindersEnabled={push.billRemindersEnabled}
                      categoryAlertsEnabled={push.categoryAlertsEnabled}
                      otherDevicesBillReminders={push.otherDevicesBillReminders}
                      otherDevicesCategoryAlerts={push.otherDevicesCategoryAlerts}
                      pushEnrolmentRevision={push.enrolmentRevision}
                      onToggleChannel={(channel, checked) => {
                        // Each kind is its own standing choice for this device: turning one on
                        // asks the browser for permission and registers this device for that kind
                        // only. Every toast says "this device", because that is the whole scope of
                        // what just changed -- other devices are never touched from here.
                        void (async () => {
                          if (!await push.setChannelEnabled(channel, checked)) return
                          const isBills = channel === 'billReminders'
                          const copy = buildMutationSuccessToast({
                            entity: isBills ? 'Bill reminders' : 'Spending alerts',
                            action: checked ? 'Turned on' : 'Turned off',
                            message: checked
                              ? isBills
                                ? 'This device will now be reminded before each bill is due.'
                                : 'This device will now be told when a category gets close to its planned amount.'
                              : 'This device will no longer show these. Your other devices are unchanged.',
                          })
                          dialogs.showToast(copy.message, copy.title, copy.tone)
                        })()
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
                          const copy = buildMutationSuccessToast({
                            entity: 'Local Data',
                            action: 'Cleared',
                            message: 'Cached financial data and offline drafts were removed from this device.',
                          })
                          dialogs.showToast(copy.message, copy.title, copy.tone)
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
                      globalPushEnabled={push.billRemindersEnabled || push.otherDevicesBillReminders}
                      thisDevicePushEnabled={push.billRemindersEnabled}
                      onUpdateReminder={financial.handleUpdateReminder}
                      onRequestPayEarly={financial.requestPayEarly}
                      loans={financial.allLoans}
                      onAddLoan={financial.handleAddLoan}
                      onUpdateLoan={financial.handleUpdateLoan}
                      onRequestDeleteLoan={financial.requestDeleteLoan}
                      loanLoadStatus={financial.loanLoadStatus}
                      hasLoadedLoans={financial.hasLoadedLoans}
                      onLoadLoans={financial.loadLoans}
                      onExplainLoan={loan => onExplainWithAi({
                        surface: 'recurring',
                        preset: 'loan-explain',
                        loanId: loan.id,
                        hasPendingLocalChanges: financial.pendingOps.length > 0 || financial.failedOps.length > 0 ||
                          financial.draftTransactions.length > 0 || financial.activeSyncId != null,
                      }, 'Explain this loan')}
                      aiDraft={aiRouter.state.aiRecurringDraft}
                      aiEditDraft={aiRouter.state.aiRecurringEditDraft}
                      onAiDraftConsumed={() => aiRouter.dispatch({ aiRecurringDraft: null })}
                      onAiEditDraftConsumed={() => aiRouter.dispatch({ aiRecurringEditDraft: null })}
                    />
                  )}

                  {prefs.activeTab === 'ledger' && (
                    <LedgerView 
                      transactions={financial.allTransactions}
                      accounts={financial.allAccounts}
                      autocompleteSuggestions={financial.autocompleteSuggestions}
                      onAddTransaction={(tx, documents) => financial.handleAddTransaction(tx, prefs.setActiveTab, documents)}
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
                      incomingRecurringFilter={nav.ledgerIncomingRecurringFilter}
                      incomingWishlistFilter={nav.ledgerIncomingWishlistFilter}
                      incomingTxType={nav.ledgerIncomingTxType}
                      highlightedTxId={nav.highlightedTxId}
                      onClearIncomingFilters={nav.clearIncomingFilters}
                      onClearHighlightedTx={nav.clearHighlightedTx}
                      showAllCycles={nav.ledgerShowAllCycles}
                      onClearAllCycles={() => {
                        nav.setLedgerShowAllCycles(false)
                        prefs.setLedgerCyclesRange('monthly')
                      }}
                      cyclesRange={prefs.ledgerCyclesRange}
                      onRouteStateChange={nav.syncLedgerRouteState}
                      ledgerSummaries={financial.optimisticDashboardData?.categories}
                      autoOpenAddForm={nav.autoOpenLedgerAdd}
                      autoOpenTxType={nav.autoOpenLedgerTxType}
                      onResetAutoOpen={() => {
                        nav.setAutoOpenLedgerAdd(false)
                        nav.setAutoOpenLedgerTxType(null)
                      }}
                      stabilityBalance={financial.optimisticDashboardData?.categories?.find(c => c.name === 'Stability')?.remaining ?? 0}
                      isSwitchingCycle={nav.isSwitchingCycle}
                      stabilityTarget={financial.optimisticDashboardData?.setting?.targetStabilityFund ?? 10000}
                      essentialsAlloc={financial.optimisticDashboardData?.setting?.essentialsAlloc ?? 0.5}
                      growthAlloc={financial.optimisticDashboardData?.setting?.growthAlloc ?? 0.25}
                      stabilityAlloc={financial.optimisticDashboardData?.setting?.stabilityAlloc ?? 0.15}
                      rewardsAlloc={financial.optimisticDashboardData?.setting?.rewardsAlloc ?? 0.1}
                      stabilityOverflowRedirect={financial.optimisticDashboardData?.setting?.stabilityOverflowRedirect}
                      // Only offered while the selected cycle IS the current one. Browsing a past
                      // cycle would otherwise compute an offer from today's figures and attach it
                      // to a backdated salary.
                      stabilityRecovery={isSelectedCycleCurrent ? financial.optimisticDashboardData?.stabilityRecovery : undefined}
                      essentialsBalance={financial.optimisticDashboardData?.categories?.find(c => c.name === 'Essentials')?.remaining ?? 0}
                      growthBalance={financial.optimisticDashboardData?.categories?.find(c => c.name === 'Growth')?.remaining ?? 0}
                      rewardsBalance={financial.optimisticDashboardData?.categories?.find(c => c.name === 'Rewards')?.remaining ?? 0}
                      onFetchPagedTransactions={apiClient.fetchPagedTransactions}
                      onFetchTransactionById={apiClient.fetchTransactionById}
                      onExportTransactions={apiClient.exportTransactionsCsv}
                      onShowAlert={alert}
                      onStartEditPending={financial.setEditingPendingId}
                      receiptScanDraft={activeReceiptScanDraft}
                      onReceiptScanStarted={handleReceiptScanStarted}
                      onReceiptScanCleared={clearReceiptScanJob}
                      onReviewReceiptScan={() => nav.setAutoOpenLedgerAdd(true)}
                      onAddFormOpenChange={setIsLedgerAddOpen}
                      activeScanJobIds={receiptScanJobIds}
                      failedScanJob={failedScanJob}
                      autoOpenReceiptSplit={nav.autoOpenReceiptSplit}
                      onResetAutoOpenReceiptSplit={() => nav.setAutoOpenReceiptSplit(false)}
                      receiptSplitDraft={activeReceiptSplitDraft}
                      onReviewReceiptSplit={() => nav.setAutoOpenReceiptSplit(true)}
                      failedReceiptSplitJob={failedReceiptSplitJob}
                      onReceiptSplitStarted={handleReceiptSplitStarted}
                      onReceiptSplitCleared={clearReceiptSplitJob}
                      onReceiptSplitOpenChange={setIsReceiptSplitOpen}
                      aiEditDraft={aiRouter.state.aiLedgerEditDraft}
                      aiExportRequest={aiRouter.state.aiLedgerExportRequest}
                      onAiEditDraftConsumed={() => aiRouter.dispatch({ aiLedgerEditDraft: null })}
                      onAiExportRequestConsumed={() => aiRouter.dispatch({ aiLedgerExportRequest: null })}
                    />
                  )}

                  {prefs.activeTab === 'wishlist' && (
                    <CommitmentsRewardsView
                      wishlist={financial.allWishlist}
                      savingsGoals={financial.allSavingsGoals}
                      rewardsBalance={wishlistRewardsBalance}
                      pendingRewardsDeduction={wishlistPendingRewardsDeduction}
                      essentialsBalance={wishlistDashboardData?.categories?.find(c => c.name === 'Essentials')?.remaining ?? 0}
                      pendingEssentialsDeduction={wishlistPendingEssentialsDeduction}
                      essentialsTarget={wishlistDashboardData?.categories?.find(c => c.name === 'Essentials')?.target ?? 0}
                      rewardsTarget={wishlistDashboardData?.categories?.find(c => c.name === 'Rewards')?.target ?? 400}
                      pastThreeMonthsRewardsAverage={wishlistDashboardData?.stats?.pastThreeMonthsRewardsAverage ?? 0}
                      hasRewardsHistory={wishlistDashboardData?.stats?.hasRewardsHistory ?? false}
                      onAddItem={financial.handleAddWishlistItem}
                      onUpdateItem={financial.handleUpdateWishlistItem}
                      onDeleteItem={financial.requestDeleteWishlistItem}
                      onPurchaseItem={financial.handlePurchaseWishlistItem}
                      onAddGoal={financial.handleAddSavingsGoal}
                      onUpdateGoal={financial.handleUpdateSavingsGoal}
                      onDeleteGoal={financial.requestDeleteSavingsGoal}
                      onCompleteGoal={financial.requestCompleteSavingsGoal}
                      onContributeToGoal={financial.handleContributeToSavingsGoal}
                      onFundGoalsForCycle={financial.handleFundSavingsGoalsForCycle}
                      isOffline={financial.isOffline}
                      autoOpenAddModal={nav.autoOpenWishlistAdd}
                      onResetAutoOpen={() => nav.setAutoOpenWishlistAdd(false)}
                      onNavigateToLedger={nav.handleNavigateToLedger}
                      cycleDay={financial.optimisticDashboardData?.setting?.cycleDay || 28}
                      // The pool skeleton also covers "the current cycle's figures are not here
                      // yet". Without it, browsing a past cycle and opening Rewards divided the
                      // *selected* cycle's balance among today's earmarks — wrong free-to-spend,
                      // wrong affordability, and a Set aside button acting on other numbers than
                      // the ones on screen.
                      isSwitchingCycle={nav.isSwitchingCycle || isWishlistCycleStale}
                      onStartEditPending={financial.setEditingPendingId}
                      aiDraft={aiRouter.state.aiWishlistDraft}
                      aiEditDraft={aiRouter.state.aiWishlistEditDraft}
                      onAiDraftConsumed={() => aiRouter.dispatch({ aiWishlistDraft: null })}
                      onAiEditDraftConsumed={() => aiRouter.dispatch({ aiWishlistEditDraft: null })}
                      aiSavingsGoalDraft={aiRouter.state.aiSavingsGoalDraft}
                      aiSavingsGoalEditDraft={aiRouter.state.aiSavingsGoalEditDraft}
                      onAiSavingsGoalDraftConsumed={() => aiRouter.dispatch({ aiSavingsGoalDraft: null })}
                      onAiSavingsGoalEditDraftConsumed={() => aiRouter.dispatch({ aiSavingsGoalEditDraft: null })}
                      onExplainWithAi={() => onExplainWithAi({
                        surface: 'wishlist',
                        preset: 'rewards-plan',
                        hasPendingLocalChanges: financial.pendingOps.length > 0 || financial.failedOps.length > 0 ||
                          financial.draftTransactions.length > 0 || financial.activeSyncId != null,
                      }, 'Explain my plan')}
                    />
                  )}

                  {prefs.activeTab === 'drafts' && financial.draftTransactions.length > 0 && (
                    <DraftStagingView 
                      draftTransactions={financial.draftTransactions}
                      categories={financial.allCategories}
                      onUpdateDraftTransaction={financial.handleUpdateDraftTransaction}
                      onLoadDraftDocumentChanges={financial.loadDraftTransactionDocumentChanges}
                      onDeleteDraftTransaction={financial.requestDeleteDraftTransaction}
                      onSyncDraftBatch={financial.handleSyncDraftBatch}
                      hideSensitive={prefs.hideSensitive}
                      currency={financial.optimisticDashboardData?.setting?.currency || 'USD'}
                      onCancel={() => prefs.setActiveTab('ledger')}
                      onAddAnother={() => {
                        prefs.setActiveTab('ledger')
                        nav.setAutoOpenLedgerAdd(true)
                      }}
                      editorProps={{
                        autocompleteSuggestions: financial.autocompleteSuggestions,
                        transactions: financial.allTransactions,
                        accounts: financial.allAccounts,
                        essentialsAlloc: financial.optimisticDashboardData?.setting?.essentialsAlloc ?? 0.5,
                        growthAlloc: financial.optimisticDashboardData?.setting?.growthAlloc ?? 0.25,
                        stabilityAlloc: financial.optimisticDashboardData?.setting?.stabilityAlloc ?? 0.15,
                        rewardsAlloc: financial.optimisticDashboardData?.setting?.rewardsAlloc ?? 0.1,
                        stabilityBalance: financial.optimisticDashboardData?.categories?.find(c => c.name === 'Stability')?.remaining ?? 0,
                        stabilityTarget: financial.optimisticDashboardData?.setting?.targetStabilityFund ?? 10000,
                        stabilityOverflowRedirect: financial.optimisticDashboardData?.setting?.stabilityOverflowRedirect || '',
                        stabilityRecovery: isSelectedCycleCurrent ? financial.optimisticDashboardData?.stabilityRecovery : undefined,
                        essentialsBalance: financial.optimisticDashboardData?.categories?.find(c => c.name === 'Essentials')?.remaining ?? 0,
                        growthBalance: financial.optimisticDashboardData?.categories?.find(c => c.name === 'Growth')?.remaining ?? 0,
                        rewardsBalance: financial.optimisticDashboardData?.categories?.find(c => c.name === 'Rewards')?.remaining ?? 0,
                        onAddFormOpenChange: setIsLedgerAddOpen,
                        receiptScanDraft: activeReceiptScanDraft,
                        onReceiptScanStarted: handleReceiptScanStarted,
                        onReceiptScanCleared: clearReceiptScanJob,
                        activeScanJobIds: receiptScanJobIds,
                        failedScanJob,
                        onShowAlert: alert,
                        receiptSplitDraft: activeReceiptSplitDraft,
                        failedReceiptSplitJob,
                        onReceiptSplitStarted: handleReceiptSplitStarted,
                        onReceiptSplitCleared: clearReceiptSplitJob,
                        onReceiptSplitOpenChange: setIsReceiptSplitOpen,
                      }}
                    />
                  )}

                  {prefs.activeTab === 'investments' && (
                    <InvestmentsView
                      onNavigate={prefs.setActiveTab}
                      autoOpenAddForm={autoOpenInvestmentAdd}
                      onResetAutoOpen={() => setAutoOpenInvestmentAdd(false)}
                      onAddFormOpenChange={setIsInvestmentAddOpen}
                      investmentScanDraft={activeInvestmentScanDraft}
                      failedScanJob={failedInvestmentScanJob}
                      activeScanJobIds={investmentScanJobIds}
                      onInvestmentScanStarted={handleInvestmentScanStarted}
                      onInvestmentScanCleared={clearInvestmentScanJob}
                      onExplainWithAi={range => onExplainWithAi({
                        surface: 'investments',
                        preset: 'investment-explain',
                        investmentRange: range,
                        hasPendingLocalChanges: financial.pendingOps.length > 0 || financial.failedOps.length > 0 ||
                          financial.draftTransactions.length > 0 || financial.activeSyncId != null,
                      }, 'Explain my portfolio')}
                    />
                  )}

                  {prefs.activeTab === 'documents' && (
                    <DocumentsView onNavigateToTransaction={openLinkedVaultTransaction} />
                  )}
                </div>
              </LaunchReady>
            </Suspense>
          </ErrorBoundary>
        </main>
      </PullToRefresh>
    </>
  )
}
