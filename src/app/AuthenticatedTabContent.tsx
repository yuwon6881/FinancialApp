import { lazy, Suspense, type Dispatch, type SetStateAction } from 'react'
import type { DashboardData } from '../types'
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
import type { AiInvocationContext } from '../lib/api/ai'
import { AuthenticatedSettingsRoute } from './AuthenticatedSettingsRoute'
// Lazy like the views it sits above: the picker's select control is not part of the eager
// critical path, and the pages that need it are lazily loaded anyway.
const CycleSwitcher = lazy(() => import('../components/ui/CycleSwitcher').then(module => ({ default: module.CycleSwitcher })))

/** Tabs whose figures are read from the selected financial cycle rather than from today. */
const CYCLE_DEPENDENT_TABS = ['ledger', 'reports', 'recurring'] as const

const DashboardView = lazy(() => import('../components/DashboardView').then(module => ({ default: module.DashboardView })))
const ReportsView = lazy(() => import('../components/ReportsView').then(module => ({ default: module.ReportsView })))
const RecurringPaymentsView = lazy(() => import('../components/RecurringPaymentsView').then(module => ({ default: module.RecurringPaymentsView })))
const LedgerView = lazy(() => import('../components/LedgerView').then(module => ({ default: module.LedgerView })))
const CommitmentsRewardsView = lazy(() => import('../components/CommitmentsRewardsView').then(module => ({ default: module.CommitmentsRewardsView })))
const DraftStagingView = lazy(() => import('../components/DraftStagingView').then(module => ({ default: module.DraftStagingView })))
const InvestmentsView = lazy(() => import('../components/InvestmentsView').then(module => ({ default: module.InvestmentsView })))
const DocumentsView = lazy(() => import('../components/DocumentsView').then(module => ({ default: module.DocumentsView })))

export interface AuthenticatedTabContentProps {
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
  isWishlistCycleStale: boolean
  currentPendingNotificationsCount: number
  currentCycleMonth: string
  currentCycleYear: number
  isCurrentCycle: boolean
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
  stabilityTopUpContext: any
  hasPendingLocalChanges: boolean
  unsyncedChangeCount: number
  draftCount: number
  handleOutsideCycleSave: (date: string) => void
  openLinkedVaultTransaction: (transactionId: string) => Promise<void>
}

export function AuthenticatedTabContent({
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
  isCurrentCycle,
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
  stabilityTopUpContext,
  hasPendingLocalChanges,
  unsyncedChangeCount,
  draftCount,
  handleOutsideCycleSave,
  openLinkedVaultTransaction,
}: AuthenticatedTabContentProps) {
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

  const cycleDay = financial.optimisticDashboardData?.setting?.cycleDay || 28
  // The Ledger's all-cycles scope spans every saved cycle, so a single-cycle picker would claim
  // to filter rows it does not reach; its own scope toggle is the way back to one cycle.
  const ledgerSpansAllCycles = prefs.activeTab === 'ledger'
    && nav.ledgerShowAllCycles
    && prefs.ledgerCyclesRange === 'all'
  const showCycleSwitcher = (CYCLE_DEPENDENT_TABS as readonly string[]).includes(prefs.activeTab)
    && !ledgerSpansAllCycles

  return (
    <div key={prefs.activeTab} className="w-full view-enter">
      {showCycleSwitcher && (
        <Suspense fallback={<div className="mb-4 h-[60px] rounded-2xl border border-border/60 bg-card/92 sm:h-[68px]" aria-hidden />}>
        <div className="mb-4">
          <CycleSwitcher
            selectedMonth={nav.selectedMonth}
            selectedYear={nav.selectedYear}
            availableYears={financial.optimisticDashboardData?.availableYears || [nav.selectedYear]}
            cycleDay={cycleDay}
            onSelectPeriod={nav.handleSelectPeriod}
            currentCycleMonth={currentCycleMonth}
            currentCycleYear={currentCycleYear}
            periodMode={prefs.activeTab === 'ledger' && nav.ledgerShowAllCycles && prefs.ledgerCyclesRange === 'yearly'
              ? 'year'
              : 'month-year'}
            surfaceLabel={prefs.activeTab === 'ledger' ? 'Ledger' : prefs.activeTab === 'reports' ? 'Report' : 'Recurring'}
            disabled={nav.isSwitchingCycle}
          />
        </div>
        </Suspense>
      )}
      {prefs.activeTab === 'dashboard' && (
        <DashboardView
          dashboardData={todayDashboardData}
          onNavigate={prefs.setActiveTab}
          hideBalanceAmounts={prefs.hideFinancialFigures}
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
          onNavigateToCategoryLimits={category => nav.handleNavigateToReportSection('category-limits', category)}
          onNavigateToTransfer={() => {
            prefs.setActiveTab('ledger')
            nav.setAutoOpenLedgerAdd(true)
            nav.setAutoOpenLedgerTxType('transfer')
          }}
          onNavigateToRecurring={nav.handleNavigateToRecurring}
        />
      )}

      {prefs.activeTab === 'reports' && (
        <ReportsView
          dashboardData={financial.optimisticDashboardData}
          transactions={financial.allTransactions}
          wishlist={financial.allWishlist}
          savingsGoals={financial.allSavingsGoals}
          hideBalanceAmounts={prefs.maskPassiveFinancialFigures}
          onNavigate={prefs.setActiveTab}
          onNavigateToRecurring={nav.handleNavigateToRecurring}
          onNavigateToAccounts={nav.handleNavigateToAccounts}
          onNavigateToLedger={nav.handleNavigateToLedger}
          isCurrentCycle={isCurrentCycle}
          isSwitchingCycle={nav.isSwitchingCycle}
          highlightedSection={nav.highlightedReportSection}
          highlightedCategory={nav.highlightedReportCategory}
          onClearHighlightedSection={nav.clearHighlightedReportSection}
          onViewCycleSummary={cycleSummary.openManual}
          onExplainWithAi={cycleKey => onExplainWithAi({
            surface: 'reports',
            preset: 'report-review',
            cycleKey,
            hasPendingLocalChanges,
          }, 'Explain this cycle')}
        />
      )}

      {prefs.activeTab === 'settings' && (
        <AuthenticatedSettingsRoute
          investmentAllocation={investmentAllocation}
          prefs={prefs}
          financial={financial}
          nav={nav}
          session={session}
          dialogs={dialogs}
          push={push}
          isCurrentCycle={isCurrentCycle}
          handleToggleDarkMode={handleToggleDarkMode}
          handleToggleHideSensitive={handleToggleHideSensitive}
          hasPendingLocalChanges={hasPendingLocalChanges}
          unsyncedChangeCount={unsyncedChangeCount}
          draftCount={draftCount}
        />
      )}

      {prefs.activeTab === 'recurring' && (
        <RecurringPaymentsView 
          payments={financial.allRecurringPayments}
          accounts={financial.allAccounts}
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
          highlightedLoanId={nav.highlightedLoanId}
          onClearHighlightedLoan={nav.clearHighlightedLoan}
          globalPushEnabled={push.billRemindersEnabled || push.otherDevicesBillReminders}
          thisDevicePushEnabled={push.billRemindersEnabled}
          onUpdateReminder={financial.handleUpdateReminder}
          onRequestPayEarly={financial.requestPayEarly}
          onPayEarly={financial.handlePayEarly}
          loans={financial.allLoans}
          onAddLoan={financial.handleAddLoan}
          onUpdateLoan={financial.handleUpdateLoan}
          onRequestDeleteLoan={financial.requestDeleteLoan}
          onAdvanceRepayment={financial.handleAdvanceRepayment}
          onFullSettlement={financial.handleFullSettlement}
          onUndoRepayment={financial.handleUndoRepayment}
          loanLoadStatus={financial.loanLoadStatus}
          hasLoadedLoans={financial.hasLoadedLoans}
          onLoadLoans={financial.loadLoans}
          onExplainLoan={loan => onExplainWithAi({
            surface: 'recurring',
            preset: 'loan-explain',
            loanId: loan.id,
            hasPendingLocalChanges,
          }, 'Explain this loan')}
          aiDraft={aiRouter.state.aiRecurringDraft}
          aiEditDraft={aiRouter.state.aiRecurringEditDraft}
          onAiDraftConsumed={() => aiRouter.dispatch({ aiRecurringDraft: null })}
          onAiEditDraftConsumed={() => aiRouter.dispatch({ aiRecurringEditDraft: null })}
        />
      )}

      {prefs.activeTab === 'ledger' && (
        <LedgerView 
          maskFinancialFigures={prefs.maskPassiveFinancialFigures}
          transactions={financial.allTransactions}
          accounts={financial.allAccounts}
          autocompleteSuggestions={financial.autocompleteSuggestions}
          onAddTransaction={(tx, documents) => financial.handleAddTransaction(tx, prefs.setActiveTab, documents)}
          onDeleteTransaction={financial.handleDeleteTransaction}
          onUpdateTransaction={financial.handleUpdateTransaction}
          onOutsideCycleSave={handleOutsideCycleSave}
          categories={financial.allCategories}
          selectedMonth={nav.selectedMonth}
          selectedYear={nav.selectedYear}
          isCurrentCycle={isCurrentCycle}
          cycleDay={financial.optimisticDashboardData?.setting?.cycleDay || 28}
          incomingCategory={nav.ledgerIncomingFilters[0] || null}
          incomingFilters={nav.ledgerIncomingFilters}
          incomingSearch={nav.ledgerIncomingSearch}
          incomingSearchMode={nav.ledgerIncomingSearchMode}
          incomingStartDate={nav.ledgerIncomingStartDate}
          incomingEndDate={nav.ledgerIncomingEndDate}
          incomingMinAmount={nav.ledgerIncomingMinAmount}
          incomingMaxAmount={nav.ledgerIncomingMaxAmount}
          incomingRecurringFilter={nav.ledgerIncomingRecurringFilter}
          incomingWishlistFilter={nav.ledgerIncomingWishlistFilter}
          incomingReloadFilter={nav.ledgerIncomingReloadFilter}
          incomingTxType={nav.ledgerIncomingTxType}
          highlightedTxId={nav.highlightedTxId}
          onClearIncomingFilters={nav.clearIncomingFilters}
          onClearHighlightedTx={nav.clearHighlightedTx}
          showAllCycles={nav.ledgerShowAllCycles}
          onShowAllCyclesChange={(showAllCycles) => {
            nav.setLedgerShowAllCycles(showAllCycles)
            prefs.setLedgerCyclesRange(showAllCycles ? 'all' : 'monthly')
          }}
          cyclesRange={prefs.ledgerCyclesRange}
          preferredPageSize={prefs.ledgerPageSize}
          preferredSortOrder={prefs.ledgerSortOrder}
          onPreferredPageSizeChange={prefs.setLedgerPageSize}
          onPreferredSortOrderChange={prefs.setLedgerSortOrder}
          onRouteStateChange={nav.syncLedgerRouteState}
          ledgerSummaries={todayDashboardData?.categories}
          savingsGoals={financial.allSavingsGoals}
          activeRecurringPayments={todayDashboardData?.activeRecurringPayments}
          autoOpenAddForm={nav.autoOpenLedgerAdd}
          autoOpenTxType={nav.autoOpenLedgerTxType}
          autoOpenPrefill={nav.autoOpenLedgerPrefill}
          onResetAutoOpen={() => {
            nav.setAutoOpenLedgerAdd(false)
            nav.setAutoOpenLedgerTxType(null)
            nav.setAutoOpenLedgerPrefill(null)
          }}
          stabilityBalance={financial.optimisticDashboardData?.categories?.find(c => c.name === 'Stability')?.remaining ?? 0}
          isSwitchingCycle={nav.isSwitchingCycle}
          stabilityTarget={financial.optimisticDashboardData?.setting?.targetStabilityFund ?? 10000}
          essentialsAlloc={financial.optimisticDashboardData?.setting?.essentialsAlloc ?? 0.5}
          growthAlloc={financial.optimisticDashboardData?.setting?.growthAlloc ?? 0.25}
          stabilityAlloc={financial.optimisticDashboardData?.setting?.stabilityAlloc ?? 0.15}
          rewardsAlloc={financial.optimisticDashboardData?.setting?.rewardsAlloc ?? 0.1}
          stabilityOverflowRedirect={financial.optimisticDashboardData?.setting?.stabilityOverflowRedirect}
          stabilityTopUpContext={stabilityTopUpContext}
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
          accounts={financial.allAccounts}
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
          isSwitchingCycle={nav.isSwitchingCycle || isWishlistCycleStale}
          highlightedCommitmentId={nav.highlightedCommitmentId}
          highlightedRewardId={nav.highlightedRewardId}
          onClearHighlightedCommitment={nav.clearHighlightedCommitment}
          onClearHighlightedReward={nav.clearHighlightedReward}
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
            hasPendingLocalChanges,
          }, 'Explain my plan')}
        />
      )}

      {prefs.activeTab === 'drafts' && (
        <DraftStagingView 
          draftTransactions={financial.draftTransactions}
          highlightedDraftId={nav.highlightedDraftId}
          onClearHighlightedDraft={nav.clearHighlightedDraft}
          categories={financial.allCategories}
          onUpdateDraftTransaction={financial.handleUpdateDraftTransaction}
          onLoadDraftDocumentChanges={financial.loadDraftTransactionDocumentChanges}
          onDeleteDraftTransaction={financial.requestDeleteDraftTransaction}
          onReorderDraftTransactions={financial.setDraftTransactions}
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
            cycleDay: financial.optimisticDashboardData?.setting?.cycleDay || 28,
            selectedMonth: nav.selectedMonth,
            selectedYear: nav.selectedYear,
            stabilityBalance: financial.optimisticDashboardData?.categories?.find(c => c.name === 'Stability')?.remaining ?? 0,
            stabilityTarget: financial.optimisticDashboardData?.setting?.targetStabilityFund ?? 10000,
            stabilityOverflowRedirect: financial.optimisticDashboardData?.setting?.stabilityOverflowRedirect || '',
            stabilityTopUpContext,
            onAddFormOpenChange: setIsLedgerAddOpen,
            receiptScanDraft: activeReceiptScanDraft,
            onReceiptScanStarted: handleReceiptScanStarted,
            onReceiptScanCleared: clearReceiptScanJob,
            activeScanJobIds: receiptScanJobIds,
            failedScanJob,
            onShowAlert: alert,
            onOutsideCycleSave: handleOutsideCycleSave,
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
            hasPendingLocalChanges,
          }, 'Explain my portfolio')}
        />
      )}

      {prefs.activeTab === 'documents' && (
        <DocumentsView onNavigateToTransaction={openLinkedVaultTransaction} />
      )}
    </div>
  )
}
