import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CycleCalendar } from './CycleCalendar'

describe('CycleCalendar', () => {
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
    expect(calendarDays.parentElement?.className).toContain('overflow-hidden')
    expect(screen.getByText('$100').className).toContain('text-[7px]')
  })
})