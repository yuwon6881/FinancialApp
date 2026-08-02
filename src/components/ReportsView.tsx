import { Button } from './ui/Button'
import React from 'react'
import { BarChart3, ChartNoAxesCombined, ChevronRight, TrendingUp } from 'lucide-react'
import type { AppTab, DashboardData, Transaction, WishlistItem } from '../types'
import { useAppPrefs } from '../contexts/AppContext'
import { getCycleLabelForDropdown } from '../lib/cycleLabels'
import { getCycleProgress } from '../lib/cycle'
import { CustomSelect } from './ui/CustomSelect'
import { CycleSkeleton } from './ui/Skeleton'
import { useDashboardView } from './dashboard/useDashboardView'
import { CarryoverLedgerTable } from './dashboard/CarryoverLedgerTable'
import { FinancialPlanMetrics } from './dashboard/FinancialPlanMetrics'
import { CycleFlowCards } from './dashboard/CycleFlowCards'
import { TrendLineChart } from './dashboard/TrendLineChart'
import { DoughnutChart } from './dashboard/DoughnutChart'
import { CycleCalendar } from './dashboard/CycleCalendar'
import { BalanceAdjustmentModals } from './dashboard/BalanceAdjustmentModals'
import { CategoryLimitPerformance } from './dashboard/CategoryLimitPerformance'
import { SubscriptionsTimelineCard } from './dashboard/SubscriptionsTimelineCard'

interface ReportsViewProps {
  dashboardData: DashboardData | null
  transactions: Transaction[]
  wishlist?: WishlistItem[]
  hideBalanceAmounts: boolean
  onSelectPeriod: (month: string, year: number) => void
  onNavigate?: (tab: AppTab) => void
  onNavigateToRecurring?: (recurringPaymentId: string) => void
  onNavigateToLedger?: (options: {
    category?: string | null
    date?: string | null
    txType?: 'inflow' | 'outflow' | null
    range?: 'monthly' | '3month' | '6month' | 'yearly'
    highlightedTxId?: string | null
    showAllCycles?: boolean
  }) => void
  onAddBalanceAdjustment?: (newTx: Omit<Transaction, 'id'>) => Promise<void> | void
  isSwitchingCycle?: boolean
  onViewCycleSummary?: (monthIndex: number, year: number) => void
}

const REPORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const ReportsView: React.FC<ReportsViewProps> = ({
  dashboardData,
  transactions,
  wishlist = [],
  hideBalanceAmounts,
  onSelectPeriod,
  onNavigate = () => undefined,
  onNavigateToRecurring,
  onNavigateToLedger,
  onAddBalanceAdjustment,
  isSwitchingCycle = false,
  onViewCycleSummary,
}) => {
  const { hideSensitive } = useAppPrefs()
  const view = useDashboardView({
    dashboardData,
    wishlist,
    hideSensitive,
    hideBalanceAmounts,
    onAddBalanceAdjustment,
  })

  // The end-of-cycle summary only makes sense for a cycle that has actually closed. Offer the
  // manual re-open button whenever the viewed cycle has ended.
  const selectedMonthIndex = REPORT_MONTHS.indexOf(view.activeSettings.selectedMonth) + 1
  const selectedCycleEnded = selectedMonthIndex > 0 &&
    getCycleProgress(view.activeSettings.selectedYear, selectedMonthIndex, view.activeSettings.cycleDay).phase === 'ended'

  if (isSwitchingCycle) return <CycleSkeleton variant="reports" />

  return (
    <div className="min-w-0 space-y-6 overflow-x-hidden soft-rise">
      <header className="app-panel relative z-40 rounded-2xl border border-border/60 bg-card/92 p-4 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-blue-500/15 bg-blue-500/10 text-blue-500">
              <BarChart3 className="size-5" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">Reports</h2>
              <p className="mt-1 text-xs text-muted-foreground">Trends, plan performance, and activity for {view.cycleLabel}.</p>
            </div>
          </div>
          <div className="grid w-full grid-cols-[minmax(0,1fr)_5.5rem_auto] gap-2 sm:grid-cols-[minmax(14rem,1fr)_7rem_auto] lg:w-auto lg:min-w-[25rem]">
            <CustomSelect
              ariaLabel="Report cycle"
              value={view.activeSettings.selectedMonth}
              onChange={month => onSelectPeriod(month, view.activeSettings.selectedYear)}
              options={view.months.map(month => ({
                value: month,
                label: getCycleLabelForDropdown(month, view.activeSettings.selectedYear, view.activeSettings.cycleDay),
              }))}
              className="w-full"
            />
            <CustomSelect
              ariaLabel="Report year"
              value={view.activeSettings.selectedYear}
              onChange={year => onSelectPeriod(view.activeSettings.selectedMonth, Number(year))}
              options={view.years.map(year => ({ value: year, label: String(year) }))}
              className="w-full"
              align="right"
            />
            {selectedCycleEnded && onViewCycleSummary && (
              <Button variant="unstyled"
                type="button"
                onClick={() => onViewCycleSummary(selectedMonthIndex, view.activeSettings.selectedYear)}
                aria-label="View cycle summary"
                title="View cycle summary"
                className="flex size-9 self-center items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10 text-blue-500 transition hover:bg-blue-500/20 cursor-pointer sm:h-9 sm:w-auto sm:gap-1.5 sm:px-3"
              >
                <ChartNoAxesCombined className="size-3.5" />
                <span className="hidden whitespace-nowrap text-xs font-bold sm:inline">Summary</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      <CarryoverLedgerTable
        categories={view.categories}
        pendingDeductionsByCategory={view.pendingDeductionsByCategory}
        amountsMasked={view.areBalanceAmountsMasked}
        hideSensitive={hideSensitive}
        formatCurrency={view.formatCurrency}
        onAdjust={view.openBalanceAdjustment}
      />

      <FinancialPlanMetrics
        growthMetric={view.growthMetric}
        essentialsMetric={view.essentialsMetric}
        stabilityMetric={view.stabilityMetric}
        growthAlloc={view.activeSettings.growthAlloc}
        targetStabilityFund={view.activeSettings.targetStabilityFund}
        formatSensitive={view.formatSensitive}
        onNavigateToLedger={onNavigateToLedger}
      />

      <Button variant="unstyled"
        type="button"
        onClick={() => onNavigate('investments')}
        className="interactive-card app-panel group flex w-full flex-col gap-3 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4 text-left sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-5"
      >
        <span className="flex min-w-0 items-center gap-3 sm:gap-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/12 text-violet-500 transition-transform duration-200 group-hover:scale-105 sm:size-11">
            <TrendingUp className="size-5" />
          </span>
          <span className="min-w-0">
            <strong className="block truncate text-sm text-foreground">Growth Investments</strong>
            <span className="mt-0.5 block text-xs text-muted-foreground sm:mt-1">Open your long-term portfolio, broker accounts, and market performance.</span>
          </span>
        </span>
        <span className="flex items-center justify-between gap-4 border-t border-violet-500/10 pt-3 sm:shrink-0 sm:border-0 sm:pt-0 sm:text-right">
          <span>
            <span className="block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Growth ledger balance</span>
            <span className="block truncate text-lg font-black text-foreground sm:mt-1">
              {view.formatSensitive(view.categories.find(category => category.name === 'Growth')?.remaining ?? 0)}
            </span>
          </span>
          <ChevronRight className="size-4 text-violet-500 transition-transform duration-200 group-hover:translate-x-1" />
        </span>
      </Button>

      {/* Cycle inflow / outflow summary — moved here from the Today tab so the
          dashboard stays focused on daily status while Reports holds analysis. */}
      <CycleFlowCards
        stats={view.stats}
        hideSensitive={hideSensitive}
        formatCurrency={view.formatCurrency}
        formatSensitive={view.formatSensitive}
        onNavigateToLedger={onNavigateToLedger}
      />

      <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,2fr)] lg:items-stretch">
        <SubscriptionsTimelineCard
          activeRecurring={view.activeRecurring}
          formatSensitive={view.formatSensitive}
          onNavigate={onNavigate}
          onNavigateToRecurring={onNavigateToRecurring}
          cycleKey={`${view.activeSettings.selectedMonth}-${view.activeSettings.selectedYear}`}
        />
        <CategoryLimitPerformance
          items={view.categoryLimitProgress}
          formatSensitive={view.formatSensitive}
          onNavigateToLedger={onNavigateToLedger}
          onNavigate={onNavigate}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TrendLineChart
          dashboardData={dashboardData}
          growthBalance={view.categories.find(category => category.name === 'Growth')?.remaining ?? 0}
        />
        <DoughnutChart
          dashboardData={dashboardData}
          selectedYear={view.activeSettings.selectedYear}
          onNavigateToLedger={onNavigateToLedger}
        />
      </div>

      <CycleCalendar
        selectedMonth={view.activeSettings.selectedMonth}
        selectedYear={view.activeSettings.selectedYear}
        cycleDay={view.activeSettings.cycleDay}
        cycleLabel={view.cycleLabel}
        transactions={transactions}
        recurringPayments={view.activeRecurring}
        formatNet={view.formatCompactSensitive}
        onSelectDate={date => onNavigateToLedger?.({ date })}
      />

      <BalanceAdjustmentModals
        adjustingCategory={view.adjustingCategory}
        newBalanceInput={view.newBalanceInput}
        balanceErrors={view.balanceErrors}
        adjustmentDescription={view.adjustmentDescription}
        pendingBalanceAdjustment={view.pendingBalanceAdjustment}
        isAdjustmentUnchanged={view.isAdjustmentUnchanged}
        adjustmentPreviewDiff={view.adjustmentPreviewDiff}
        formatSensitive={view.formatSensitive}
        onBalanceInputChange={view.handleBalanceInputChange}
        onDescriptionChange={view.handleDescriptionChange}
        onClose={view.handleCloseAdjustBalance}
        onReview={view.prepareBalanceAdjustment}
        onCancelPending={view.cancelBalanceAdjustment}
        onConfirmPending={view.confirmBalanceAdjustment}
      />
    </div>
  )
}
