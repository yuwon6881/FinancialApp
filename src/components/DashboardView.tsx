import React from 'react'
import type { DashboardData, WishlistItem, AppTab, InvestmentAllocationOverview } from '../types'
import { CycleSkeleton } from './ui/Skeleton'
import { useAppPrefs } from '../contexts/AppContext'
import { DashboardHeader } from './dashboard/DashboardHeader'
import { TodayFocusCards } from './dashboard/TodayFocusCards'
import { CategoryLimitPerformance } from './dashboard/CategoryLimitPerformance'
import { useDashboardView } from './dashboard/useDashboardView'
import { AlertCircle, BarChart3, CheckCircle2, ShieldCheck } from 'lucide-react'
import { Button } from './ui/Button'
import { getCycleProgress, MONTH_NAMES } from '../lib/cycle'
import { InvestmentPlanExceptionCard } from './dashboard/InvestmentPlanExceptionCard'

interface DashboardViewProps {
  dashboardData: DashboardData | null
  onNavigate: (tab: AppTab) => void
  hideSensitive?: boolean
  hideBalanceAmounts: boolean
  walletBalance: number
  onToggleBalanceAmounts: () => void
  pendingNotificationCount: number
  onOpenNotifications: () => void
  onNavigateToLedger?: (options: {
    category?: string | null;
    date?: string | null;
    txType?: 'inflow' | 'outflow' | null;
    range?: 'monthly' | '3month' | '6month' | 'yearly';
    highlightedTxId?: string | null;
    showAllCycles?: boolean;
  }) => void
  wishlist?: WishlistItem[]
  isSwitchingCycle?: boolean
  investmentAllocation?: InvestmentAllocationOverview | null
}
export const DashboardView: React.FC<DashboardViewProps> = ({
  dashboardData,
  onNavigate,
  hideSensitive: hideSensitiveProp,
  hideBalanceAmounts,
  walletBalance,
  onToggleBalanceAmounts,
  pendingNotificationCount,
  onOpenNotifications,
  onNavigateToLedger,
  wishlist = [],
  isSwitchingCycle = false,
  investmentAllocation = null,
}) => {
  const { hideSensitive: contextHideSensitive } = useAppPrefs()
  const hideSensitive = hideSensitiveProp ?? contextHideSensitive

  const view = useDashboardView({
    dashboardData,
    wishlist,
    hideSensitive,
    hideBalanceAmounts,
  })

  const cycleProgress = React.useMemo(() => {
    const monthIndex = MONTH_NAMES.indexOf(view.activeSettings.selectedMonth) + 1
    const safeMonthIndex = monthIndex > 0 ? monthIndex : new Date().getMonth() + 1
    return getCycleProgress(view.activeSettings.selectedYear || new Date().getFullYear(), safeMonthIndex, view.activeSettings.cycleDay || 28)
  }, [view.activeSettings.cycleDay, view.activeSettings.selectedMonth, view.activeSettings.selectedYear])
  const spendDays = cycleProgress.phase === 'active' ? cycleProgress.daysLeft : cycleProgress.phase === 'upcoming' ? cycleProgress.totalDays : 1
  const hasEndedCycle = cycleProgress.phase === 'ended'
  const dailySpendingRoom = Math.max(0, view.essentialsMetric.projectedRemaining) / spendDays
  const currentDailyPace = view.todayPlanInsights.nonRecurringEssentialsDailyAverage
  const paceDifference = dailySpendingRoom > 0
    ? (currentDailyPace - dailySpendingRoom) / dailySpendingRoom
    : currentDailyPace > 0 ? 1 : 0

  if (isSwitchingCycle) {
    return <CycleSkeleton variant="dashboard" />
  }

  return (
    <div className="space-y-6 soft-rise">

      <DashboardHeader
        cycleLabel={view.cycleLabel}
        cycleDay={view.activeSettings.cycleDay}
        walletBalance={walletBalance}
        areBalanceAmountsMasked={view.areBalanceAmountsMasked}
        hideSensitive={hideSensitive}
        hideBalanceAmounts={hideBalanceAmounts}
        formatCurrency={view.formatCurrency}
        onToggleBalanceAmounts={onToggleBalanceAmounts}
      />

      <section aria-labelledby="attention-heading" className={`app-panel rounded-2xl border p-5 ${pendingNotificationCount > 0 ? 'border-amber-500/25 bg-amber-500/8' : 'border-emerald-500/20 bg-emerald-500/5'}`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${pendingNotificationCount > 0 ? 'bg-amber-500/12 text-amber-600 dark:text-amber-400' : 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400'}`}>
              {pendingNotificationCount > 0 ? <AlertCircle className="size-5" /> : <CheckCircle2 className="size-5" />}
            </div>
            <div>
              <h3 id="attention-heading" className={`text-sm font-bold ${pendingNotificationCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {pendingNotificationCount > 0 ? `${pendingNotificationCount} bill${pendingNotificationCount === 1 ? '' : 's'} need review` : 'You are all caught up'}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {pendingNotificationCount > 0
                  ? 'Confirm paid bills, skip this cycle, or remove subscriptions from one review queue.'
                  : 'There are no subscription payments waiting for confirmation.'}
              </p>
            </div>
          </div>
          {pendingNotificationCount > 0 && (
            <Button variant="primary" onClick={onOpenNotifications} className="w-full justify-center sm:w-auto">
              Review bills
            </Button>
          )}
        </div>
      </section>

      <InvestmentPlanExceptionCard allocation={investmentAllocation} onNavigate={onNavigate} />

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

      <div data-testid="today-plan-grid">
        <section aria-labelledby="plan-snapshot-heading" className="app-panel flex flex-col rounded-2xl border border-border/60 bg-card/92 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 id="plan-snapshot-heading" className="text-base font-bold text-foreground">Plan snapshot</h3>
              <p className="mt-1 text-xs text-muted-foreground">Current-cycle spending room, committed bills, and emergency savings.</p>
            </div>
            <ShieldCheck className="size-5 shrink-0 text-blue-500" />
          </div>
          <div className="mt-5 grid flex-1 gap-3 sm:grid-cols-3 sm:grid-rows-2">
            <button type="button" onClick={() => onNavigateToLedger?.({ category: 'Essentials' })} className="interactive-card rounded-xl border border-border/50 bg-muted/25 p-4 text-left cursor-pointer">
              <span className="text-xs font-semibold text-muted-foreground">Essentials remaining</span>
              <span className="mt-1 block text-xl font-black text-foreground">{view.formatSensitive(view.essentialsMetric.projectedRemaining)}</span>
              <span className="mt-1 block text-xs text-muted-foreground">After pending bills</span>
            </button>
            <button type="button" onClick={() => onNavigateToLedger?.({ category: 'Stability', showAllCycles: true })} className="interactive-card rounded-xl border border-border/50 bg-muted/25 p-4 text-left cursor-pointer">
              <span className="text-xs font-semibold text-muted-foreground">Emergency fund progress</span>
              <span className="mt-1 block text-xl font-black text-foreground">{(view.stabilityMetric.projectedPct * 100).toFixed(0)}%</span>
              <span className="mt-1 block text-xs text-muted-foreground">{view.formatSensitive(view.stabilityMetric.projectedBalance)} saved</span>
            </button>
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

            <button
              type="button"
              onClick={onOpenNotifications}
              disabled={view.todayPlanInsights.unpaidRecurringCount === 0}
              className="interactive-card rounded-xl border border-border/50 bg-muted/25 p-4 text-left cursor-pointer disabled:cursor-default"
            >
              <span className="text-xs font-semibold text-muted-foreground">Unpaid recurring bills</span>
              <span className="mt-1 block text-xl font-black text-foreground">
                {view.formatSensitive(view.todayPlanInsights.unpaidRecurringTotal)}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {view.todayPlanInsights.unpaidRecurringCount === 0
                  ? 'No bills are awaiting payment.'
                  : `${view.todayPlanInsights.unpaidRecurringCount} bill${view.todayPlanInsights.unpaidRecurringCount === 1 ? '' : 's'} still to review.`}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onNavigateToLedger?.({ category: 'Essentials', txType: 'outflow' })}
              className="interactive-card rounded-xl border border-border/50 bg-muted/25 p-4 text-left cursor-pointer"
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
            </button>

            <button
              type="button"
              onClick={() => onNavigateToLedger?.({ category: 'Essentials' })}
              className={`interactive-card rounded-xl border p-4 text-left cursor-pointer ${view.todayPlanInsights.projectedEssentialsEndingBalance < 0 ? 'border-orange-500/30 bg-orange-500/5' : 'border-border/50 bg-muted/25'}`}
            >
              <span className="text-xs font-semibold text-muted-foreground">{hasEndedCycle ? 'Cycle-end Essentials' : 'Projected cycle finish'}</span>
              <span className={`mt-1 block text-xl font-black ${view.todayPlanInsights.projectedEssentialsEndingBalance < 0 ? 'text-orange-500' : 'text-foreground'}`}>
                {view.formatSensitive(view.todayPlanInsights.projectedEssentialsEndingBalance)}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {hasEndedCycle ? 'Actual Essentials balance at close.' : 'After unpaid bills and the current pace.'}
              </span>
            </button>
          </div>
          <div className="mt-4 flex justify-end">
            <Button variant="ghost" onClick={() => onNavigate('reports')}>
              <BarChart3 className="size-4" /> View full reports
            </Button>
          </div>
        </section>
      </div>

      <CategoryLimitPerformance
        items={view.categoryLimitProgress}
        formatSensitive={view.formatSensitive}
        onNavigateToLedger={onNavigateToLedger}
        onNavigate={onNavigate}
        compact
      />
    </div>
  )
}
