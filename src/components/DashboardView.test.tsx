import { fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { DashboardView } from './DashboardView'
import type { DashboardData, WishlistItem } from '../types'
import { SENSITIVE_AMOUNT_MASK } from '../lib/utils'

const dashboardData: DashboardData = {
  setting: {
    targetStabilityFund: 10000,
    selectedMonth: 'Jul',
    selectedYear: 2026,
    essentialsAlloc: 0.5,
    growthAlloc: 0.25,
    stabilityAlloc: 0.15,
    rewardsAlloc: 0.1,
    cycleDay: 28,
    darkMode: false,
    hideSensitive: false,
    currency: 'USD',
  },
  cycleLabel: 'Jul 28th ~ Aug 27th, 2026',
  categories: [
    { name: 'Essentials', allocation: 0.5, target: 2000, budget: 500, netChange: -1000, remaining: 1500 },
    { name: 'Growth', allocation: 0.25, target: 1000, budget: 0, netChange: 400, remaining: 400 },
    { name: 'Stability', allocation: 0.15, target: 600, budget: 1836, netChange: 0, remaining: 2436 },
    { name: 'Rewards', allocation: 0.1, target: 400, budget: 0, netChange: -280, remaining: 120 },
  ],
  stats: {
    totalBalance: 4456,
    monthlyIncome: 3000,
    monthlyInflow: 3210.55,
    monthlyExpenses: 987.65,
    activeRecurringTotal: 29.5,
    growthPercentAchieved: 0.4,
    stabilityPercentReached: 0.2436,
    pastThreeMonthsRewardsAverage: 0,
    hasRewardsHistory: false,
  },
  activeRecurringPayments: [
    { id: 'arp-1', recurringPaymentId: 'rp-1', name: 'Netflix', amount: 15, category: 'Entertainment', ledgerCategory: 'Essentials', dueDate: '2026-07-30', isPaid: false, isDiscarded: false, status: 'Pending' },
    { id: 'arp-2', recurringPaymentId: 'rp-2', name: 'Spotify', amount: 9.99, category: 'Software', ledgerCategory: 'Rewards', dueDate: '2026-08-02', isPaid: true, isDiscarded: false, status: 'Paid' },
  ],
  todayPlanInsights: {
    unpaidRecurringCount: 1,
    unpaidRecurringTotal: 15,
    unpaidEssentialsTotal: 15,
    nonRecurringEssentialsSpent: 300,
    nonRecurringEssentialsDailyAverage: 20,
    projectedEssentialsEndingBalance: 1185,
  },
  categoryLimitProgress: [
    { category: 'Transport', limit: 400, spent: 320, remaining: 80, pendingCommitted: 0, projectedSpend: 440, percentUsed: 0.8, status: 'Watch' },
  ],
  trendPoints: [],
  last3TrendPoints: [],
  last6TrendPoints: [],
  pendingNotifications: [],
  monthlyCategoryBreakdown: [],
  last3CategoryBreakdown: [],
  last6CategoryBreakdown: [],
  yearlyCategoryBreakdown: [],
  availableYears: [2025, 2026],
}

const wishlist: WishlistItem[] = [
  { id: 1, name: 'Camera', price: 300, priority: 'High', isPurchased: false, createdAt: '2026-07-01T00:00:00Z', isActive: true },
]

const makeProps = (overrides: Partial<React.ComponentProps<typeof DashboardView>> = {}) => ({
  dashboardData,
  onNavigate: vi.fn(),
  hideSensitive: false,
  hideBalanceAmounts: false,
  walletBalance: 1234.56,
  onToggleBalanceAmounts: vi.fn(),
  pendingNotificationCount: 2,
  onOpenNotifications: vi.fn(),
  onNavigateToLedger: vi.fn(),
  wishlist,
  ...overrides,
})

describe('DashboardView focused Today experience', () => {
  beforeAll(() => {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  })

  it('prioritizes current money, attention, and plan status', () => {
    render(<DashboardView {...makeProps()} />)

    expect(screen.getByText('Today')).toBeTruthy()
    expect(screen.getByText('Available now')).toBeTruthy()
    expect(screen.getByText('2 bills need review')).toBeTruthy()
    expect(screen.getByText('Plan snapshot')).toBeTruthy()
    expect(screen.getByText('Essentials remaining')).toBeTruthy()
    expect(screen.getByText('Emergency fund progress')).toBeTruthy()
    expect(screen.getByText('Unpaid recurring bills')).toBeTruthy()
    expect(screen.getByText('Essentials spending pace')).toBeTruthy()
    expect(screen.getByText('Projected cycle finish')).toBeTruthy()
    expect(screen.getByText('Category watch')).toBeTruthy()
    expect(screen.getByText(/Current cycle/)).toBeTruthy()
    expect(screen.queryByText('Subscriptions')).toBeNull()
    expect(screen.queryByText('Financial Plan Metrics')).toBeNull()
    expect(screen.queryByText('Carryover Rolling Ledgers')).toBeNull()
  })

  it('gives the plan snapshot the full Today content width', () => {
    render(<DashboardView {...makeProps()} />)

    expect(screen.getByTestId('today-plan-grid').className).not.toContain('grid-cols')
    expect(screen.queryByTestId('subscriptions-timeline-card')).toBeNull()
  })

  it('opens the one shared bill review surface', () => {
    const props = makeProps()
    render(<DashboardView {...props} />)
    fireEvent.click(screen.getByRole('button', { name: 'Review bills' }))
    expect(props.onOpenNotifications).toHaveBeenCalledOnce()
  })

  it('shows a calm caught-up state when no bills need action', () => {
    render(<DashboardView {...makeProps({ pendingNotificationCount: 0 })} />)
    expect(screen.getByText('You are all caught up')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Review bills' })).toBeNull()
  })

  it('renders the today focus cards and the active wish goal', () => {
    render(<DashboardView {...makeProps()} />)
    expect(screen.getByText('$1,234.56')).toBeTruthy()
    expect(screen.getByText('Cycle progress')).toBeTruthy()
    expect(screen.getByText('Goal: Camera')).toBeTruthy()
    expect(screen.getByText('40%')).toBeTruthy()
    // Cycle inflow/outflow moved to the Reports tab.
    expect(screen.queryByText('Cycle Inflow')).toBeNull()
    expect(screen.queryByText('$3,210.55')).toBeNull()
  })

  it('shows the next cycle start and keeps daily spending room in the plan snapshot', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 20))

    try {
      render(<DashboardView {...makeProps()} />)

      expect(screen.getByText(/next cycle starts Aug 28/)).toBeTruthy()
      expect(screen.queryByText('Safe to spend / day')).toBeNull()
      const dailySpendingRoom = screen.getByText('Daily spending room')
      expect(dailySpendingRoom).toBeTruthy()
      expect(dailySpendingRoom.parentElement?.textContent).toContain('$47.90/day')
    } finally {
      vi.useRealTimers()
    }
  })

  it('describes an unsustainable pace against the remaining daily allowance', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 20))

    try {
      render(<DashboardView {...makeProps({
        dashboardData: {
          ...dashboardData,
          todayPlanInsights: {
            ...dashboardData.todayPlanInsights!,
            nonRecurringEssentialsDailyAverage: 100,
          },
        },
      })} />)

      expect(screen.getByText(/faster than your remaining daily allowance/)).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })

  it('links the summary to reports and ledger details', () => {
    const props = makeProps()
    render(<DashboardView {...props} />)

    const reportsButton = screen.getByRole('button', { name: /View full reports/ })
    fireEvent.click(reportsButton)
    expect(props.onNavigate).toHaveBeenCalledWith('reports')
    expect(reportsButton.parentElement?.className).toContain('justify-end')

    fireEvent.click(screen.getByText('Essentials remaining'))
    expect(props.onNavigateToLedger).toHaveBeenCalledWith({ category: 'Essentials' })
  })

  it('masks amounts in sensitive mode', () => {
    render(<DashboardView {...makeProps({ hideSensitive: true })} />)
    expect(screen.queryByText('$1,234.56')).toBeNull()
    expect(screen.queryByText('$3,210.55')).toBeNull()
    expect(screen.getAllByText(SENSITIVE_AMOUNT_MASK).length).toBeGreaterThan(2)
  })

  it('toggles device-only balance visibility', () => {
    const props = makeProps({ hideBalanceAmounts: true })
    render(<DashboardView {...props} />)
    fireEvent.click(screen.getByRole('button', { name: 'Show available balance' }))
    expect(props.onToggleBalanceAmounts).toHaveBeenCalledOnce()
  })

  it('renders a skeleton while switching cycles', () => {
    render(<DashboardView {...makeProps({ isSwitchingCycle: true })} />)
    expect(screen.queryByText('Today')).toBeNull()
  })
})
