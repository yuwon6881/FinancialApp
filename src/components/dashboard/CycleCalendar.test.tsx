import { render, screen, fireEvent, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CycleCalendar } from './CycleCalendar'

describe('CycleCalendar component', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Saturday places today in the last calendar column.
    vi.setSystemTime(new Date(2026, 6, 25, 12))
  })

  afterEach(() => vi.useRealTimers())

  it('fits its complete seven-day grid within the report on mobile', () => {
    render(
      <CycleCalendar
        selectedMonth="Jul"
        selectedYear={2026}
        cycleDay={28}
        cycleLabel="Jul 28th ~ Aug 27th, 2026"
        transactions={[{ id: 'expense', date: '2026-07-28', description: 'Groceries', category: 'Food', ledgerCategory: 'Essentials', amount: -100 }]}
        recurringPayments={[]}
        formatNet={value => `$${value}`}
      />,
    )

    const calendarDays = screen.getByLabelText('Cycle days')
    expect(calendarDays.className).not.toContain('min-w-[420px]')
    expect(calendarDays.parentElement?.className).toContain('px-0.5')
    // Figures are tablet/desktop detail; the phone column carries a presence dot instead.
    const amount = screen.getByText('$-100')
    expect(amount.className).toContain('hidden')
    expect(amount.className).toContain('md:inline')
    expect(screen.getByLabelText('Cash activity heat scale')).toBeTruthy()
  })

  it('keeps the current-day ring inside the card at an edge column', () => {
    const { container } = render(
      <CycleCalendar
        selectedMonth="Jul"
        selectedYear={2026}
        cycleDay={1}
        cycleLabel="Jul 1 ~ Jul 31, 2026"
        transactions={[]}
        recurringPayments={[]}
        formatNet={value => String(value)}
      />,
    )

    const today = screen.getByTitle('Jul 25: No cash activity.')
    expect(today.className).toContain('ring-inset')
    expect(today.className).toContain('ring-blue-500')
    expect(container.querySelector('[aria-label="Cycle days"]')?.parentElement?.className).toContain('px-0.5')
  })

  it('distinguishes a day the cycle has not reached from a day with no spending', () => {
    render(
      <CycleCalendar
        selectedMonth="Jul"
        selectedYear={2026}
        cycleDay={1}
        cycleLabel="Jul 1 ~ Jul 31, 2026"
        transactions={[]}
        recurringPayments={[]}
        formatNet={value => String(value)}
      />,
    )

    const future = screen.getByTitle('Jul 28: Not here yet.')
    const past = screen.getByTitle('Jul 20: No cash activity.')

    expect(future.className).toContain('border-dashed')
    expect(future.style.backgroundImage).toContain('repeating-linear-gradient')
    expect(past.className).not.toContain('border-dashed')
    expect(past.style.backgroundImage).toBe('')
  })

  it('renders a centre dot for zero-spend days that remains visible on desktop', () => {
    render(
      <CycleCalendar
        selectedMonth="Jul"
        selectedYear={2026}
        cycleDay={1}
        cycleLabel="Jul 1 ~ Jul 31, 2026"
        transactions={[]}
        recurringPayments={[]}
        formatNet={value => String(value)}
      />,
    )

    const past = screen.getByTitle('Jul 20: No cash activity.')
    const dot = past.querySelector('[aria-hidden="true"]') as HTMLElement
    expect(dot).toBeTruthy()
    expect(dot.className).toContain('rounded-full')
    expect(dot.className).toContain('size-1')
    expect(dot.className).toContain('bg-muted-foreground/40')
    expect(dot.className).not.toContain('md:hidden')

    const future = screen.getByTitle('Jul 28: Not here yet.')
    const futureDot = future.querySelector('[aria-hidden="true"]')
    expect(futureDot).toBeNull()
  })

  it('hides the presence dot on desktop when an amount figure is displayed', () => {
    render(
      <CycleCalendar
        selectedMonth="Jul"
        selectedYear={2026}
        cycleDay={1}
        cycleLabel="Jul 1 ~ Jul 31, 2026"
        transactions={[{ id: '1', date: '2026-07-20', description: 'Groceries', category: 'Food', ledgerCategory: 'Essentials', amount: -50 }]}
        recurringPayments={[]}
        formatNet={value => `$${value}`}
      />,
    )

    const dayWithSpend = screen.getByTitle(/Jul 20:/)
    const dot = dayWithSpend.querySelector('span[aria-hidden="true"]') as HTMLElement
    expect(dot).toBeTruthy()
    expect(dot.className).toContain('size-1.5')
    expect(dot.className).toContain('md:hidden')
  })

  it('hides activity intensity with sensitive amounts', () => {
    render(
      <CycleCalendar
        selectedMonth="Jul"
        selectedYear={2026}
        cycleDay={1}
        cycleLabel="Jul 1 ~ Jul 31, 2026"
        transactions={[{ id: 'income', date: '2026-07-01', description: 'Income', category: 'Salary', ledgerCategory: 'Income', amount: 100 }]}
        recurringPayments={[]}
        formatNet={() => '••••'}
        hideSensitive
      />,
    )

    expect(screen.getByText('Activity shading is hidden while amounts are hidden.')).toBeTruthy()
    expect(screen.queryByLabelText('Cash activity heat scale')).toBeNull()
    expect((screen.getByLabelText('Jul 1. Cash activity hidden.') as HTMLElement).style.backgroundColor).toBe('')
  })

  it('switches heatmap modes between Spending, Net Flow, and Activity', () => {
    render(
      <CycleCalendar
        selectedMonth="Jul"
        selectedYear={2026}
        cycleDay={1}
        cycleLabel="Jul 1 ~ Jul 31, 2026"
        transactions={[
          { id: '1', date: '2026-07-01', description: 'Groceries', category: 'Food', ledgerCategory: 'Essentials', amount: -50 },
          { id: '2', date: '2026-07-02', description: 'Salary', category: 'Salary', ledgerCategory: 'Income', amount: 500 },
        ]}
        recurringPayments={[]}
        formatNet={value => `$${value}`}
      />,
    )

    const spendingBtn = screen.getByRole('button', { name: /Spending/ })
    const netFlowBtn = screen.getByRole('button', { name: /Net Flow/ })
    const activityBtn = screen.getByRole('button', { name: /Activity/ })

    expect(spendingBtn.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('Less spending')).toBeTruthy()

    fireEvent.click(netFlowBtn)
    expect(netFlowBtn.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('Net outflow')).toBeTruthy()

    fireEvent.click(activityBtn)
    expect(activityBtn.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('Less activity')).toBeTruthy()
  })

  it('shows only spending in Spending mode and follows the mode elsewhere', () => {
    render(
      <CycleCalendar
        selectedMonth="Jul"
        selectedYear={2026}
        cycleDay={1}
        cycleLabel="Jul 1 ~ Jul 31, 2026"
        transactions={[
          { id: '1', date: '2026-07-02', description: 'Salary', category: 'Salary', ledgerCategory: 'Income', amount: 500 },
          { id: '2', date: '2026-07-02', description: 'Groceries', category: 'Food', ledgerCategory: 'Essentials', amount: -200 },
        ]}
        recurringPayments={[]}
        formatNet={value => `$${value}`}
      />,
    )

    const grid = () => within(screen.getByLabelText('Cycle days'))

    // Spending mode reports the outflow, never the day's positive net.
    expect(grid().getByText('$-200')).toBeTruthy()
    expect(grid().queryByText('$300')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Net Flow/ }))
    expect(grid().getByText('$300')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Activity/ }))
    expect(grid().getByText('$700')).toBeTruthy()
  })

  it('repaces the weekly breakdown when the mode changes', () => {
    render(
      <CycleCalendar
        selectedMonth="Jul"
        selectedYear={2026}
        cycleDay={1}
        cycleLabel="Jul 1 ~ Jul 31, 2026"
        transactions={[
          { id: '1', date: '2026-07-02', description: 'Salary', category: 'Salary', ledgerCategory: 'Income', amount: 500 },
          { id: '2', date: '2026-07-02', description: 'Groceries', category: 'Food', ledgerCategory: 'Essentials', amount: -200 },
        ]}
        recurringPayments={[]}
        formatNet={value => `$${value}`}
      />,
    )

    expect(screen.getByText('Weekly Spend Pacing')).toBeTruthy()
    expect(screen.getByText('Week 1')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Net Flow/ }))
    expect(screen.getByText('Weekly Net Pacing')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Activity/ }))
    expect(screen.getByText('Weekly Activity Pacing')).toBeTruthy()
  })

  it('marks a week the cycle has not reached instead of pacing it at zero', () => {
    render(
      <CycleCalendar
        selectedMonth="Jul"
        selectedYear={2026}
        cycleDay={1}
        cycleLabel="Jul 1 ~ Jul 31, 2026"
        transactions={[]}
        recurringPayments={[]}
        formatNet={value => `$${value}`}
      />,
    )

    expect(screen.getAllByText('Not here yet').length).toBeGreaterThan(0)
  })

  it('opens the day breakdown as a modal sheet with real bill amounts', () => {
    const onSelectDate = vi.fn()
    render(
      <CycleCalendar
        selectedMonth="Jul"
        selectedYear={2026}
        cycleDay={1}
        cycleLabel="Jul 1 ~ Jul 31, 2026"
        transactions={[
          { id: 'tx1', date: '2026-07-10', description: 'Dinner Out', category: 'Dining', ledgerCategory: 'Essentials', amount: -45 },
        ]}
        recurringPayments={[
          {
            id: 'rp1',
            recurringPaymentId: 'sub1',
            name: 'Streaming',
            amount: 15,
            scheduledAmount: 15,
            paidAmount: 0,
            remainingAmount: 15,
            category: 'Entertainment',
            ledgerCategory: 'Essentials',
            dueDate: '2026-07-10',
            status: 'Pending',
            isPaid: false,
            isDiscarded: false,
          },
        ]}
        formatNet={value => `$${value}`}
        onSelectDate={onSelectDate}
      />,
    )

    fireEvent.click(screen.getByTitle(/Jul 10:.*Bills due: Streaming/))

    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(screen.getByText('Dinner Out')).toBeTruthy()
    expect(screen.getByText('Streaming')).toBeTruthy()
    // Bills render as outflow figures, matching the "Money out" tile above them.
    expect(screen.getByText('$-15')).toBeTruthy()
    expect(screen.queryByText(/NaN/)).toBeNull()

    fireEvent.click(screen.getByText('View in Ledger'))
    expect(onSelectDate).toHaveBeenCalledWith('2026-07-10')
  })

  it('reports an occurrence with no scheduled amount honestly instead of as zero', () => {
    render(
      <CycleCalendar
        selectedMonth="Jul"
        selectedYear={2026}
        cycleDay={1}
        cycleLabel="Jul 1 ~ Jul 31, 2026"
        transactions={[]}
        recurringPayments={[
          {
            id: 'rp1',
            recurringPaymentId: 'sub1',
            name: 'Variable Utility',
            amount: null,
            category: 'Utilities',
            ledgerCategory: 'Essentials',
            dueDate: '2026-07-10',
            status: 'Pending',
            isPaid: false,
            isDiscarded: false,
          },
        ]}
        formatNet={value => `$${value}`}
      />,
    )

    fireEvent.click(screen.getByTitle(/Jul 10:.*Bills due: Variable Utility/))
    expect(screen.getByText('Amount not set')).toBeTruthy()
  })

  it('shows what a settled bill cost rather than its zero remaining balance', () => {
    render(
      <CycleCalendar
        selectedMonth="Jul"
        selectedYear={2026}
        cycleDay={1}
        cycleLabel="Jul 1 ~ Jul 31, 2026"
        transactions={[]}
        recurringPayments={[
          {
            id: 'rp1',
            recurringPaymentId: 'sub1',
            name: 'Streaming',
            amount: 15,
            scheduledAmount: 15,
            paidAmount: 15,
            remainingAmount: 0,
            category: 'Entertainment',
            ledgerCategory: 'Essentials',
            dueDate: '2026-07-10',
            status: 'Paid',
            isPaid: true,
            isDiscarded: false,
          },
          {
            id: 'rp2',
            recurringPaymentId: 'sub2',
            name: 'Gym',
            amount: 40,
            scheduledAmount: 40,
            paidAmount: 0,
            remainingAmount: 0,
            category: 'Health',
            ledgerCategory: 'Essentials',
            dueDate: '2026-07-10',
            // A loan payoff settles the occurrence without a tagged transaction of its own.
            status: 'SettledByLoanPayoff',
            isPaid: true,
            isDiscarded: false,
          },
        ]}
        formatNet={value => `$${value}`}
      />,
    )

    fireEvent.click(screen.getByTitle(/Jul 10:.*Bills due: Streaming, Gym/))

    const bills = screen.getByText(/Bills due/).closest('div')?.parentElement
    expect(within(bills as HTMLElement).getByText('$-15')).toBeTruthy()
    expect(within(bills as HTMLElement).getByText('$-40')).toBeTruthy()
    expect(within(bills as HTMLElement).queryByText('$-0')).toBeNull()
  })
})
