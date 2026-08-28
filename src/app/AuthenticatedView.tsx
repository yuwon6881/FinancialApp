import { lazy, Suspense, type Dispatch, type SetStateAction } from 'react'
import type { AppTab, DashboardData } from '../types'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { PullToRefresh } from '../components/ui/PullToRefresh'
import { PageContainer } from '../components/ui/PageContainer'
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
import { MONTH_NAMES } from '../lib/cycle'
import { buildStabilityPlanPoints } from '../lib/stabilityRecovery'
import { projectFinancialSetting } from '../lib/outbox'
import { getTransactionCyclePlacement } from '../lib/transactionCyclePlacement'
import { openLedgerTransaction } from '../lib/openLedgerTransaction'
import type { AiInvocationContext } from '../lib/api/ai'
import { AuthenticatedTabContent } from './AuthenticatedTabContent'

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
}: AuthenticatedViewProps) {
  const handleOutsideCycleSave = (date: string) => {
    const cycleDay = financial.optimisticDashboardData?.setting?.cycleDay || 28
    const placement = getTransactionCyclePlacement(date, cycleDay)
    if (!placement) return
    dialogs.showToast(
      `This transaction's posting date belongs to ${placement.label}.`,
      'Saved in another cycle',
      'info',
      {
        label: 'View cycle',
        onAction: () => nav.handleNavigateToLedger({
          targetMonth: placement.month,
          targetYear: placement.year,
        }),
      },
    )
  }

  const unsyncedChangeCount = financial.pendingOps.length + financial.failedOps.length + (financial.activeSyncId ? 1 : 0)
  const draftCount = financial.draftTransactions.length
  const hasPendingLocalChanges = unsyncedChangeCount > 0 || draftCount > 0

  const currentCycleMonthIndex = MONTH_NAMES.indexOf(currentCycleMonth) + 1
  const currentCycleKey = currentCycleYear && currentCycleMonthIndex > 0
    ? `${currentCycleYear}-${String(currentCycleMonthIndex).padStart(2, '0')}`
    : undefined
  const stabilityPlanPoints = todayDashboardData?.setting
    ? buildStabilityPlanPoints(
        todayDashboardData.stabilityRecovery?.target ?? todayDashboardData.setting.targetStabilityFund,
        todayDashboardData.setting.stabilityAlloc,
        financial.activeOps
          .filter(operation => operation.entity === 'settings' && operation.type === 'update')
          .map(operation => ({ createdAt: operation.createdAt, payload: operation.payload as Record<string, unknown> | undefined })),
      )
    : undefined

  const todayPlanSetting = todayDashboardData?.setting
    ? projectFinancialSetting(todayDashboardData.setting, financial.activeOps)
    : undefined
  const stabilityTopUpContext = todayDashboardData?.stabilityRecovery && todayPlanSetting && currentCycleMonthIndex > 0
    ? {
        recovery: todayDashboardData.stabilityRecovery,
        cycleYear: currentCycleYear,
        cycleMonthIndex: currentCycleMonthIndex,
        cycleDay: todayPlanSetting.cycleDay,
        essentialsAlloc: todayPlanSetting.essentialsAlloc,
        growthAlloc: todayPlanSetting.growthAlloc,
        stabilityAlloc: todayPlanSetting.stabilityAlloc,
        rewardsAlloc: todayPlanSetting.rewardsAlloc,
        essentialsBalance: todayDashboardData.categories.find(category => category.name === 'Essentials')?.remaining ?? 0,
        growthBalance: todayDashboardData.categories.find(category => category.name === 'Growth')?.remaining ?? 0,
        rewardsBalance: todayDashboardData.categories.find(category => category.name === 'Rewards')?.remaining ?? 0,
        stabilityOverflowRedirect: todayPlanSetting.stabilityOverflowRedirect || '',
        planPoints: stabilityPlanPoints,
        currentCycleKey,
      }
    : undefined

  const openLinkedVaultTransaction = async (transactionId: string) => {
    const cannotOpen = (message: string) => dialogs.showToast(message, 'Linked transaction', 'warning')
    const opened = await openLedgerTransaction({
      transactionId,
      transactions: financial.allTransactions,
      cycleDay: financial.optimisticDashboardData?.setting?.cycleDay || 28,
      fetchTransactionById: apiClient.fetchTransactionById,
      navigate: nav.handleNavigateToLedger,
    })
    if (!opened) {
      cannotOpen('The transaction this document was attached to could not be opened. It may have been deleted.')
    }
  }

  return (
    <>
      <a href="#main-content" className="sr-only fixed left-4 top-4 z-[100] rounded-lg bg-card px-3 py-2 text-sm font-bold text-foreground shadow-lg focus:not-sr-only">
        Skip to main content
      </a>
      <PullToRefresh
        onRefresh={() => financial.loadAll(nav.selectedMonth || undefined, nav.selectedYear || undefined, true)}
        disabled={financial.loading || session.isLocked}
      >
        <PageContainer
          as="main"
          id="main-content"
          className={`${shouldShowMobileFab(prefs.activeTab) ? 'pb-fab-safe' : 'pb-nav-safe'} relative flex-1 overflow-x-clip py-6 sm:py-8 sm:ml-20 sm:max-w-[calc(100%-5rem)] lg:ml-56 lg:max-w-[calc(100%-14rem)] 2xl:mx-auto 2xl:max-w-[1440px]`}
          aria-busy={prefs.sensitivePreferenceStatus === 'pending' || financial.loading}
        >
          <ErrorBoundary variant="inline" resetKey={prefs.activeTab}>
            <Suspense fallback={<ContentViewFallback tab={prefs.activeTab} />}>
              <LaunchReady>
                <AuthenticatedTabContent
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
                  apiClient={apiClient}
                  todayDashboardData={todayDashboardData}
                  wishlistDashboardData={wishlistDashboardData}
                  wishlistRewardsBalance={wishlistRewardsBalance}
                  wishlistPendingRewardsDeduction={wishlistPendingRewardsDeduction}
                  wishlistPendingEssentialsDeduction={wishlistPendingEssentialsDeduction}
                  isWishlistCycleStale={isWishlistCycleStale}
                  currentPendingNotificationsCount={currentPendingNotificationsCount}
                  currentCycleMonth={currentCycleMonth}
                  currentCycleYear={currentCycleYear}
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
                  onExplainWithAi={onExplainWithAi}
                  stabilityTopUpContext={stabilityTopUpContext}
                  hasPendingLocalChanges={hasPendingLocalChanges}
                  unsyncedChangeCount={unsyncedChangeCount}
                  draftCount={draftCount}
                  handleOutsideCycleSave={handleOutsideCycleSave}
                  openLinkedVaultTransaction={openLinkedVaultTransaction}
                />
              </LaunchReady>
            </Suspense>
          </ErrorBoundary>
        </PageContainer>
      </PullToRefresh>
    </>
  )
}
