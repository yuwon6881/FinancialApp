import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ReportsView } from './ReportsView'

vi.mock('./dashboard/useDashboardView', () => ({
  useDashboardView: () => ({
    months: ['Jun', 'Jul'],
    years: [2025, 2026],
    activeSettings: {
      selectedMonth: 'Jun',
      selectedYear: 2026,
      cycleDay: 1,
      growthAlloc: 0.25,
      targetStabilityFund: 10000,
    },
    cycleLabel: 'Jun 01 ~ Jun 30, 2026',
    categories: [{ name: 'Growth', remaining: 400 }],
    pendingDeductionsByCategory: {},
    areBalanceAmountsMasked: false,
    growthMetric: {},
    essentialsMetric: {},
    stabilityMetric: {},
    activeRecurring: [],
    categoryLimitProgress: [],
    formatCurrency: (value: number) => `$${value}`,
    formatSensitive: (value: number) => `$${value}`,
    formatCompactSensitive: (value: number) => String(value),
    openBalanceAdjustment: vi.fn(),
    adjustingCategory: null,
    newBalanceInput: '',
    balanceErrors: {},
    adjustmentDescription: '',
    pendingBalanceAdjustment: null,
    isAdjustmentUnchanged: false,
    adjustmentPreviewDiff: null,
    handleBalanceInputChange: vi.fn(),
    handleDescriptionChange: vi.fn(),
    handleCloseAdjustBalance: vi.fn(),
    prepareBalanceAdjustment: vi.fn(),
    cancelBalanceAdjustment: vi.fn(),
    confirmBalanceAdjustment: vi.fn(),
  }),
}))

vi.mock('./dashboard/CarryoverLedgerTable', () => ({ CarryoverLedgerTable: () => <div>Carryover report</div> }))
vi.mock('./dashboard/FinancialPlanMetrics', () => ({ FinancialPlanMetrics: () => <div>Plan performance report</div> }))
vi.mock('./dashboard/CycleFlowCards', () => ({ CycleFlowCards: () => <div>Cycle flow report</div> }))
vi.mock('./dashboard/SubscriptionsTimelineCard', () => ({ SubscriptionsTimelineCard: () => <div>Selected-cycle subscriptions</div> }))
vi.mock('./dashboard/TrendLineChart', () => ({ TrendLineChart: () => <div>Trend report</div> }))
vi.mock('./dashboard/DoughnutChart', () => ({ DoughnutChart: () => <div>Category report</div> }))
vi.mock('./dashboard/CycleCalendar', () => ({ CycleCalendar: ({ onSelectDate }: { onSelectDate: (date: string) => void }) => <button onClick={() => onSelectDate('2026-07-30')}>Activity calendar</button> }))
vi.mock('./dashboard/BalanceAdjustmentModals', () => ({ BalanceAdjustmentModals: () => null }))

describe('ReportsView', () => {
  it('contains the analytical sections removed from Today', () => {
    render(
      <ReportsView
        dashboardData={null}
        transactions={[]}
        hideBalanceAmounts={false}
        onSelectPeriod={vi.fn()}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Reports' })).toBeTruthy()
    expect(screen.getByText('Carryover report')).toBeTruthy()
    expect(screen.getByText('Plan performance report')).toBeTruthy()
    expect(screen.getByText('Cycle flow report')).toBeTruthy()
    expect(screen.getByText('Selected-cycle subscriptions')).toBeTruthy()
    expect(screen.getByText('Trend report')).toBeTruthy()
    expect(screen.getByText('Category report')).toBeTruthy()
    expect(screen.getByText('Activity calendar')).toBeTruthy()
  })

  it('links a calendar date back to the addressable ledger', () => {
    const onNavigateToLedger = vi.fn()
    render(
      <ReportsView
        dashboardData={null}
        transactions={[]}
        hideBalanceAmounts={false}
        onSelectPeriod={vi.fn()}
        onNavigateToLedger={onNavigateToLedger}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Activity calendar' }))
    expect(onNavigateToLedger).toHaveBeenCalledWith({ date: '2026-07-30' })
  })

  it('opens long-term Growth Investments from Reports', () => {
    const onNavigate = vi.fn()
    render(
      <ReportsView
        dashboardData={null}
        transactions={[]}
        hideBalanceAmounts={false}
        onSelectPeriod={vi.fn()}
        onNavigate={onNavigate}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Growth Investments/ }))
    expect(onNavigate).toHaveBeenCalledWith('investments')
    expect(screen.getByText('Growth ledger balance')).toBeTruthy()
  })

  it('offers a compact summary action for an ended cycle', () => {
    const onViewCycleSummary = vi.fn()
    render(
      <ReportsView
        dashboardData={null}
        transactions={[]}
        hideBalanceAmounts={false}
        onSelectPeriod={vi.fn()}
        onViewCycleSummary={onViewCycleSummary}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'View cycle summary' }))
    expect(onViewCycleSummary).toHaveBeenCalledWith(6, 2026)
  })

  it('keeps the ended-cycle controls in one compact row on narrow screens', () => {
    render(
      <ReportsView
        dashboardData={null}
        transactions={[]}
        hideBalanceAmounts={false}
        onSelectPeriod={vi.fn()}
        onViewCycleSummary={vi.fn()}
        onExplainWithAi={vi.fn()}
      />,
    )

    const askAi = screen.getByRole('button', { name: 'Explain this cycle with Ask AI' })
    expect(askAi.className).toContain('w-9')
    expect(askAi.parentElement?.className).toContain('flex-nowrap')
  })
})
