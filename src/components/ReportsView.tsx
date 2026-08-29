import { Button } from './ui/Button'
import React from 'react'
import { BarChart3, ChartNoAxesCombined, ChevronRight, Sparkles, TrendingUp } from 'lucide-react'
import type { AppTab, DashboardData, SavingsGoal, Transaction, WishlistItem } from '../types'
import { useAppPrefs } from '../contexts/AppContext'
import { getCycleProgress } from '../lib/cycle'
import { CycleSkeleton } from './ui/CycleSkeleton'
import { useDashboardView } from './dashboard/useDashboardView'
import { CarryoverLedgerTable } from './dashboard/CarryoverLedgerTable'
import { FinancialPlanMetrics } from './dashboard/FinancialPlanMetrics'
import { CycleFlowCards } from './dashboard/CycleFlowCards'
import { TrendLineChart } from './dashboard/TrendLineChart'
import { DoughnutChart } from './dashboard/DoughnutChart'
import { CycleCalendar } from './dashboard/CycleCalendar'
import { CategoryLimitPerformance } from './dashboard/CategoryLimitPerformance'
import { getCategoryLimitCardId } from './dashboard/types'
import { SubscriptionsTimelineCard } from './dashboard/SubscriptionsTimelineCard'
import { useHighlightedElement } from './ui/useHighlightedElement'
import { buildBillTimelineModel } from '../lib/billTimeline'
import { CycleInsightsCard } from './reports/CycleInsightsCard'
import { isReportableOutflow } from '../lib/transactionReportSemantics'

interface ReportsViewProps {
  dashboardData: DashboardData | null
  transactions: Transaction[]
  wishlist?: WishlistItem[]
  savingsGoals?: SavingsGoal[]
  hideBalanceAmounts: boolean
  onNavigate?: (tab: AppTab) => void
  onNavigateToRecurring?: (recurringPaymentId: string) => void
  onNavigateToAccounts?: (target?: string | null) => void
  onNavigateToLedger?: (options: {
    category?: string | null
    date?: string | null
    startDate?: string | null
    endDate?: string | null
    txType?: 'inflow' | 'outflow' | null
    range?: 'monthly' | '3month' | '6month' | 'yearly'
    highlightedTxId?: string | null
    showAllCycles?: boolean
  }) => void
  isCurrentCycle?: boolean
  isSwitchingCycle?: boolean
  onViewCycleSummary?: (monthIndex: number, year: number) => void
  onExplainWithAi?: (cycleKey: string) => void
  /** Section id arrived at from another tab; scrolled to and briefly highlighted. */
  highlightedSection?: string | null
  /** Optional category card to highlight inside the arrived-at category-limits section. */
  highlightedCategory?: string | null
  onClearHighlightedSection?: () => void
}

const REPORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const ReportsView: React.FC<ReportsViewProps> = ({
  dashboardData,
  transactions,
  wishlist = [],
  savingsGoals = [],
  hideBalanceAmounts,
  onNavigate = () => undefined,
  onNavigateToRecurring,
  onNavigateToAccounts,
  onNavigateToLedger,
  isCurrentCycle = true,
  isSwitchingCycle = false,
  onViewCycleSummary,
  onExplainWithAi,
  highlightedSection = null,
  highlightedCategory = null,
  onClearHighlightedSection,
}) => {
  const prefs = useAppPrefs()
  const hideSensitive = prefs.maskPassiveFinancialFigures ?? prefs.hideSensitive
  const highlightTargetId = highlightedCategory
    ? getCategoryLimitCardId(highlightedCategory)
    : highlightedSection
      ? `report-section-${highlightedSection}`
      : null
  useHighlightedElement(highlightTargetId, onClearHighlightedSection)
  const view = useDashboardView({
    dashboardData,
    wishlist,
    savingsGoals,
    hideSensitive,
    hideBalanceAmounts,
  })

  // The end-of-cycle summary only makes sense for a cycle that has actually closed. Offer the
  // manual re-open button whenever the viewed cycle has ended.
  const selectedMonthIndex = REPORT_MONTHS.indexOf(view.activeSettings.selectedMonth) + 1
  const selectedCycleEnded = selectedMonthIndex > 0 &&
    getCycleProgress(view.activeSettings.selectedYear, selectedMonthIndex, view.activeSettings.cycleDay).phase === 'ended'
  const selectedCycleRecurring = React.useMemo(() => buildBillTimelineModel({
    activeRecurringPayments: view.activeRecurring,
    transactions,
    selectedMonth: view.activeSettings.selectedMonth,
    selectedYear: view.activeSettings.selectedYear,
    cycleDay: view.activeSettings.cycleDay,
  }).processedPayments, [
    transactions,
    view.activeRecurring,
    view.activeSettings.cycleDay,
    view.activeSettings.selectedMonth,
    view.activeSettings.selectedYear,
  ])

  const largestExpenseTransaction = React.useMemo(() => {
    const insights = dashboardData?.cycleSummaryInsights
    if (insights?.largestExpenseAmount != null && insights?.largestExpenseDescription) {
      const exactMatch = transactions.find(t =>
        isReportableOutflow(t) &&
        Math.abs(Math.abs(t.amount) - Math.abs(insights.largestExpenseAmount!)) < 0.005 &&
        t.description === insights.largestExpenseDescription,
      )
      if (exactMatch) return exactMatch
    }
    let largest: Transaction | undefined
    for (const transaction of transactions) {
      if (!isReportableOutflow(transaction)) continue
      const amount = Math.abs(transaction.amount)
      if (!largest || amount > Math.abs(largest.amount)) {
        largest = transaction
      }
    }
    return largest
  }, [transactions, dashboardData?.cycleSummaryInsights])

  if (isSwitchingCycle) return <CycleSkeleton variant="reports" />

  return (
    <div className="min-w-0 space-y-6 overflow-x-hidden">
      <header className="app-panel relative z-40 rounded-2xl border border-border/60 bg-card/92 p-4 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-blue-500/15 bg-blue-500/10 text-blue-500">
              <BarChart3 className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h2 className="text-2xl font-bold tracking-tight text-foreground">Reports</h2>
                {onExplainWithAi && (
                  <Button
                    variant="secondary"
                    size="sm"
                    type="button"
                    onClick={() => onExplainWithAi(`${view.activeSettings.selectedYear}-${String(selectedMonthIndex).padStart(2, '0')}`)}
                    aria-label="Explain this cycle with Ask AI"
                    className="size-11 shrink-0 p-0 sm:size-auto sm:px-3 sm:py-1.5"
                  >
                    <Sparkles className="size-3.5" />
                    <span className="hidden sm:inline">Explain this cycle</span>
                  </Button>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Trends, plan performance, and activity for {view.cycleLabel}.</p>
            </div>
          </div>
          {/* The cycle pickers live in the shared switcher above every cycle-dependent page. */}
          <div className="flex w-full min-w-0 flex-nowrap items-center justify-end gap-1.5 sm:gap-2 lg:w-auto">
            {selectedCycleEnded && onViewCycleSummary && (
              <Button variant="unstyled"
                type="button"
                onClick={() => onViewCycleSummary(selectedMonthIndex, view.activeSettings.selectedYear)}
                aria-label="View cycle summary"
                title="View cycle summary"
                className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10 px-2.5 text-blue-500 transition hover:bg-blue-500/20 cursor-pointer sm:min-h-0 sm:min-w-0 sm:gap-1.5 sm:px-3 sm:py-2"
              >
                <ChartNoAxesCombined className="size-3.5" />
                <span className="hidden whitespace-nowrap text-xs font-bold sm:inline">Summary</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      {dashboardData?.cycleSummaryInsights && (
        <CycleInsightsCard
          insights={dashboardData.cycleSummaryInsights}
          formatSensitive={view.formatSensitive}
          hasLargestExpense={Boolean(largestExpenseTransaction)}
          onSelectLargestExpense={largestExpenseTransaction ? () => onNavigateToLedger?.({ highlightedTxId: largestExpenseTransaction.id }) : undefined}
        />
      )}

      <CarryoverLedgerTable
        categories={view.categories}
        isCurrentCycle={isCurrentCycle}
        cycleLabel={view.cycleLabel}
        pendingDeductionsByCategory={view.pendingDeductionsByCategory}
        amountsMasked={view.areBalanceAmountsMasked}
        hideSensitive={hideSensitive}
        formatCurrency={view.formatCurrency}
        onNavigateToAccounts={onNavigateToAccounts}
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
            <span className="block text-xs font-bold uppercase tracking-wide text-muted-foreground">Growth ledger balance</span>
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
          activeRecurring={selectedCycleRecurring}
          formatSensitive={view.formatSensitive}
          onNavigate={onNavigate}
          onNavigateToRecurring={onNavigateToRecurring}
          cycleKey={`${view.activeSettings.selectedMonth}-${view.activeSettings.selectedYear}`}
        />
        <div id="report-section-category-limits" className="min-w-0 rounded-2xl">
          <CategoryLimitPerformance
            items={view.categoryLimitProgress}
            formatSensitive={view.formatSensitive}
            onNavigateToLedger={onNavigateToLedger}
            onNavigate={onNavigate}
          />
        </div>
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
        hideSensitive={hideSensitive}
        onSelectDate={date => onNavigateToLedger?.({ date })}
        onSelectWeek={(week, mode) => onNavigateToLedger?.({
          startDate: week.startDate,
          endDate: week.endDate,
          txType: mode === 'expense' ? 'outflow' : null,
        })}
      />

    </div>
  )
}
