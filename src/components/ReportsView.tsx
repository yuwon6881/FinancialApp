import { Button } from './ui/Button'
import { AskAiButton } from './ui/AskAiButton'
import React from 'react'
import { ChartNoAxesCombined } from 'lucide-react'
import type { AppTab, DashboardData, SavingsGoal, Transaction, WishlistItem } from '../types'
import { useAppPrefs } from '../contexts/AppContext'
import { getCycleProgress } from '../lib/cycle'
import { CycleSkeleton } from './ui/CycleSkeleton'
import { useDashboardView } from './dashboard/useDashboardView'
import { TrendLineChart } from './dashboard/TrendLineChart'
import { CycleCalendar } from './dashboard/CycleCalendar'
import { getCategoryLimitCardId } from './dashboard/types'
import { SubscriptionsTimelineCard } from './dashboard/SubscriptionsTimelineCard'
import { useHighlightedElement } from './ui/useHighlightedElement'
import { buildBillTimelineModel } from '../lib/billTimeline'
import { isReportableOutflow } from '../lib/transactionReportSemantics'
import { PageHeader } from './ui/PageHeader'
import { CycleReportHero } from './reports/CycleReportHero'
import { BucketsSection } from './reports/BucketsSection'
import { SpendingSection } from './reports/SpendingSection'

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

  const currency = view.activeSettings.currency || 'USD'

  if (isSwitchingCycle) return <CycleSkeleton variant="reports" />

  return (
    <div className="@container min-w-0 space-y-8">
      <PageHeader
        title="Insights"
        description={view.cycleLabel}
        titleActions={onExplainWithAi && (
          <AskAiButton
            label="Explain this cycle"
            ariaLabel="Explain this cycle with Ask AI"
            onClick={() => onExplainWithAi(`${view.activeSettings.selectedYear}-${String(selectedMonthIndex).padStart(2, '0')}`)}
          />
        )}
        actions={selectedCycleEnded && onViewCycleSummary && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onViewCycleSummary(selectedMonthIndex, view.activeSettings.selectedYear)}
            aria-label="View cycle summary"
          >
            <ChartNoAxesCombined className="size-3.5" />
            Summary
          </Button>
        )}
      />

      <CycleReportHero
        stats={view.stats}
        insights={dashboardData?.cycleSummaryInsights}
        currency={currency}
        isMasked={hideSensitive}
        formatSensitive={view.formatSensitive}
        onNavigateToLedger={onNavigateToLedger}
        onSelectLargestExpense={largestExpenseTransaction ? () => onNavigateToLedger?.({ highlightedTxId: largestExpenseTransaction.id }) : undefined}
      />

      <BucketsSection
        categories={view.categories}
        isCurrentCycle={isCurrentCycle}
        cycleLabel={view.cycleLabel}
        pendingDeductionsByCategory={view.pendingDeductionsByCategory}
        savingsGoals={savingsGoals}
        currency={currency}
        amountsMasked={view.areBalanceAmountsMasked}
        formatCurrency={view.formatCurrency}
        formatSensitive={view.formatSensitive}
        growthMetric={view.growthMetric}
        essentialsMetric={view.essentialsMetric}
        stabilityMetric={view.stabilityMetric}
        growthAlloc={view.activeSettings.growthAlloc}
        targetStabilityFund={view.activeSettings.targetStabilityFund}
        onNavigateToAccounts={onNavigateToAccounts}
        onNavigateToLedger={onNavigateToLedger}
        onNavigate={onNavigate}
      />

      <SpendingSection
        dashboardData={dashboardData}
        selectedYear={view.activeSettings.selectedYear}
        limits={view.categoryLimitProgress}
        formatSensitive={view.formatSensitive}
        onNavigateToLedger={onNavigateToLedger}
        onNavigate={onNavigate}
        highlightedCategory={highlightedCategory}
      />

      <div className="grid min-w-0 grid-cols-1 gap-8 @4xl:grid-cols-2 @4xl:gap-6">
        <SubscriptionsTimelineCard
          activeRecurring={selectedCycleRecurring}
          formatSensitive={view.formatSensitive}
          onNavigate={onNavigate}
          onNavigateToRecurring={onNavigateToRecurring}
          cycleKey={`${view.activeSettings.selectedMonth}-${view.activeSettings.selectedYear}`}
        />
        <TrendLineChart
          dashboardData={dashboardData}
          growthBalance={view.categories.find(category => category.name === 'Growth')?.remaining ?? 0}
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
