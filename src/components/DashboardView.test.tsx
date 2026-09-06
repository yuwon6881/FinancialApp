import { fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { DashboardView } from './DashboardView'
import type { DashboardData, SavingsGoal, WishlistItem } from '../types'
import { SENSITIVE_AMOUNT_MASK } from '../lib/utils'
import { EMPTY_RETENTION_REVIEW } from '../lib/documentRetention'

const retentionReview = vi.fn().mockResolvedValue(EMPTY_RETENTION_REVIEW)
vi.mock('../lib/api/documents', () => ({
  getDocumentRetentionReview: () => retentionReview(),
}))

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
    { name: 'Essentials', allocation: 0.5, target: 2000, incomeAllocated: 1500, budget: 500, netChange: -1000, remaining: 1500 },
    { name: 'Growth', allocation: 0.25, target: 1000, incomeAllocated: 750, budget: 0, netChange: 400, remaining: 400 },
    { name: 'Stability', allocation: 0.15, target: 600, incomeAllocated: 450, budget: 1836, netChange: 0, remaining: 2436 },
    { name: 'Rewards', allocation: 0.1, target: 400, incomeAllocated: 300, budget: 0, netChange: -280, remaining: 120 },
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
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-15T12:00:00Z'))
    render(<DashboardView {...makeProps()} />)

    expect(screen.getByText('Today')).toBeTruthy()
    expect(screen.getByText('Available now')).toBeTruthy()
    expect(screen.getByText('$4,456.00')).toBeTruthy()
    expect(screen.getByText('2 bills need review')).toBeTruthy()
    expect(screen.getByText('Plan snapshot')).toBeTruthy()
    expect(screen.getByText('Essentials remaining')).toBeTruthy()
    expect(screen.getByText('Emergency fund progress')).toBeTruthy()
    expect(screen.getByText('Unpaid recurring bills')).toBeTruthy()
    expect(screen.getByText('Essentials spending pace')).toBeTruthy()
    expect(screen.getByText('Projected cycle finish')).toBeTruthy()
    expect(screen.getByText(/Current cycle/)).toBeTruthy()
    expect(screen.queryByText('Subscriptions')).toBeNull()
    expect(screen.queryByText('Financial Plan Metrics')).toBeNull()
    expect(screen.queryByText('Carryover Rolling Ledgers')).toBeNull()
    vi.useRealTimers()
  })

  it('warns about tax records before their keep-until date and keeps the manual-only promise', async () => {
    retentionReview.mockResolvedValueOnce({
      taxYears: [
        { taxYear: 2018, documentCount: 4, totalBytes: 2_200_000, keepUntil: '2025-12-31', daysUntilKeepUntil: -400 },
        { taxYear: 2019, documentCount: 3, totalBytes: 1_400_000, keepUntil: '2026-12-31', daysUntilKeepUntil: 150 },
      ],
      noticeWindowDays: 180,
      keepYears: 7,
    })

    render(<DashboardView {...makeProps()} />)

    expect(await screen.findByText('Some tax records are older than you need to keep')).toBeTruthy()
    // The year still inside its keep period must be named too — warning only after the date has
    // passed was the gap this notice exists to close.
    expect(screen.getByText(/2019/)).toBeTruthy()
    expect(screen.getByText(/in about 5 months/)).toBeTruthy()
    // This promise is the reason nothing is auto-purged. It must never quietly fall off the screen.
    expect(screen.getByText(/Nothing is ever deleted for you/)).toBeTruthy()
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

  it('drops the bill review panel entirely when no bills need action', () => {
    render(<DashboardView {...makeProps({ pendingNotificationCount: 0 })} />)
    expect(screen.queryByText('You are all caught up')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Review bills' })).toBeNull()
    expect(screen.queryByText(/bills? need review/)).toBeNull()
  })

  it('raises a category only when it needs attention, and opens the Reports breakdown', () => {
    const props = makeProps({ onNavigateToCategoryLimits: vi.fn() })
    render(<DashboardView {...props} />)

    // The seeded Transport limit is on Watch.
    expect(screen.getByText('Transport is close to its budget')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'See categories' }))
    expect(props.onNavigateToCategoryLimits).toHaveBeenCalledWith('Transport')
  })

  it('says nothing about categories when every tracked limit is on plan', () => {
    render(<DashboardView {...makeProps({
      dashboardData: {
        ...dashboardData,
        categoryLimitProgress: [
          { category: 'Transport', limit: 400, spent: 80, remaining: 320, pendingCommitted: 0, projectedSpend: 200, percentUsed: 0.2, status: 'OnTrack' },
        ],
      },
    })} />)

    expect(screen.queryByText(/is close to its budget/)).toBeNull()
    expect(screen.queryByText(/is over its budget/)).toBeNull()
  })

  it('renders the today focus cards and the focused reward', () => {
    render(<DashboardView {...makeProps()} />)
    expect(screen.getByText('$4,456.00')).toBeTruthy()
    expect(screen.getByText('Cycle progress')).toBeTruthy()
    expect(screen.getByText('Reward: Camera')).toBeTruthy()
    expect(screen.getByText('40%')).toBeTruthy()
    // Cycle inflow/outflow moved to the Reports tab.
    expect(screen.queryByText('Cycle Inflow')).toBeNull()
    expect(screen.queryByText('$3,210.55')).toBeNull()
  })

  it('shows Today rewards after active commitments and pending Rewards bills', () => {
    const savingsGoals: SavingsGoal[] = [{
      id: 7,
      name: 'Car service',
      targetAmount: 500,
      earmarkedAmount: 300,
      targetDate: '2026-12-01',
      priority: 'Medium',
      status: 'active',
      isRecurring: false,
      recurrenceMonths: 12,
      cycleFundedAmount: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
    }]

    render(<DashboardView {...makeProps({
      savingsGoals,
      dashboardData: {
        ...dashboardData,
        categories: dashboardData.categories.map(category => category.name === 'Rewards'
          ? { ...category, remaining: 600 }
          : category),
        activeRecurringPayments: [
          ...dashboardData.activeRecurringPayments!,
          { id: 'arp-3', recurringPaymentId: 'rp-3', name: 'Cloud storage', amount: 80, category: 'Software', ledgerCategory: 'Rewards', dueDate: '2026-08-15', isPaid: false, isDiscarded: false, status: 'Pending' },
        ],
      },
    })} />)

    // 600 balance - 300 earmarked - 80 pending bill = 220 free; 220/300 rounds to 73%.
    expect(screen.getByText('73%')).toBeTruthy()
    expect(screen.getByText('$220.00')).toBeTruthy()
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

  it('navigates to Essentials outflows when Review Essentials spending is clicked', () => {
    const props = makeProps()
    render(<DashboardView {...props} />)

    const reviewButton = screen.getByRole('button', { name: /Review Essentials spending/i })
    fireEvent.click(reviewButton)
    expect(props.onNavigateToLedger).toHaveBeenCalledWith({ category: 'Essentials', txType: 'outflow' })
  })

  it('keeps long-term Growth Investments out of the Today view', () => {
    render(<DashboardView {...makeProps()} />)

    expect(screen.queryByRole('button', { name: /Growth Investments/ })).toBeNull()
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

  it('renders recurring account shortfall exception card when shortfalls exist', () => {
    const onNavigateToTransfer = vi.fn()
    const onNavigateToRecurring = vi.fn()
    const customData: DashboardData = {
      ...dashboardData,
      recurringAccountShortfalls: [
        {
          recurringPaymentId: 'rec-rent',
          name: 'House Rent',
          amount: 1500,
          dueDate: '2026-07-29',
          dueDay: 29,
          offsetDays: 1,
          accountId: 'acc-main',
          accountName: 'Main Checking',
          accountBalance: 400,
          shortfall: 1100,
        },
      ],
    }

    render(
      <DashboardView
        {...makeProps({
          dashboardData: customData,
          onNavigateToTransfer,
          onNavigateToRecurring,
        })}
      />
    )

    expect(screen.getByText('House Rent auto-deduct shortfall')).toBeTruthy()
    expect(screen.getByText('Due tomorrow')).toBeTruthy()

    const transferBtn = screen.getByRole('button', { name: /Transfer money/i })
    fireEvent.click(transferBtn)
    expect(onNavigateToTransfer).toHaveBeenCalledTimes(1)
  })
})
