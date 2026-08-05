import { lazy, Suspense, type Dispatch, type SetStateAction } from 'react'
import type { AppTab, DashboardData } from '../types'
import { clearLocalFinancialData } from '../lib/cache'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { PullToRefresh } from '../components/ui/PullToRefresh'
import { CycleSkeleton, type PageSkeletonVariant } from '../components/ui/Skeleton'
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
const WishlistView = lazy(() => import('../components/WishlistView').then(module => ({ default: module.WishlistView })))
const SettingsView = lazy(() => import('../components/SettingsView').then(module => ({ default: module.SettingsView })))
const DraftStagingView = lazy(() => import('../components/DraftStagingView').then(module => ({ default: module.DraftStagingView })))
const InvestmentsView = lazy(() => import('../components/InvestmentsView').then(module => ({ default: module.InvestmentsView })))
const DocumentsView = lazy(() => import('../components/DocumentsView').then(module => ({ default: module.DocumentsView })))

const getPageSkeletonVariant = (tab: AppTab): PageSkeletonVariant => tab

const ContentViewFallback = ({ tab }: { tab: AppTab }) => (
  <div className="w-full pt-2 view-enter">
    <CycleSkeleton variant={getPageSkeletonVariant(tab)} fullPage />
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
  const {
    activeInvestmentScanDraft,
    failedInvestmentScanJob,
    investmentScanJobIds,
    handleInvestmentScanStarted,
    clearInvestmentScanJob,
  } = investmentScan

  const openLinkedVaultTransaction = async (transactionId: string) => {
    try {
      const transaction = await apiClient.fetchTransactionById(transactionId)
      const match = /^(\d{4})-(\d{2})-/.exec(transaction.date)
      if (!match) {
        alert('The linked transaction date is invalid.')
        return
      }
      const monthIndex = Number(match[2]) - 1
      const day = Number(transaction.date.slice(8, 10))
      if (monthIndex < 0 || monthIndex >= MONTH_NAMES.length || day < 1 || day > 31) {
        alert('The linked transaction date is invalid.')
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
      alert('The linked ledger transaction could not be opened.')
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
          className="relative mx-auto w-full min-w-0 max-w-[1440px] flex-1 overflow-x-clip px-4 py-6 pb-24 sm:px-6 sm:py-8 md:pb-8 lg:px-8"
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
                      walletBalance={financial.totalBalance}
                      onToggleBalanceAmounts={handleToggleBalanceAmounts}
                      pendingNotificationCount={currentPendingNotificationsCount}
                      onOpenNotifications={() => dialogs.setShowLoginModal(true)}
                      onNavigateToLedger={options => nav.handleNavigateToLedger({
                        ...options,
                        targetMonth: currentCycleMonth,
                        targetYear: currentCycleYear,
                      })}
                      wishlist={financial.allWishlist}
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
                        hasPendingLocalChanges: financial.pendingOps.length > 0,
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
                      onDeleteCategory={financial.requestDeleteCategory}
                      onApplyCategoryCleanupSuggestion={financial.handleApplyCategoryCleanupSuggestion}
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
                      globalPushEnabled={push.accountEnabled}
                      onUpdateReminder={financial.handleUpdateReminder}
                      onRequestPayEarly={financial.requestPayEarly}
                      aiDraft={aiRouter.state.aiRecurringDraft}
                      aiEditDraft={aiRouter.state.aiRecurringEditDraft}
                      onAiDraftConsumed={() => aiRouter.dispatch({ aiRecurringDraft: null })}
                      onAiEditDraftConsumed={() => aiRouter.dispatch({ aiRecurringEditDraft: null })}
                    />
                  )}

                  {prefs.activeTab === 'ledger' && (
                    <LedgerView 
                      transactions={financial.allTransactions}
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
                      incomingRecurringOnly={nav.ledgerIncomingRecurringOnly}
                      incomingWishlistOnly={nav.ledgerIncomingWishlistOnly}
                      incomingTxType={nav.ledgerIncomingTxType}
                      highlightedTxId={nav.highlightedTxId}
                      onClearIncomingFilters={nav.clearIncomingFilters}
                      onClearHighlightedTx={nav.clearHighlightedTx}
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
                      onFetchPagedTransactions={apiClient.fetchPagedTransactions}
                      onFetchTransactionById={apiClient.fetchTransactionById}
                      onExportTransactions={apiClient.exportTransactionsCsv}
                      onShowAlert={alert}
                      onStartEditPending={financial.setEditingPendingId}
                      receiptScanDraft={activeReceiptScanDraft}
                      onReceiptScanStarted={handleReceiptScanStarted}
                      onReceiptScanCleared={clearReceiptScanJob}
                      onAddFormOpenChange={setIsLedgerAddOpen}
                      activeScanJobIds={receiptScanJobIds}
                      failedScanJob={failedScanJob}
                      autoOpenReceiptSplit={nav.autoOpenReceiptSplit}
                      onResetAutoOpenReceiptSplit={() => nav.setAutoOpenReceiptSplit(false)}
                      receiptSplitDraft={activeReceiptSplitDraft}
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
                    <WishlistView
                      wishlist={financial.allWishlist}
                      savingsGoals={financial.allSavingsGoals}
                      rewardsBalance={wishlistRewardsBalance}
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
                      isSwitchingCycle={nav.isSwitchingCycle}
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
                        hasPendingLocalChanges: financial.pendingOps.length > 0,
                      }, 'Explain my plan')}
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
                        hasPendingLocalChanges: financial.pendingOps.length > 0,
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
