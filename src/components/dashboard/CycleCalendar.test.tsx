import type React from 'react'
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

  const renderCalendar = (extra: Partial<React.ComponentProps<typeof CycleCalendar>> = {}) => render(
    <CycleCalendar
      selectedMonth="Jul"
      selectedYear={2026}
      cycleDay={1}
      cycleLabel="Jul 1 ~ Jul 31, 2026"
      transactions={[]}
      recurringPayments={[]}
      formatNet={value => `$${value}`}
      {...extra}
    />,
  )

  const salaryAndGroceries = [
    { id: '1', date: '2026-07-02', description: 'Salary', category: 'Salary', ledgerCategory: 'Income', amount: 500 },
    { id: '2', date: '2026-07-02', description: 'Groceries', category: 'Food', ledgerCategory: 'Essentials', amount: -200 },
  ]

  it('lists the cycle one row per week, each with seven day slots at most', () => {
    renderCalendar()

    const weeks = within(screen.getByLabelText('Cycle weeks')).getAllByRole('listitem')
    // Jul 1 is a Wednesday and the cycle ends Jul 31 (a Friday): five Sunday-first rows.
    expect(weeks).toHaveLength(5)
    expect(within(weeks[0]).getByText(/Jul 1 – Jul 4/)).toBeTruthy()
    for (const week of weeks) expect(within(week).getAllByRole('button').length).toBeLessThanOrEqual(7 + 1)
  })

  it('marks today with a filled date and aria-current', () => {
    renderCalendar()

    const today = screen.getByTitle('Jul 25: No cash activity.')
    expect(today.getAttribute('aria-current')).toBe('date')
    expect(today.textContent).toContain('25')
    expect(within(today).getByText('25').className).toContain('bg-primary')
  })

  it('distinguishes a day the cycle has not reached from a day with no spending', () => {
    renderCalendar()

    const future = screen.getByTitle('Jul 28: Not here yet.')
    const past = screen.getByTitle('Jul 20: No cash activity.')

    // Not yet reached: a hollow stub. Came and went with nothing spent: a flat filled stub.
    expect(future.getAttribute('data-state')).toBe('future')
    expect(past.getAttribute('data-state')).toBe('quiet')
  })

  it('scales each bar against the busiest day and leaves a zero-spend day flat', () => {
    renderCalendar({
      transactions: [
        { id: '1', date: '2026-07-20', description: 'Groceries', category: 'Food', ledgerCategory: 'Essentials', amount: -50 },
        { id: '2', date: '2026-07-21', description: 'Rent', category: 'Bills', ledgerCategory: 'Essentials', amount: -200 },
      ],
    })

    const bar = (title: RegExp | string) => screen.getByTitle(title).querySelector('[data-bar]') as HTMLElement
    expect(bar(/Jul 21:/).style.height).toBe('100%')
    expect(bar(/Jul 20:/).style.height).toBe('25%')
    expect(bar('Jul 19: No cash activity.').style.height).toBe('')
    expect(bar('Jul 19: No cash activity.').getAttribute('data-bar')).toBe('quiet')
  })

  it('hides bar heights with sensitive amounts', () => {
    renderCalendar({
      transactions: [{ id: 'income', date: '2026-07-01', description: 'Income', category: 'Salary', ledgerCategory: 'Income', amount: 100 }],
      formatNet: () => '••••',
      hideSensitive: true,
    })

    expect(screen.getByText('Bars are hidden while amounts are hidden.')).toBeTruthy()
    const day = screen.getByLabelText('Jul 1. Cash activity hidden.')
    expect(day.getAttribute('data-state')).toBe('quiet')
  })

  it('tracks spending only, with no mode toggle', () => {
    renderCalendar({ transactions: salaryAndGroceries })

    expect(screen.queryByRole('button', { name: /Net Flow/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Activity/ })).toBeNull()
    expect(screen.getByText(/more spending that day/)).toBeTruthy()
  })

  it('shows the spending for the week, never the positive net of a salary day', () => {
    renderCalendar({ transactions: salaryAndGroceries })

    const week = within(within(screen.getByLabelText('Cycle weeks')).getAllByRole('listitem')[0])
    expect(week.getByText('$-200')).toBeTruthy()
    expect(week.queryByText('$300')).toBeNull()
  })

  it('triggers onSelectWeek when an active week total is clicked', () => {
    const onSelectWeek = vi.fn()
    renderCalendar({
      transactions: [{ id: '1', date: '2026-07-02', description: 'Groceries', category: 'Food', ledgerCategory: 'Essentials', amount: -200 }],
      onSelectWeek,
    })

    fireEvent.click(screen.getByRole('button', { name: /View Week 1 transactions in Ledger/ }))
    expect(onSelectWeek).toHaveBeenCalledWith(
      expect.objectContaining({ weekNumber: 1, totalOutflow: 200 }),
    )
  })

  it('marks a week the cycle has not reached instead of showing it at zero', () => {
    renderCalendar()

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

  it('closes the selected day when the viewed cycle changes', () => {
    const transaction = {
      id: 'expense-1',
      date: '2026-07-10',
      description: 'Dinner Out',
      amount: -45,
      category: 'Dining',
      ledgerCategory: 'Essentials',
    }
    const { rerender } = render(
      <CycleCalendar
        selectedMonth="Jul"
        selectedYear={2026}
        cycleDay={1}
        cycleLabel="Jul 1st ~ Jul 31st, 2026"
        transactions={[transaction]}
        recurringPayments={[]}
        formatNet={value => `$${value}`}
      />,
    )

    fireEvent.click(screen.getByTitle(/Jul 10:/))
    expect(screen.getByRole('dialog')).toBeTruthy()

    rerender(
      <CycleCalendar
        selectedMonth="Aug"
        selectedYear={2026}
        cycleDay={1}
        cycleLabel="Aug 1st ~ Aug 31st, 2026"
        transactions={[]}
        recurringPayments={[]}
        formatNet={value => `$${value}`}
      />,
    )

    expect(screen.queryByRole('dialog')).toBeNull()
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
