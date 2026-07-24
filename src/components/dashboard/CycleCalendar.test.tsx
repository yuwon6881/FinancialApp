import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CycleCalendar } from './CycleCalendar'

describe('CycleCalendar current-day edge highlight', () => {
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

    const today = screen.getByTitle('Jul 25')
    expect(today.className).toContain('ring-inset')
    expect(today.className).toContain('ring-blue-500')
    expect(container.querySelector('[aria-label="Cycle days"]')?.parentElement?.className).toContain('px-0.5')
  })
})
