import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { RecurringPaymentsView } from './RecurringPaymentsView'
import { AppPrefsContext } from '../contexts/AppContext'

vi.mock('./BillTimeline', () => ({ BillTimeline: () => null }))
vi.mock('./ui/BottomSheet', () => ({
  BottomSheet: ({ title, children }: { title: React.ReactNode; children: React.ReactNode }) => (
    <div role="dialog">{title}{children}</div>
  ),
}))
vi.mock('./ui/DatePicker', () => ({
  DatePicker: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <input aria-label="billing date" type="date" value={value} onChange={event => onChange(event.target.value)} />
  ),
}))

// Placement is explicit: every bucket needs one open account, with no default to fall back on.
const accounts = ['Essentials', 'Growth', 'Stability', 'Rewards'].map(bucket => ({
  id: `acct-${bucket.toLowerCase()}`,
  name: `${bucket} balance`,
  bucket,
  kind: 'Other',
  remaining: 0,
  isArchived: false,
})) as React.ComponentProps<typeof RecurringPaymentsView>['accounts']

describe('RecurringPaymentsView form', () => {
  beforeAll(() => {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  })

  it('emits the frequency chosen by the user', () => {
    const onAddPayment = vi.fn()
    render(
      <RecurringPaymentsView
        payments={[]}
        accounts={accounts}
        activeRecurringPayments={[]}
        selectedMonth="Jul"
        selectedYear={2026}
        cycleDay={1}
        onAddPayment={onAddPayment}
        onToggleActive={vi.fn()}
        onDeletePayment={vi.fn()}
        onUpdatePayment={vi.fn()}
        categories={[{ id: 'bills', name: 'Bills' }]}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'New Subscription' }))
    fireEvent.change(screen.getByPlaceholderText('e.g. Netflix, Spotify'), { target: { value: 'Insurance' } })
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '120.00' } })
    fireEvent.change(screen.getAllByLabelText('billing date')[0], { target: { value: '2026-07-20' } })
    fireEvent.click(screen.getByRole('combobox', { name: 'Payment frequency' }))
    fireEvent.click(screen.getByRole('option', { name: 'Annually' }))
    fireEvent.click(screen.getByRole('combobox', { name: /How it's paid/ }))
    fireEvent.click(screen.getByRole('option', { name: 'Manual payment' }))
    // Placement is explicit, so the bill has to name the account that pays it.
    fireEvent.click(screen.getByRole('combobox', { name: /Paid from account/ }))
    fireEvent.click(screen.getByRole('option', { name: /Essentials balance/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Add Subscription' }))

    expect(onAddPayment).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Insurance',
      frequency: 'Annually',
      dueDate: 20,
      startDate: '2026-07-20',
    }))
  })

  it('opens a FAB-requested form while the server privacy preference is pending', async () => {
    const renderView = (status: 'pending' | 'resolved') => (
      <AppPrefsContext.Provider value={{
        hideSensitive: true,
        sensitivePreferenceStatus: status,
        currency: 'USD',
        darkMode: false,
        formatSensitive: () => '•••',
      }}>
        <RecurringPaymentsView
          payments={[]}
          accounts={accounts}
          activeRecurringPayments={[]}
          selectedMonth="Jul"
          selectedYear={2026}
          cycleDay={1}
          onAddPayment={vi.fn()}
          onToggleActive={vi.fn()}
          onDeletePayment={vi.fn()}
          onUpdatePayment={vi.fn()}
          categories={[{ id: 'bills', name: 'Bills' }]}
          hideSensitive
          autoOpenAddForm
        />
      </AppPrefsContext.Provider>
    )

    const { rerender } = render(renderView('pending'))
    await waitFor(() => expect(screen.getByPlaceholderText('e.g. Netflix, Spotify')).toBeTruthy())

    rerender(renderView('resolved'))
    await waitFor(() => expect(screen.queryByPlaceholderText('e.g. Netflix, Spotify')).toBeNull())
  })

  it('triggers onLoadLoans on mount even when active tab is recurring', () => {
    const onLoadLoans = vi.fn().mockResolvedValue([])
    render(
      <RecurringPaymentsView
        payments={[]}
        accounts={accounts}
        activeRecurringPayments={[]}
        selectedMonth="Jul"
        selectedYear={2026}
        cycleDay={1}
        onAddPayment={vi.fn()}
        onToggleActive={vi.fn()}
        onDeletePayment={vi.fn()}
        onUpdatePayment={vi.fn()}
        categories={[{ id: 'bills', name: 'Bills' }]}
        onLoadLoans={onLoadLoans}
      />,
    )

    expect(onLoadLoans).toHaveBeenCalledTimes(1)
  })

  it('displays the loans count badge when loans are cached or loaded', () => {
    const sampleLoan = {
      id: 'loan-1',
      name: 'Car Loan',
      recurringPaymentId: 'bill-1',
      openingPrincipal: 10000,
      trackingStartDate: '2026-01-01',
      annualRatePercent: 4.5,
      termPeriods: 48,
      interestMethod: 'ReducingBalance' as const,
      scheduleStatus: 'Complete' as const,
      snapshot: {
        outstandingBalance: 8000,
        scheduledPayment: 250,
        totalScheduledInterest: 1000,
        totalInterestPaid: 200,
        payments: [],
        futureSchedule: [],
      },
    }

    render(
      <RecurringPaymentsView
        payments={[]}
        accounts={accounts}
        activeRecurringPayments={[]}
        selectedMonth="Jul"
        selectedYear={2026}
        cycleDay={1}
        onAddPayment={vi.fn()}
        onToggleActive={vi.fn()}
        onDeletePayment={vi.fn()}
        onUpdatePayment={vi.fn()}
        categories={[{ id: 'bills', name: 'Bills' }]}
        loans={[sampleLoan]}
        loanLoadStatus="cached"
      />,
    )

    // Recurring tab has 0 bills, Loans tab has 1 loan from cache
    const loansTab = screen.getByRole('tab', { name: /loans/i })
    expect(loansTab.textContent).toContain('1')
  })

  it('clears a category filter when search navigates to a hidden bill', () => {
    const payments = [
      {
        id: 'bill-essential', name: 'Insurance', amount: 120, frequency: 'Monthly' as const,
        category: 'Bills', ledgerCategory: 'Essentials', accountId: 'acct-essentials',
        nextDueDate: '2026-08-20', dueDate: 20, startDate: '2026-01-20', active: true,
        paymentMode: 'Manual' as const,
      },
      {
        id: 'bill-reward', name: 'Streaming', amount: 30, frequency: 'Monthly' as const,
        category: 'Entertainment', ledgerCategory: 'Rewards', accountId: 'acct-rewards',
        nextDueDate: '2026-08-22', dueDate: 22, startDate: '2026-01-22', active: true,
        paymentMode: 'Manual' as const,
      },
    ]
    const baseProps = {
      payments,
      accounts,
      activeRecurringPayments: [],
      selectedMonth: 'Jul',
      selectedYear: 2026,
      cycleDay: 1,
      onAddPayment: vi.fn(),
      onToggleActive: vi.fn(),
      onDeletePayment: vi.fn(),
      onUpdatePayment: vi.fn(),
      categories: [{ id: 'bills', name: 'Bills' }],
    }
    const { rerender } = render(<RecurringPaymentsView {...baseProps} />)

    fireEvent.click(screen.getByRole('button', { name: /all categories/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Rewards' }))
    expect(screen.queryByText('Insurance')).toBeNull()

    rerender(<RecurringPaymentsView {...baseProps} highlightedRecurringId="bill-essential" />)
    expect(screen.getByText('Insurance')).toBeTruthy()
    expect(screen.getByRole('button', { name: /all categories/i })).toBeTruthy()
  })
})

describe('RecurringPaymentsView pay early', () => {
  const payment = {
    id: 'bill-essential', name: 'Insurance', amount: -100, frequency: 'Monthly' as const,
    category: 'Bills', ledgerCategory: 'Essentials', accountId: 'acct-essentials',
    nextDueDate: '2099-01-20', dueDate: 20, startDate: '2026-01-20', active: true,
    paymentMode: 'Manual' as const,
  }

  function renderView(overrides: Partial<React.ComponentProps<typeof RecurringPaymentsView>> = {}) {
    return render(
      <RecurringPaymentsView
        payments={[payment]}
        accounts={accounts}
        activeRecurringPayments={[]}
        selectedMonth="Jul"
        selectedYear={2026}
        cycleDay={1}
        onAddPayment={vi.fn()}
        onToggleActive={vi.fn()}
        onDeletePayment={vi.fn()}
        onUpdatePayment={vi.fn()}
        categories={[{ id: 'bills', name: 'Bills' }]}
        {...overrides}
      />,
    )
  }

  // Pay Early only ever targets a future occurrence, and the pending-due list only holds ones due
  // today or earlier -- so the sheet never found the occurrence and quoted the bill's full price.
  // Paying part of a bill early and then opening the sheet again is exactly how that goes wrong.
  it('charges only what is still due after an earlier part payment', async () => {
    const onPayEarly = vi.fn()
    renderView({
      onPayEarly,
      transactions: [{
        id: 'tx-part', date: '2026-07-01', description: 'Insurance', amount: -60,
        category: 'Bills', ledgerCategory: 'Essentials', accountId: 'acct-essentials',
        recurringPaymentId: 'bill-essential', recurringOccurrenceDate: '2099-01-20',
      }] as React.ComponentProps<typeof RecurringPaymentsView>['transactions'],
    })

    fireEvent.click(screen.getByRole('button', { name: 'Pay Early for Insurance' }))
    const payNow = await screen.findByRole('button', { name: /Pay now/ })
    expect(screen.getByText('Already recorded')).toBeTruthy()

    fireEvent.click(payNow)
    await waitFor(() => expect(onPayEarly).toHaveBeenCalledWith('bill-essential', 40, 'acct-essentials', true))
  })

  it('charges the whole bill when nothing has been recorded against the occurrence', async () => {
    const onPayEarly = vi.fn()
    renderView({ onPayEarly, transactions: [] })

    fireEvent.click(screen.getByRole('button', { name: 'Pay Early for Insurance' }))
    const payNow = await screen.findByRole('button', { name: /Pay now/ })
    expect(screen.queryByText('Already recorded')).toBeNull()

    fireEvent.click(payNow)
    await waitFor(() => expect(onPayEarly).toHaveBeenCalledWith('bill-essential', 100, 'acct-essentials', true))
  })
})
