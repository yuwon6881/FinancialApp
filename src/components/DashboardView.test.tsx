import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { DashboardView } from './DashboardView'
import type { DashboardData, PendingNotification, WishlistItem } from '../types'
import { SENSITIVE_AMOUNT_MASK } from '../lib/utils'

// The chart children have their own rendering concerns (SVG geometry, hover
// state); DashboardView's contract with them is just the props it passes.
vi.mock('./dashboard/TrendLineChart', () => ({ TrendLineChart: () => <div data-testid="trend-line-chart" /> }))
vi.mock('./dashboard/DoughnutChart', () => ({ DoughnutChart: () => <div data-testid="doughnut-chart" /> }))
// CycleCalendar receives the dashboard's compact net formatter; render a few
// probe values through it so the formatter's math/masking is pinned here.
vi.mock('./dashboard/CycleCalendar', () => ({
  CycleCalendar: ({ formatNet }: { formatNet: (value: number) => React.ReactNode }) => (
    <div data-testid="cycle-calendar">{formatNet(1234500)}{formatNet(-2500)}{formatNet(999)}</div>
  ),
}))
vi.mock('./ui/BottomSheet', () => ({
  BottomSheet: ({ isOpen, title, children, footer }: { isOpen: boolean; title: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode }) =>
    isOpen ? <div role="dialog">{title}{children}{footer}</div> : null,
}))
vi.mock('./ui/DatePicker', () => ({
  DatePicker: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <input aria-label="paid date" type="date" value={value} onChange={event => onChange(event.target.value)} />
  ),
}))

const setting = {
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
}

const categories = [
  { name: 'Essentials', allocation: 0.5, target: 2000, budget: 500, netChange: -1000, remaining: 1500 },
  { name: 'Growth', allocation: 0.25, target: 1000, budget: 0, netChange: 400, remaining: 400 },
  { name: 'Stability', allocation: 0.15, target: 600, budget: 1836, netChange: 0, remaining: 2436 },
  { name: 'Rewards', allocation: 0.1, target: 400, budget: 0, netChange: -280, remaining: 120 },
]

const stats = {
  totalBalance: 4456,
  monthlyIncome: 3000,
  monthlyInflow: 3210.55,
  monthlyExpenses: 987.65,
  activeRecurringTotal: 29.5,
  growthPercentAchieved: 0.4,
  stabilityPercentReached: 0.2436,
  pastThreeMonthsRewardsAverage: 0,
  hasRewardsHistory: false,
}

const activeRecurringPayments = [
  { id: 'arp-1', recurringPaymentId: 'rp-1', name: 'Netflix', amount: 15, category: 'Entertainment', ledgerCategory: 'Essentials', dueDate: '2026-07-30', isPaid: false, isDiscarded: false, status: 'Pending' as const },
  { id: 'arp-2', recurringPaymentId: 'rp-2', name: 'Spotify', amount: 9.99, category: 'Software', ledgerCategory: 'Rewards', dueDate: '2026-08-02', isPaid: true, isDiscarded: false, status: 'Paid' as const },
  { id: 'arp-3', recurringPaymentId: 'rp-3', name: 'Gym', amount: 35, category: 'Other', ledgerCategory: 'Essentials', dueDate: '2026-08-05', isPaid: false, isDiscarded: true, status: 'Discarded' as const },
]

const pendingNotifications: PendingNotification[] = [
  { id: 'rp-1-2026-7', recurringPaymentId: 'rp-1', name: 'Netflix', amount: 15, category: 'Entertainment', ledgerCategory: 'Essentials', billingDate: '2026-07-30', year: 2026, month: 7, cycleLabel: 'Jul 28th ~ Aug 27th' },
  { id: 'rp-9-2026-7', recurringPaymentId: 'rp-9', name: 'iCloud', amount: 3.5, category: 'Software', ledgerCategory: 'Rewards', billingDate: '2026-08-01', year: 2026, month: 8, cycleLabel: 'Jul 28th ~ Aug 27th' },
]

const dashboardData: DashboardData = {
  setting,
  cycleLabel: 'Jul 28th ~ Aug 27th, 2026',
  categories,
  stats,
  activeRecurringPayments,
  trendPoints: [],
  last3TrendPoints: [],
  last6TrendPoints: [],
  pendingNotifications,
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
  transactions: [],
  onSelectPeriod: vi.fn(),
  onNavigate: vi.fn(),
  hideSensitive: false,
  hideBalanceAmounts: false,
  walletBalance: 1234.56,
  onToggleBalanceAmounts: vi.fn(),
  onConfirmSubscription: vi.fn(),
  onDeletePayment: vi.fn(),
  onNavigateToLedger: vi.fn(),
  wishlist,
  onDiscardSubscription: vi.fn(),
  onAddBalanceAdjustment: vi.fn(),
  ...overrides,
})

describe('DashboardView', () => {
  beforeAll(() => {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  })

  it('renders the main sections and the active cycle header', () => {
    render(<DashboardView {...makeProps()} />)

    expect(screen.getByText('Ledger Dashboard')).toBeTruthy()
    expect(screen.getByText('Jul 28th ~ Aug 27th, 2026')).toBeTruthy()
    expect(screen.getByText('Wallet Balance')).toBeTruthy()
    expect(screen.getByText('Carryover Rolling Ledgers')).toBeTruthy()
    expect(screen.getByText('Financial Plan Metrics')).toBeTruthy()
    expect(screen.getByText('Cycle Inflow')).toBeTruthy()
    expect(screen.getByText('Cycle Outflow')).toBeTruthy()
    expect(screen.getByText('Subscriptions')).toBeTruthy()
    expect(screen.getByTestId('trend-line-chart')).toBeTruthy()
    expect(screen.getByTestId('doughnut-chart')).toBeTruthy()
    expect(screen.getByTestId('cycle-calendar')).toBeTruthy()
    // Cycle starts on the 28th
    expect(screen.getByText('28th')).toBeTruthy()
  })

  it('renders the wallet balance and inflow/outflow figures from the fixture', () => {
    render(<DashboardView {...makeProps()} />)

    expect(screen.getByText('$1,234.56')).toBeTruthy() // wallet balance
    expect(screen.getByText('Visible')).toBeTruthy()
    expect(screen.getByText('$3,210.55')).toBeTruthy() // cycle inflow
    expect(screen.getByText('$3,000.00')).toBeTruthy() // total actual income
    expect(screen.getByText('$987.65')).toBeTruthy() // cycle outflow
    expect(screen.getByText('$29.50')).toBeTruthy() // active committed bills
  })

  it('derives the financial plan metric percentages and pending projections', () => {
    render(<DashboardView {...makeProps()} />)

    // Growth: growthPercentAchieved 0.4 -> 40.0%, no pending deduction, target 25% of income = $1,000.00
    expect(screen.getByText('40.0%')).toBeTruthy()
    expect(screen.getByText(/Deposit/).textContent).toContain('25%')
    expect(screen.getByText(/Deposit/).textContent).toContain('$1,000.00')

    // Essentials: remaining 1500 / (budget 500 + target 2000) = 60.0%, with the
    // pending Netflix bill (15, status Pending; the Discarded Gym bill must NOT
    // count) projecting 1485 / 2500 = 59.4%.
    expect(screen.getByText(/^60\.0%/).textContent).toContain('→ 59.4%')
    expect(screen.getByText(/Based on total available budget/).textContent)
      .toContain('$2,500.00')
    expect(screen.getByText(/Based on total available budget/).textContent)
      .toContain('Projected after pending: $1,485.00')

    // Stability: stabilityPercentReached 0.2436 -> 24.4%, fund goal $10,000.00, currently $2,436.00
    expect(screen.getByText('24.4%')).toBeTruthy()
    expect(screen.getByText(/Target Stability Fund goal/).textContent).toContain('$10,000.00')
    expect(screen.getByText(/Target Stability Fund goal/).textContent).toContain('$2,436.00')
  })

  it('shows pending recurring deductions in the carryover ledger table', () => {
    render(<DashboardView {...makeProps()} />)

    // Only the Pending Netflix bill counts (15) -- Discarded Gym (35) is excluded.
    // Rows render twice (desktop table + mobile cards).
    expect(screen.getAllByText('Pending: -$15.00').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Projected: $1,485.00').length).toBeGreaterThan(0)
    expect(screen.queryByText('Pending: -$50.00')).toBeNull()
    // Remaining balances from the fixture
    expect(screen.getAllByText('$2,436.00').length).toBeGreaterThan(0)
    expect(screen.getAllByText('$400.00').length).toBeGreaterThan(0) // unmasked baseline for the masking test
  })

  it('renders the wishlist goal card with rewards progress', () => {
    const props = makeProps()
    render(<DashboardView {...props} />)

    // Rewards remaining 120 / price 300 = 40%
    expect(screen.getByText('Goal: Camera')).toBeTruthy()
    expect(screen.getByText('40%')).toBeTruthy()
    expect(screen.getByText(/saved/).textContent).toContain('$120.00')
    expect(screen.getByText('$300.00')).toBeTruthy()

    fireEvent.click(screen.getByText('Goal: Camera'))
    expect(props.onNavigate).toHaveBeenCalledWith('wishlist')
  })

  it('hides the wishlist goal card when there is no unpurchased wishlist item', () => {
    render(<DashboardView {...makeProps({ wishlist: [] })} />)
    expect(screen.queryByText(/^Goal:/)).toBeNull()
  })

  it('lists pending subscription notifications with their amounts and cycle labels', () => {
    render(<DashboardView {...makeProps()} />)

    expect(screen.getByText('Pending Subscription Confirmations')).toBeTruthy()
    expect(screen.getByText('You have 2 subscription billing cycles awaiting confirmation.')).toBeTruthy()
    expect(screen.getByText('iCloud')).toBeTruthy()
    expect(screen.getByText('$3.50')).toBeTruthy()
    expect(screen.getByText('2026-08-01')).toBeTruthy()
  })

  it('confirms a subscription with the chosen paid date', () => {
    const props = makeProps()
    render(<DashboardView {...props} />)

    fireEvent.click(screen.getAllByRole('button', { name: 'Pay' })[0])
    const dateInput = screen.getByLabelText('paid date') as HTMLInputElement
    expect(dateInput.value).toBe('2026-07-30') // defaults to the billing date
    fireEvent.change(dateInput, { target: { value: '2026-08-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    expect(props.onConfirmSubscription).toHaveBeenCalledWith(pendingNotifications[0], '2026-08-01')
  })

  it('skips a subscription via the discard callback', () => {
    const props = makeProps()
    render(<DashboardView {...props} />)

    fireEvent.click(screen.getAllByRole('button', { name: 'Skip' })[1])
    expect(props.onDiscardSubscription).toHaveBeenCalledWith(pendingNotifications[1])
  })

  it('removes a subscription only after confirming the modal', () => {
    const props = makeProps()
    render(<DashboardView {...props} />)

    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0])
    expect(props.onDeletePayment).not.toHaveBeenCalled()

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Remove Subscription')).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }))
    expect(props.onDeletePayment).toHaveBeenCalledWith('rp-1')
  })

  it('shows subscription timeline statuses for the active cycle', () => {
    render(<DashboardView {...makeProps()} />)

    expect(screen.getByText('Spotify')).toBeTruthy()
    expect(screen.getByText('$9.99')).toBeTruthy()
    expect(screen.getByText('Paid')).toBeTruthy()
    expect(screen.getByText('Discarded')).toBeTruthy()
    expect(screen.getByText('Due 2026-08-02')).toBeTruthy()

    const props = makeProps()
    render(<DashboardView {...props} />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Manage Subscriptions' })[1])
    expect(props.onNavigate).toHaveBeenCalledWith('recurring')
  })

  it('navigates to the ledger from the metric cards', () => {
    const props = makeProps()
    render(<DashboardView {...props} />)

    fireEvent.click(screen.getByText('Cycle Inflow'))
    expect(props.onNavigateToLedger).toHaveBeenCalledWith({ txType: 'inflow' })

    fireEvent.click(screen.getByText('Cycle Outflow'))
    expect(props.onNavigateToLedger).toHaveBeenCalledWith({ txType: 'outflow' })

    fireEvent.click(screen.getByText('Growth Achieved'))
    expect(props.onNavigateToLedger).toHaveBeenCalledWith({ category: 'Growth', showAllCycles: true })

    fireEvent.click(screen.getByText('Essentials Remaining'))
    expect(props.onNavigateToLedger).toHaveBeenCalledWith({ category: 'Essentials', showAllCycles: false })

    fireEvent.click(screen.getByText('Stability Cap Reached'))
    expect(props.onNavigateToLedger).toHaveBeenCalledWith({ category: 'Stability', showAllCycles: true })
  })

  it('formats compact net values passed to the cycle calendar', () => {
    render(<DashboardView {...makeProps()} />)
    expect(screen.getByTestId('cycle-calendar').textContent).toBe('+$1.2M-$2.5k+$999')
  })

  it('toggles balance visibility and masks wallet/carryover amounts only', () => {
    const props = makeProps({ hideBalanceAmounts: true })
    render(<DashboardView {...props} />)

    expect(screen.getByText('Hidden on this device')).toBeTruthy()
    expect(screen.queryByText('$1,234.56')).toBeNull() // wallet masked
    expect(screen.queryByText('$400.00')).toBeNull() // carryover table amounts masked
    expect(screen.getByText('$3,210.55')).toBeTruthy() // inflow still visible
    expect(screen.getAllByText(SENSITIVE_AMOUNT_MASK).length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: 'Show wallet and carryover balances' }))
    expect(props.onToggleBalanceAmounts).toHaveBeenCalled()
  })

  it('masks all sensitive amounts in privacy mode', () => {
    render(<DashboardView {...makeProps({ hideSensitive: true })} />)

    expect(screen.getByText('Sensitive mode active')).toBeTruthy()
    expect(screen.queryByText('$1,234.56')).toBeNull()
    expect(screen.queryByText('$3,210.55')).toBeNull()
    expect(screen.queryByText('$987.65')).toBeNull()
    expect(screen.queryByText(/-\$3\.50/)).toBeNull() // notification amount masked
    expect(screen.getAllByText(SENSITIVE_AMOUNT_MASK).length).toBeGreaterThan(5)
    // The compact calendar formatter masks too
    expect(screen.getByTestId('cycle-calendar').textContent)
      .toBe(SENSITIVE_AMOUNT_MASK.repeat(3))
    // Balance adjustment is guarded off while sensitive mode is on
    const adjustButton = screen.getAllByLabelText('Adjust Essentials balance')[0] as HTMLButtonElement
    expect(adjustButton.disabled).toBe(true)
  })

  it('records a balance adjustment after review and confirmation', () => {
    const props = makeProps()
    render(<DashboardView {...props} />)

    fireEvent.click(screen.getAllByLabelText('Adjust Essentials balance')[0])
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Adjust Essentials Balance')).toBeTruthy()
    expect(within(dialog).getByText('$1,500.00')).toBeTruthy() // current remaining

    // Unchanged target keeps the review button disabled
    const reviewButton = within(dialog).getByRole('button', { name: 'Review Adjustment' }) as HTMLButtonElement
    expect(reviewButton.disabled).toBe(true)

    // The amount input applies ATM-style masking: digits are cents
    const amountInput = within(dialog).getByPlaceholderText('0.00') as HTMLInputElement
    expect(amountInput.value).toBe('1500.00')
    fireEvent.change(amountInput, { target: { value: '180000' } })
    expect(amountInput.value).toBe('1800.00')
    expect(within(dialog).getByText(/Calculated ledger entry:/).textContent).toContain('+300.00')

    expect(reviewButton.disabled).toBe(false)
    fireEvent.click(reviewButton)

    // Review modal shows the current/target/diff breakdown
    const confirmDialog = screen.getByRole('dialog')
    expect(within(confirmDialog).getByText('Confirm Balance Adjustment')).toBeTruthy()
    expect(within(confirmDialog).getByText('$1,500.00')).toBeTruthy()
    expect(within(confirmDialog).getByText('$1,800.00')).toBeTruthy()
    expect(within(confirmDialog).getByText('Addition')).toBeTruthy()
    expect(within(confirmDialog).getByText('$300.00')).toBeTruthy()

    fireEvent.click(within(confirmDialog).getByRole('button', { name: 'Record Adjustment' }))

    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    expect(props.onAddBalanceAdjustment).toHaveBeenCalledWith({
      description: 'Balance Adjustment',
      amount: 300,
      category: 'Adjustment',
      ledgerCategory: 'Essentials',
      date: today,
    })
  })

  it('renders the cycle skeleton while switching cycles', () => {
    render(<DashboardView {...makeProps({ isSwitchingCycle: true })} />)
    expect(screen.queryByText('Ledger Dashboard')).toBeNull()
  })
})
