import { describe, expect, it } from 'vitest'
import { buildCycleCalendar } from './cycleCalendar'

describe('buildCycleCalendar', () => {
  it('clamps the cycle day and excludes transfers and adjustments from daily net activity', () => {
    const result = buildCycleCalendar({
      selectedMonth: 'Feb',
      selectedYear: 2026,
      cycleDay: 31,
      transactions: [
        { id: '1', date: '2026-02-28', description: 'Income', category: 'Salary', ledgerCategory: 'Income', amount: 100 },
        { id: '2', date: '2026-02-28', description: 'Move', category: 'Transfer', ledgerCategory: 'Transfer: Growth->Rewards', amount: -50 },
        { id: '3', date: '2026-02-28', description: 'Correction', category: 'adjustment', ledgerCategory: 'Essentials', amount: 25 },
      ],
      recurringPayments: [],
    })

    expect(result.days[0].dateKey).toBe('2026-02-28')
    expect(result.days[0].net).toBe(100)
    expect(result.days[0].inflow).toBe(100)
    expect(result.days[0].outflow).toBe(0)
    // An inflow-only day is not spending, so it carries no heat.
    expect(result.days[0].heatLevel).toBe(0)
    expect(result.days.at(-1)?.dateKey).toBe('2026-03-30')
  })

  it('grades each day by its spending against the busiest day', () => {
    const result = buildCycleCalendar({
      selectedMonth: 'Jul', selectedYear: 2026, cycleDay: 1, recurringPayments: [],
      transactions: [
        { id: '1', date: '2026-07-01', description: 'Small purchase', category: 'Food', ledgerCategory: 'Essentials', amount: -25 },
        { id: '2', date: '2026-07-02', description: 'Purchase', category: 'Food', ledgerCategory: 'Essentials', amount: -50 },
        { id: '3', date: '2026-07-03', description: 'Income', category: 'Salary', ledgerCategory: 'Income', amount: 100 },
        { id: '4', date: '2026-07-03', description: 'Groceries', category: 'Food', ledgerCategory: 'Essentials', amount: -100 },
      ],
    })

    // Income and the rest of a day's cash movement never count towards the heat.
    expect(result.days.slice(0, 4).map(day => day.heatLevel)).toEqual([1, 2, 4, 0])
  })

  it('groups recurring-payment names and identifies pending vs paid statuses', () => {
    const result = buildCycleCalendar({
      selectedMonth: 'Jun', selectedYear: 2026, cycleDay: 28, transactions: [],
      recurringPayments: [
        {
          id: 'bill1', recurringPaymentId: 'rp1', name: 'Cloud', amount: 10, category: 'Software',
          ledgerCategory: 'Essentials', dueDate: '2026-07-01', status: 'Pending', isPaid: false, isDiscarded: false,
        },
        {
          id: 'bill2', recurringPaymentId: 'rp2', name: 'Gym', amount: 50, category: 'Fitness',
          ledgerCategory: 'Essentials', dueDate: '2026-07-01', status: 'Paid', isPaid: true, isDiscarded: false,
        },
      ],
    })
    const day = result.days.find(d => d.dateKey === '2026-07-01')
    expect(day?.recurringNames).toEqual(['Cloud', 'Gym'])
    expect(day?.recurring.length).toBe(2)
    expect(day?.hasPendingBills).toBe(true)
    expect(day?.hasPaidBills).toBe(true)
    expect(day?.projectedBillsAmount).toBe(60)
  })

  it('distinguishes future days and aggregates weekly subtotals and stats', () => {
    const today = new Date(2026, 6, 15) // 2026-07-15
    const result = buildCycleCalendar({
      selectedMonth: 'Jul',
      selectedYear: 2026,
      cycleDay: 1,
      today,
      transactions: [
        { id: '1', date: '2026-07-01', description: 'Groceries', category: 'Food', ledgerCategory: 'Essentials', amount: -100 },
        { id: '2', date: '2026-07-10', description: 'Fuel', category: 'Transport', ledgerCategory: 'Essentials', amount: -50 },
      ],
      recurringPayments: [],
    })

    const pastDay = result.days.find(d => d.dateKey === '2026-07-01')
    const todayDay = result.days.find(d => d.dateKey === '2026-07-15')
    const futureDay = result.days.find(d => d.dateKey === '2026-07-20')

    expect(pastDay?.isFuture).toBe(false)
    expect(todayDay?.isToday).toBe(true)
    expect(todayDay?.isFuture).toBe(false)
    expect(futureDay?.isFuture).toBe(true)

    expect(result.weeks.length).toBeGreaterThan(3)
    expect(result.stats.totalOutflow).toBe(150)
    expect(result.stats.noSpendDaysCount).toBe(13) // up to today (15 days total - 2 spent days = 13 no-spend days)
  })

  it('does not overflow a January day-31 boundary into March', () => {
    const result = buildCycleCalendar({
      selectedMonth: 'Jan', selectedYear: 2025, cycleDay: 31, transactions: [], recurringPayments: [],
    })

    expect(result.days[0].dateKey).toBe('2025-01-31')
    expect(result.days.at(-1)?.dateKey).toBe('2025-02-27')
  })

  it('summarises each week by spending and elapsed days as well as flow', () => {
    const result = buildCycleCalendar({
      selectedMonth: 'Jul',
      selectedYear: 2026,
      cycleDay: 1,
      today: new Date(2026, 6, 2),
      transactions: [
        { id: '1', date: '2026-07-01', description: 'Groceries', category: 'Food', ledgerCategory: 'Essentials', amount: -100 },
        { id: '2', date: '2026-07-02', description: 'Salary', category: 'Salary', ledgerCategory: 'Income', amount: 400 },
      ],
      recurringPayments: [
        {
          id: 'bill1', recurringPaymentId: 'rp1', name: 'Cloud', amount: 60, category: 'Software',
          ledgerCategory: 'Essentials', dueDate: '2026-07-20', status: 'Pending', isPaid: false, isDiscarded: false,
        },
      ],
    })

    const firstWeek = result.weeks[0]
    expect(firstWeek.totalOutflow).toBe(100)
    expect(firstWeek.totalNet).toBe(300)
    expect(firstWeek.elapsedDayCount).toBe(2)
    expect(firstWeek.projectedBillsAmount).toBe(0)

    const billWeek = result.weeks.find(week => week.startDate <= '2026-07-20' && week.endDate >= '2026-07-20')
    expect(billWeek?.elapsedDayCount).toBe(0)
    expect(billWeek?.projectedBillsAmount).toBe(60)
  })
})
