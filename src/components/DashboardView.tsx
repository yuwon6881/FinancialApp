import React from 'react'
import type { Transaction, DashboardData, WishlistItem, PendingNotification } from '../types'
import { CycleSkeleton } from './ui/Skeleton'
import { useAppContext } from '../contexts/AppContext'
import { CycleCalendar } from './dashboard/CycleCalendar'
import { TrendLineChart } from './dashboard/TrendLineChart'
import { DoughnutChart } from './dashboard/DoughnutChart'
import { CarryoverLedgerTable } from './dashboard/CarryoverLedgerTable'
import { DashboardHeader } from './dashboard/DashboardHeader'
import { PendingNotificationsCard } from './dashboard/PendingNotificationsCard'
import { FinancialPlanMetrics } from './dashboard/FinancialPlanMetrics'
import { CycleFlowCards } from './dashboard/CycleFlowCards'
import { SubscriptionsTimelineCard } from './dashboard/SubscriptionsTimelineCard'
import { BalanceAdjustmentModals } from './dashboard/BalanceAdjustmentModals'
import { useDashboardView } from './dashboard/useDashboardView'

interface DashboardViewProps {
  dashboardData: DashboardData | null
  transactions: Transaction[]
  onSelectPeriod: (month: string, year: number) => void
  onNavigate: (tab: 'dashboard' | 'recurring' | 'ledger' | 'wishlist' | 'settings') => void
  hideSensitive?: boolean
  hideBalanceAmounts: boolean
  walletBalance: number
  onToggleBalanceAmounts: () => void
  onConfirmSubscription: (noti: PendingNotification, paidDate: string) => void
  onDeletePayment: (id: string) => void
  onNavigateToLedger?: (options: {
    category?: string | null;
    date?: string | null;
    txType?: 'inflow' | 'outflow' | null;
    range?: 'monthly' | '3month' | '6month' | 'yearly';
    highlightedTxId?: string | null;
    showAllCycles?: boolean;
  }) => void
  wishlist?: WishlistItem[]
  onDiscardSubscription?: (noti: PendingNotification) => void
  onAddTransaction?: (newTx: Omit<Transaction, 'id'>) => Promise<void> | void
  onAddBalanceAdjustment?: (newTx: Omit<Transaction, 'id'>) => Promise<void> | void
  isSwitchingCycle?: boolean
}
export const DashboardView: React.FC<DashboardViewProps> = ({
  dashboardData,
  transactions,
  onSelectPeriod,
  onNavigate,
  hideSensitive: hideSensitiveProp,
  hideBalanceAmounts,
  walletBalance,
  onToggleBalanceAmounts,
  onConfirmSubscription,
  onDeletePayment,
  onNavigateToLedger,
  wishlist = [],
  onDiscardSubscription,
  onAddBalanceAdjustment,
  isSwitchingCycle = false
}) => {
  const { hideSensitive: contextHideSensitive } = useAppContext()
  const hideSensitive = hideSensitiveProp ?? contextHideSensitive

  const view = useDashboardView({
    dashboardData,
    wishlist,
    hideSensitive,
    hideBalanceAmounts,
    onAddBalanceAdjustment,
  })

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

      {/* Pending Subscriptions Notifications Alert (plus its remove-confirmation modal) */}
      <PendingNotificationsCard
        notifications={dashboardData?.pendingNotifications}
        formatSensitive={view.formatSensitive}
        onConfirmSubscription={onConfirmSubscription}
        onDiscardSubscription={onDiscardSubscription}
        onDeletePayment={onDeletePayment}
      />

      <CarryoverLedgerTable
        categories={view.categories}
        pendingDeductionsByCategory={view.pendingDeductionsByCategory}
        amountsMasked={view.areBalanceAmountsMasked}
        hideSensitive={hideSensitive}
        formatCurrency={view.formatCurrency}
        onAdjust={view.openBalanceAdjustment}
      />

      {/* Financial Plan Metric Cards */}
      <FinancialPlanMetrics
        growthMetric={view.growthMetric}
        essentialsMetric={view.essentialsMetric}
        stabilityMetric={view.stabilityMetric}
        growthAlloc={view.activeSettings.growthAlloc}
        targetStabilityFund={view.activeSettings.targetStabilityFund}
        formatSensitive={view.formatSensitive}
        onNavigateToLedger={onNavigateToLedger}
      />

      {/* Grid of Metric Cards */}
      <CycleFlowCards
        stats={view.stats}
        wishlistGoal={view.wishlistGoal}
        hideSensitive={hideSensitive}
        formatCurrency={view.formatCurrency}
        formatSensitive={view.formatSensitive}
        onNavigate={onNavigate}
        onNavigateToLedger={onNavigateToLedger}
      />

      {/* Main Charts & Breakdown Section (2-column layout to prevent horizontally squeezed charts) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

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

      {/* Calendar & Subscriptions Section (Calendar spans 2 columns, Subscriptions timeline spans 1) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        <div className="lg:col-span-2">
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
        </div>

        {/* Active Month Recurring Payments Timeline (Spans 1 column) */}
        <div className="lg:col-span-1">
          <SubscriptionsTimelineCard
            activeRecurring={view.activeRecurring}
            formatSensitive={view.formatSensitive}
            onNavigate={onNavigate}
          />
        </div>
      </div>

      {/* Adjust Balance Modal + its review confirmation */}
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
