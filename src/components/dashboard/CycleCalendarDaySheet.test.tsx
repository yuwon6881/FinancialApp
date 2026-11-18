import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CycleCalendarDay } from '../../lib/cycleCalendar'
import { CycleCalendarDaySheet } from './CycleCalendarDaySheet'

const prefs = vi.hoisted(() => ({ hideSensitive: true }))
vi.mock('../../contexts/AppContext', () => ({ useAppPrefs: () => prefs }))
vi.mock('../ui/BottomSheet', () => ({
  BottomSheet: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) => isOpen ? <div>{children}</div> : null,
}))

const day = {
  date: new Date('2026-08-12T00:00:00'), dateKey: '2026-08-12', net: 500, inflow: 500, outflow: 0,
  heatLevel: 0, recurring: [], recurringNames: [], isFuture: false, isToday: false, isWeekend: false,
  projectedBillsAmount: 0,
  transactions: [{ id: 'salary', date: '2026-08-12', description: 'August pay', category: 'Salary', ledgerCategory: 'Income', amount: 500 }],
} as unknown as CycleCalendarDay

describe('CycleCalendarDaySheet', () => {
  it('does not colour a masked inflow as money in', () => {
    prefs.hideSensitive = true
    render(<CycleCalendarDaySheet day={day} isOpen onClose={vi.fn()} formatAmount={() => '••••'} />)

    const amount = screen.getByText('August pay').closest('div')!.parentElement!.querySelector('span.shrink-0')!
    expect(amount.className).not.toMatch(/emerald/)
  })

  it('colours a visible inflow as money in', () => {
    prefs.hideSensitive = false
    render(<CycleCalendarDaySheet day={day} isOpen onClose={vi.fn()} formatAmount={value => String(value)} />)

    const amount = screen.getByText('August pay').closest('div')!.parentElement!.querySelector('span.shrink-0')!
    expect(amount.className).toMatch(/emerald/)
  })
})
