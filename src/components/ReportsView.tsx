import React from 'react'
import { BarChart3, ChartNoAxesCombined } from 'lucide-react'
import type { DashboardData, Transaction, WishlistItem } from '../types'
import { useAppContext } from '../contexts/AppContext'
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

interface ReportsViewProps {
  dashboardData: DashboardData | null
  transactions: Transaction[]
  wishlist?: WishlistItem[]
  hideBalanceAmounts: boolean
  onSelectPeriod: (month: string, year: number) => void
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
  onNavigateToLedger,
  onAddBalanceAdjustment,
  isSwitchingCycle = false,
  onViewCycleSummary,
}) => {
  const { hideSensitive } = useAppContext()
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
              <button
                type="button"
                onClick={() => onViewCycleSummary(selectedMonthIndex, view.activeSettings.selectedYear)}
                aria-label="View cycle summary"
                title="View cycle summary"
                className="flex size-9 self-center items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10 text-blue-500 transition hover:bg-blue-500/20 cursor-pointer sm:h-9 sm:w-auto sm:gap-1.5 sm:px-3"
              >
                <ChartNoAxesCombined className="size-3.5" />
                <span className="hidden whitespace-nowrap text-xs font-bold sm:inline">Summary</span>
              </button>
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

      {/* Cycle inflow / outflow summary — moved here from the Today tab so the
          dashboard stays focused on daily status while Reports holds analysis. */}
      <CycleFlowCards
        stats={view.stats}
        hideSensitive={hideSensitive}
        formatCurrency={view.formatCurrency}
        formatSensitive={view.formatSensitive}
        onNavigateToLedger={onNavigateToLedger}
      />

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
