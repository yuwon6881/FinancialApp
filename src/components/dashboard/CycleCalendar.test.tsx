import { render, screen, fireEvent } from '@testing-library/react'
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
        transactions={[{ id: 'income', date: '2026-07-28', description: 'Income', category: 'Salary', ledgerCategory: 'Income', amount: 100 }]}
        recurringPayments={[]}
        formatNet={value => `$${value}`}
      />,
    )

    const calendarDays = screen.getByLabelText('Cycle days')
    expect(calendarDays.className).not.toContain('min-w-[420px]')
    expect(calendarDays.parentElement?.className).toContain('px-0.5')
    const amount = screen.getByText('$100')
    expect(amount.className).toContain('text-[7px]')
    expect(amount.className).toContain('md:text-[10px]')
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

    const spendingBtn = screen.getByRole('button', { name: 'Spending' })
    const netFlowBtn = screen.getByRole('button', { name: 'Net Flow' })
    const activityBtn = screen.getByRole('button', { name: 'Activity' })

    expect(spendingBtn.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('Less spending')).toBeTruthy()

    fireEvent.click(netFlowBtn)
    expect(netFlowBtn.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('Net outflow')).toBeTruthy()

    fireEvent.click(activityBtn)
    expect(activityBtn.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('Less activity')).toBeTruthy()
  })

  it('opens day preview popover on cell click and enables direct ledger navigation', () => {
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

    // Click on Jul 10 cell
    const jul10Button = screen.getByTitle(/Jul 10:.*Bills due: Streaming/)
    fireEvent.click(jul10Button)

    // Day preview popover should be open
    expect(screen.getByText('Dinner Out')).toBeTruthy()
    expect(screen.getByText('Streaming')).toBeTruthy()
    expect(screen.getByText('View in Ledger')).toBeTruthy()

    // Clicking "View in Ledger" triggers callback
    fireEvent.click(screen.getByText('View in Ledger'))
    expect(onSelectDate).toHaveBeenCalledWith('2026-07-10')
  })

  it('renders weekly pacing breakdown', () => {
    render(
      <CycleCalendar
        selectedMonth="Jul"
        selectedYear={2026}
        cycleDay={1}
        cycleLabel="Jul 1 ~ Jul 31, 2026"
        transactions={[
          { id: 'tx1', date: '2026-07-03', description: 'Coffee', category: 'Food', ledgerCategory: 'Essentials', amount: -10 },
        ]}
        recurringPayments={[]}
        formatNet={value => `$${value}`}
      />,
    )

    expect(screen.getByText('Weekly Spend Pacing')).toBeTruthy()
    expect(screen.getByText('Week 1')).toBeTruthy()
  })
})

