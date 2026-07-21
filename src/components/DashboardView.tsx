import React from 'react'
import type { DashboardData, WishlistItem, AppTab } from '../types'
import { CycleSkeleton } from './ui/Skeleton'
import { useAppContext } from '../contexts/AppContext'
import { DashboardHeader } from './dashboard/DashboardHeader'
import { TodayFocusCards } from './dashboard/TodayFocusCards'
import { SubscriptionsTimelineCard } from './dashboard/SubscriptionsTimelineCard'
import { useDashboardView } from './dashboard/useDashboardView'
import { AlertCircle, BarChart3, CheckCircle2, ShieldCheck } from 'lucide-react'
import { Button } from './ui/Button'
import { getCycleProgress, MONTH_NAMES } from '../lib/cycle'

interface DashboardViewProps {
  dashboardData: DashboardData | null
  onSelectPeriod: (month: string, year: number) => void
  onNavigate: (tab: AppTab) => void
  onNavigateToRecurring?: (recurringPaymentId: string) => void
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
}
export const DashboardView: React.FC<DashboardViewProps> = ({
  dashboardData,
  onSelectPeriod,
  onNavigate,
  onNavigateToRecurring,
  hideSensitive: hideSensitiveProp,
  hideBalanceAmounts,
  walletBalance,
  onToggleBalanceAmounts,
  pendingNotificationCount,
  onOpenNotifications,
  onNavigateToLedger,
  wishlist = [],
  isSwitchingCycle = false
}) => {
  const { hideSensitive: contextHideSensitive } = useAppContext()
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

  if (isSwitchingCycle) {
    return <CycleSkeleton variant="dashboard" />
  }

  return (
    <div className="space-y-6 soft-rise">

      {/* Period Selection & Header */}
      <DashboardHeader
        cycleLabel={view.cycleLabel}
        selectedMonth={view.activeSettings.selectedMonth}
        selectedYear={view.activeSettings.selectedYear}
        cycleDay={view.activeSettings.cycleDay}
        months={view.months}
        years={view.years}
        walletBalance={walletBalance}
        areBalanceAmountsMasked={view.areBalanceAmountsMasked}
        hideSensitive={hideSensitive}
        hideBalanceAmounts={hideBalanceAmounts}
        formatCurrency={view.formatCurrency}
        onToggleBalanceAmounts={onToggleBalanceAmounts}
        onSelectPeriod={onSelectPeriod}
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

      <div data-testid="today-plan-grid" className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
        <section aria-labelledby="plan-snapshot-heading" className="app-panel rounded-2xl border border-border/60 bg-card/92 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 id="plan-snapshot-heading" className="text-base font-bold text-foreground">Plan snapshot</h3>
              <p className="mt-1 text-xs text-muted-foreground">A quick check of spending room and emergency savings.</p>
            </div>
            <ShieldCheck className="size-5 shrink-0 text-blue-500" />
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
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
          </div>
          <div className="mt-4 flex justify-end">
            <Button variant="ghost" onClick={() => onNavigate('reports')}>
              <BarChart3 className="size-4" /> View full reports
            </Button>
          </div>
        </section>

        <div className="min-w-0">
          <SubscriptionsTimelineCard
            activeRecurring={view.activeRecurring}
            formatSensitive={view.formatSensitive}
            onNavigate={onNavigate}
            onNavigateToRecurring={onNavigateToRecurring}
            cycleKey={`${view.activeSettings.selectedMonth}-${view.activeSettings.selectedYear}`}
          />
        </div>
      </div>
    </div>
  )
}
