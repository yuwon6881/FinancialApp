import React from 'react'
import { BellRing, ChevronRight } from 'lucide-react'
import type { AppNavigationOptions, LedgerRouteRange } from '../lib/appLocation'
import type { DashboardData, SavingsGoal, WishlistItem, AppTab, InvestmentAllocationOverview, StabilityReloadFilter } from '../types'
import { CycleSkeleton } from './ui/CycleSkeleton'
import { useAppPrefs } from '../contexts/AppContext'
import { CategoryWatchExceptionCard } from './dashboard/CategoryWatchExceptionCard'
import { useDashboardView } from './dashboard/useDashboardView'
import { Button } from './ui/Button'
import { PageHeader } from './ui/PageHeader'
import { getCycleProgress, MONTH_NAMES } from '../lib/cycle'
import { evaluateEssentialsChallenge } from '../lib/essentialsChallenge'
import { EssentialsChallengeCard } from './dashboard/EssentialsChallengeCard'
import { InvestmentPlanExceptionCard } from './dashboard/InvestmentPlanExceptionCard'
import { StabilityRecoveryExceptionCard } from './dashboard/StabilityRecoveryExceptionCard'
import { RecurringAccountShortfallCard } from './dashboard/RecurringAccountShortfallCard'
import { NoticeCard } from './dashboard/NoticeCard'
import { TodayHero } from './dashboard/TodayHero'
import { PlanSnapshot } from './dashboard/PlanSnapshot'
import { RewardGoalCard } from './dashboard/RewardGoalCard'
import { UpcomingBills } from './dashboard/UpcomingBills'
import { getDocumentRetentionReview } from '../lib/api/documents'
import { EMPTY_RETENTION_REVIEW } from '../lib/documentRetention'
import { VaultRetentionNotice } from './documents/VaultRetentionNotice'
import type { DocumentRetentionReview } from '../types'

interface DashboardViewProps {
  dashboardData: DashboardData | null
  onNavigate: (tab: AppTab, options?: AppNavigationOptions) => void
  hideSensitive?: boolean
  hideBalanceAmounts: boolean
  onToggleBalanceAmounts: () => void
  pendingNotificationCount: number
  onOpenNotifications: () => void
  onNavigateToLedger?: (options: {
    category?: string | null;
    date?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    txType?: 'inflow' | 'outflow' | null;
    range?: LedgerRouteRange;
    highlightedTxId?: string | null;
    showAllCycles?: boolean;
    reloadFilter?: StabilityReloadFilter;
  }) => void
  wishlist?: WishlistItem[]
  savingsGoals?: SavingsGoal[]
  isSwitchingCycle?: boolean
  investmentAllocation?: InvestmentAllocationOverview | null
  /** Opens Reports focused on the category limit breakdown and, when supplied, its category card. */
  onNavigateToCategoryLimits?: (category: string) => void
  onNavigateToTransfer?: () => void
  onNavigateToRecurring?: (recurringId: string) => void
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  dashboardData,
  onNavigate,
  hideSensitive: hideSensitiveProp,
  hideBalanceAmounts,
  onToggleBalanceAmounts,
  pendingNotificationCount,
  onOpenNotifications,
  onNavigateToLedger,
  wishlist = [],
  savingsGoals = [],
  isSwitchingCycle = false,
  investmentAllocation = null,
  onNavigateToCategoryLimits,
  onNavigateToTransfer,
  onNavigateToRecurring,
}) => {
  const [retentionReview, setRetentionReview] = React.useState<DocumentRetentionReview>(EMPTY_RETENTION_REVIEW)
  React.useEffect(() => {
    void getDocumentRetentionReview().then(setRetentionReview).catch(() => setRetentionReview(EMPTY_RETENTION_REVIEW))
  }, [])
  const { hideSensitive: contextHideSensitive } = useAppPrefs()
  const hideSensitive = hideSensitiveProp ?? contextHideSensitive

  const view = useDashboardView({
    dashboardData,
    wishlist,
    savingsGoals,
    hideSensitive,
    hideBalanceAmounts,
  })

  const cycleProgress = React.useMemo(() => {
    const monthIndex = MONTH_NAMES.indexOf(view.activeSettings.selectedMonth) + 1
    const safeMonthIndex = monthIndex > 0 ? monthIndex : new Date().getMonth() + 1
    return getCycleProgress(view.activeSettings.selectedYear || new Date().getFullYear(), safeMonthIndex, view.activeSettings.cycleDay || 28)
  }, [view.activeSettings.cycleDay, view.activeSettings.selectedMonth, view.activeSettings.selectedYear])
  // One evaluation feeds both the challenge card and the plan snapshot's daily figures, so Today
  // cannot quote two different allowances for the same money.
  const challenge = React.useMemo(() => evaluateEssentialsChallenge({
    totalAvailable: view.essentialsMetric.totalAvailable,
    projectedRemaining: view.essentialsMetric.projectedRemaining,
    projectedEndingBalance: view.todayPlanInsights.projectedEssentialsEndingBalance,
    currentDailyPace: view.todayPlanInsights.nonRecurringEssentialsDailyAverage,
    unpaidRecurringCount: view.todayPlanInsights.unpaidRecurringCount,
    exceededCategoryLimits: view.categoryLimitProgress.filter(item => item.status === 'Exceeded').length,
    cycle: cycleProgress,
  }), [cycleProgress, view.categoryLimitProgress, view.essentialsMetric, view.todayPlanInsights])

  if (isSwitchingCycle) {
    return <CycleSkeleton variant="dashboard" />
  }

  const currency = view.activeSettings.currency || 'USD'
  const openBill = onNavigateToRecurring ?? (() => onNavigate('recurring'))
  const hasSideColumn = Boolean(view.wishlistGoal) || view.activeRecurring.some(payment => payment.status === 'Pending' || payment.status === 'PartiallyPaid')

  return (
    <div className="@container space-y-8">
      <PageHeader
        title="Today"
        description={`Current cycle · ${formatCycleRange(view.cycleLabel)}`}
      />

      <TodayHero
        walletBalance={dashboardData?.stats.totalBalance ?? 0}
        currency={currency}
        isMasked={view.areBalanceAmountsMasked}
        hideBalanceAmounts={hideBalanceAmounts}
        onToggleBalanceAmounts={onToggleBalanceAmounts}
        cycle={cycleProgress}
      />

      {/* Exceptions only, worst first. A clear day draws nothing here -- not even the heading:
          the section hides itself in CSS once none of its notices rendered. */}
      <section aria-labelledby="attention-heading" className="attention-section space-y-3">
        <h2 id="attention-heading" className="flex items-center gap-2 text-section text-foreground">
          <span aria-hidden="true" className="size-2 rounded-full bg-amber-500" />
          Needs attention
        </h2>
        <div className="grid gap-3 @4xl:grid-cols-2 @4xl:[&>*:last-child:nth-child(odd)]:col-span-2">
          <RecurringAccountShortfallCard
            shortfalls={view.recurringAccountShortfalls}
            formatSensitive={view.formatSensitive}
            onTransferMoney={onNavigateToTransfer}
            onNavigateToRecurring={openBill}
          />
          {pendingNotificationCount > 0 && (
            <NoticeCard
              tone="attention"
              icon={<BellRing />}
              titleId="bill-review-heading"
              title={`${pendingNotificationCount} bill${pendingNotificationCount === 1 ? '' : 's'} need review`}
              description="Confirm what was paid so the plan stays true to your accounts."
              actions={(
                <Button variant="primary" size="sm" onClick={onOpenNotifications}>
                  Review bills
                  <ChevronRight className="size-3.5" aria-hidden="true" />
                </Button>
              )}
            />
          )}
          <CategoryWatchExceptionCard
            items={view.categoryLimitProgress}
            formatSensitive={view.formatSensitive}
            isMasked={hideSensitive}
            onOpenCategoryLimits={category => (onNavigateToCategoryLimits ? onNavigateToCategoryLimits(category) : onNavigate('reports'))}
          />
          <StabilityRecoveryExceptionCard
            recovery={dashboardData?.stabilityRecovery}
            formatSensitive={view.formatSensitive}
            isMasked={hideSensitive}
            onNavigateToLedger={onNavigateToLedger}
          />
          <InvestmentPlanExceptionCard allocation={investmentAllocation} onNavigate={onNavigate} />
          <VaultRetentionNotice review={retentionReview} onOpenVault={() => onNavigate('documents')} />
        </div>
      </section>

      <div className="grid gap-8 @4xl:grid-cols-12 @4xl:gap-6">
        <div data-testid="today-plan-grid" className={hasSideColumn ? '@4xl:col-span-8' : '@4xl:col-span-12'}>
          <PlanSnapshot
            currency={currency}
            hideSensitive={hideSensitive}
            cycle={cycleProgress}
            challenge={challenge}
            essentials={view.essentialsMetric}
            stability={view.stabilityMetric}
            insights={view.todayPlanInsights}
            recurring={view.activeRecurring}
            scoreChip={(
              <EssentialsChallengeCard
                challenge={challenge}
                cycle={cycleProgress}
                formatSensitive={view.formatSensitive}
                onReviewEssentials={onNavigateToLedger ? () => onNavigateToLedger({ category: 'Essentials', txType: 'outflow' }) : undefined}
              />
            )}
            onOpenLedger={onNavigateToLedger}
            onOpenBills={() => onNavigate('recurring')}
            onOpenReports={() => onNavigate('reports')}
          />
        </div>

        {hasSideColumn && (
          <div className="grid content-start items-start gap-6 @2xl:grid-cols-2 @4xl:col-span-4 @4xl:grid-cols-1 @4xl:pt-14">
            {view.wishlistGoal && (
              <RewardGoalCard
                goal={view.wishlistGoal}
                currency={currency}
                hideSensitive={hideSensitive}
                onOpen={() => onNavigate('wishlist')}
              />
            )}
            <UpcomingBills
              payments={view.activeRecurring}
              currency={currency}
              hideSensitive={hideSensitive}
              onOpenBill={openBill}
              onOpenAll={() => onNavigate('recurring')}
            />
          </div>
        )}
      </div>
    </div>
  )
}

/** "Jul 28th ~ Aug 27th, 2026" → "Jul 28 – Aug 27, 2026": the ordinals and tilde are the API's. */
function formatCycleRange(label: string): string {
  return label.replace(/(\d+)(st|nd|rd|th)\b/g, '$1').replace(/\s*~\s*/, ' – ')
}
