import { describe, expect, it } from 'vitest'
import { buildCycleCalendar } from './cycleCalendar'

describe('buildCycleCalendar', () => {
  it('clamps the cycle day and excludes transfers from daily net activity', () => {
    const result = buildCycleCalendar({
      selectedMonth: 'Feb',
      selectedYear: 2026,
      cycleDay: 31,
      transactions: [
        { id: '1', date: '2026-02-28', description: 'Income', category: 'Salary', ledgerCategory: 'Income', amount: 100 },
        { id: '2', date: '2026-02-28', description: 'Move', category: 'Transfer', ledgerCategory: 'Transfer: Growth->Rewards', amount: -50 },
      ],
      recurringPayments: [],
    })

    expect(result.days[0].dateKey).toBe('2026-02-28')
    expect(result.days[0].net).toBe(100)
    expect(result.days.at(-1)?.dateKey).toBe('2026-03-27')
  })

  it('groups recurring-payment names by due date', () => {
    const result = buildCycleCalendar({
      selectedMonth: 'Jun', selectedYear: 2026, cycleDay: 28, transactions: [],
      recurringPayments: [{
        id: 'bill', recurringPaymentId: 'rp', name: 'Cloud', amount: 10, category: 'Software',
        ledgerCategory: 'Essentials', dueDate: '2026-07-01', status: 'Pending', isPaid: false, isDiscarded: false,
      }],
    })
    expect(result.days.find(day => day.dateKey === '2026-07-01')?.recurringNames).toEqual(['Cloud'])
  })

  it('does not overflow a January day-31 boundary into March', () => {
    const result = buildCycleCalendar({
      selectedMonth: 'Jan', selectedYear: 2025, cycleDay: 31, transactions: [], recurringPayments: [],
    })

    expect(result.days[0].dateKey).toBe('2025-01-31')
    expect(result.days.at(-1)?.dateKey).toBe('2025-02-27')
  })
})
