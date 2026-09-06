import React from 'react'
import type { LedgerRouteRange } from '../lib/appLocation'
import type { DashboardData, SavingsGoal, WishlistItem, AppTab, InvestmentAllocationOverview, StabilityReloadFilter } from '../types'
import { CycleSkeleton } from './ui/CycleSkeleton'
import { useAppPrefs } from '../contexts/AppContext'
import { DashboardHeader } from './dashboard/DashboardHeader'
import { TodayFocusCards } from './dashboard/TodayFocusCards'
import { CategoryWatchExceptionCard } from './dashboard/CategoryWatchExceptionCard'
import { useDashboardView } from './dashboard/useDashboardView'
import { AlertCircle, BarChart3, ChevronRight, ShieldCheck } from 'lucide-react'
import { Button } from './ui/Button'
import { InteractiveCard } from './ui/InteractiveCard'
import { getCycleProgress, MONTH_NAMES } from '../lib/cycle'
import { evaluateEssentialsChallenge } from '../lib/essentialsChallenge'
import { EssentialsChallengeCard } from './dashboard/EssentialsChallengeCard'
import { InvestmentPlanExceptionCard } from './dashboard/InvestmentPlanExceptionCard'
import { StabilityRecoveryExceptionCard } from './dashboard/StabilityRecoveryExceptionCard'
import { RecurringAccountShortfallCard } from './dashboard/RecurringAccountShortfallCard'
import { getDocumentRetentionReview } from '../lib/api/documents'
import { EMPTY_RETENTION_REVIEW } from '../lib/documentRetention'
import { VaultRetentionNotice } from './documents/VaultRetentionNotice'
import { NetWorthCard } from './dashboard/NetWorthCard'
import type { DocumentRetentionReview } from '../types'
import { cn } from '../lib/utils'
import { PANEL_TONES, panelClass } from './ui/panelStyles'

interface DashboardViewProps {
  dashboardData: DashboardData | null
  onNavigate: (tab: AppTab) => void
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
  /** Total balance across all ledger accounts (all 4 buckets). */
  totalAccountBalance?: number
  /** Investment portfolio total value (market + cash). undefined = not loaded/configured */
  investmentValue?: number
  /** Total outstanding loan balance. null = not yet loaded; 0 = no loans */
  loanDebt?: number | null
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
  totalAccountBalance,
  investmentValue,
  loanDebt = null,
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
  const hasEndedCycle = cycleProgress.phase === 'ended'
  const spendDays = challenge.spendDays
  const dailySpendingRoom = challenge.dailyAllowance
  const currentDailyPace = challenge.currentDailyPace
  const paceDifference = challenge.paceDifference

  if (isSwitchingCycle) {
    return <CycleSkeleton variant="dashboard" />
  }

  return (
    <div className="space-y-6">

      <DashboardHeader
        cycleLabel={view.cycleLabel}
        cycleDay={view.activeSettings.cycleDay}
        walletBalance={dashboardData?.stats.totalBalance ?? 0}
        areBalanceAmountsMasked={view.areBalanceAmountsMasked}
        hideSensitive={hideSensitive}
        hideBalanceAmounts={hideBalanceAmounts}
        formatCurrency={view.formatCurrency}
        onToggleBalanceAmounts={onToggleBalanceAmounts}
      />

      {/* Attention panels are exception-only: a clear day should show nothing here rather
          than a card whose whole message is that it has no message. */}
      {pendingNotificationCount > 0 && (
        <section aria-labelledby="attention-heading" className={cn(panelClass, PANEL_TONES.warning, 'p-4 shadow-xs sm:p-5')}>
          <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/25 bg-amber-500/12 text-amber-600 dark:text-amber-400">
                <AlertCircle className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 id="attention-heading" className="text-subsection text-amber-700 dark:text-amber-300">
                  {pendingNotificationCount} bill{pendingNotificationCount === 1 ? '' : 's'} need review
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Confirm paid bills, skip this cycle, or remove subscriptions from one review queue.
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={onOpenNotifications}
              className="w-full justify-center sm:w-auto shrink-0 border-amber-500/30 bg-card/60 text-amber-700 hover:bg-amber-500/10 dark:text-amber-300"
            >
              Review bills
              <ChevronRight className="size-3.5 ml-1" />
            </Button>
          </div>
        </section>
      )}

      <VaultRetentionNotice review={retentionReview} onOpenVault={() => onNavigate('documents')} />

      <InvestmentPlanExceptionCard allocation={investmentAllocation} onNavigate={onNavigate} />

      <CategoryWatchExceptionCard
        items={view.categoryLimitProgress}
        formatSensitive={view.formatSensitive}
        onOpenCategoryLimits={category => (onNavigateToCategoryLimits ? onNavigateToCategoryLimits(category) : onNavigate('reports'))}
      />

      <StabilityRecoveryExceptionCard
        recovery={dashboardData?.stabilityRecovery}
        formatSensitive={view.formatSensitive}
        onNavigateToLedger={onNavigateToLedger}
      />

      <RecurringAccountShortfallCard
        shortfalls={view.recurringAccountShortfalls}
        formatSensitive={view.formatSensitive}
        onTransferMoney={onNavigateToTransfer}
        onNavigateToRecurring={onNavigateToRecurring ?? (() => onNavigate?.('recurring'))}
      />

      {/* Net Worth snapshot: overarching position before daily cycle focus */}
      <NetWorthCard
        totalAccountBalance={totalAccountBalance ?? 0}
        investmentValue={investmentValue}
        loanDebt={loanDebt}
        isMasked={view.areBalanceAmountsMasked}
        formatCurrency={view.formatCurrency}
      />

      {/* Today-focused metric cards: cycle progress, safe-to-spend, and the active wish goal */}
      <TodayFocusCards
        selectedMonth={view.activeSettings.selectedMonth}
        selectedYear={view.activeSettings.selectedYear}
        cycleDay={view.activeSettings.cycleDay}
        wishlistGoal={view.wishlistGoal}
        hideSensitive={hideSensitive}
        formatCurrency={view.formatCurrency}
        formatSensitive={view.formatSensitive}
        onNavigate={onNavigate}
      />

      {/* Where the cycle's Essentials spending actually stands, as one rank rather than a figure
          the reader has to interpret. It sits above the plan snapshot because it answers the
          question the snapshot's six numbers are evidence for. */}
      <EssentialsChallengeCard
        challenge={challenge}
        cycle={cycleProgress}
        formatSensitive={view.formatSensitive}
        onReviewEssentials={onNavigateToLedger ? () => onNavigateToLedger({ category: 'Essentials', txType: 'outflow' }) : undefined}
      />

      <div data-testid="today-plan-grid">
        <section aria-labelledby="plan-snapshot-heading" className={cn(panelClass, 'flex flex-col p-5')}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 id="plan-snapshot-heading" className="text-section text-foreground">Plan snapshot</h3>
              <p className="mt-1 text-xs text-muted-foreground">Current-cycle spending room, committed bills, and emergency savings.</p>
            </div>
            <ShieldCheck className="size-5 shrink-0 text-blue-500" />
          </div>
          <div className="mt-5 grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:grid-rows-2">
            <InteractiveCard onClick={() => onNavigateToLedger?.({ category: 'Essentials' })} className="rounded-xl border-border/50 bg-muted/25 p-4">
              <span className="text-xs font-semibold text-muted-foreground">Essentials remaining</span>
              <span className="mt-1 block text-xl font-black text-foreground">{view.formatSensitive(view.essentialsMetric.projectedRemaining)}</span>
              <span className="mt-1 block text-xs text-muted-foreground">After pending bills</span>
            </InteractiveCard>
            <InteractiveCard onClick={() => onNavigateToLedger?.({ category: 'Stability', showAllCycles: true })} className="rounded-xl border-border/50 bg-muted/25 p-4">
              <span className="text-xs font-semibold text-muted-foreground">Emergency fund progress</span>
              <span className="mt-1 block text-xl font-black text-foreground">{(view.stabilityMetric.projectedPct * 100).toFixed(0)}%</span>
              <span className="mt-1 block text-xs text-muted-foreground">{view.formatSensitive(view.stabilityMetric.projectedBalance)} saved</span>
            </InteractiveCard>
            <div className="rounded-xl border border-border/50 bg-muted/25 p-4">
              <span className="text-xs font-semibold text-muted-foreground">{hasEndedCycle ? 'Essentials left' : 'Daily spending room'}</span>
              <span className="mt-1 block text-xl font-black text-foreground">
                {view.formatSensitive(hasEndedCycle ? Math.max(0, view.essentialsMetric.projectedRemaining) : dailySpendingRoom)}
                {!hasEndedCycle && <span className="text-sm font-bold text-muted-foreground">/day</span>}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {hasEndedCycle
                  ? 'This selected cycle has ended.'
                  : `Based on ${spendDays} day${spendDays === 1 ? '' : 's'} of Essentials remaining.`}
              </span>
            </div>

            <InteractiveCard
              onClick={() => onNavigate('recurring')}
              disabled={view.todayPlanInsights.unpaidRecurringCount === 0}
              className="rounded-xl border-border/50 bg-muted/25 p-4 disabled:cursor-default"
            >
              <span className="text-xs font-semibold text-muted-foreground">Unpaid recurring bills</span>
              <span className="mt-1 block text-xl font-black text-foreground">
                {view.formatSensitive(view.todayPlanInsights.unpaidRecurringTotal)}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {view.todayPlanInsights.unpaidRecurringCount === 0
                  ? 'No bills are awaiting payment.'
                  : `${view.todayPlanInsights.unpaidRecurringCount} bill${view.todayPlanInsights.unpaidRecurringCount === 1 ? '' : 's'} pending.`}
              </span>
            </InteractiveCard>

            <InteractiveCard
              onClick={() => onNavigateToLedger?.({ category: 'Essentials', txType: 'outflow' })}
              className="rounded-xl border-border/50 bg-muted/25 p-4"
            >
              <span className="text-xs font-semibold text-muted-foreground">Essentials spending pace</span>
              <span className="mt-1 block text-xl font-black text-foreground">
                {view.formatSensitive(currentDailyPace)}
                <span className="text-sm font-bold text-muted-foreground">/day</span>
              </span>
              <span className={`mt-1 block text-xs ${!hasEndedCycle && paceDifference > 0.05 ? 'font-semibold text-amber-500' : 'text-muted-foreground'}`}>
                {hasEndedCycle
                  ? 'Non-recurring Essentials daily average.'
                  : paceDifference > 0.05
                    ? dailySpendingRoom <= 0
                      ? 'No daily Essentials allowance remains.'
                      : `${Math.round(paceDifference * 100)}% faster than your remaining daily allowance.`
                    : 'Within your remaining daily allowance.'}
              </span>
            </InteractiveCard>

            <InteractiveCard
              onClick={() => onNavigateToLedger?.({ category: 'Essentials' })}
              className={`rounded-xl p-4 ${view.todayPlanInsights.projectedEssentialsEndingBalance < 0 ? 'border-orange-500/30 bg-orange-500/5' : 'border-border/50 bg-muted/25'}`}
            >
              <span className="text-xs font-semibold text-muted-foreground">{hasEndedCycle ? 'Cycle-end Essentials' : 'Projected cycle finish'}</span>
              <span className={`mt-1 block text-xl font-black ${view.todayPlanInsights.projectedEssentialsEndingBalance < 0 ? 'text-orange-500' : 'text-foreground'}`}>
                {view.formatSensitive(view.todayPlanInsights.projectedEssentialsEndingBalance)}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {hasEndedCycle ? 'Actual Essentials balance at close.' : 'After unpaid bills and the current pace.'}
              </span>
            </InteractiveCard>
          </div>
          <div className="mt-4 flex justify-end">
            <Button variant="tertiary" onClick={() => onNavigate('reports')}>
              <BarChart3 className="size-4" /> View full reports
            </Button>
          </div>
        </section>
      </div>
    </div>
  )
}
