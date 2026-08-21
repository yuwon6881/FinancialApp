import { describe, expect, it } from 'vitest'
import type { Transaction } from '../types'
import { buildCycleSummaryInsights, buildReportBreakdown } from './reportCalculations'

const tx = (date: string, amount: number, category = 'Food', recurringPaymentId?: string): Transaction => ({
  id: `tx-${date}-${amount}`,
  date,
  amount,
  category,
  ledgerCategory: 'Essentials',
  description: 'Test Tx',
  recurringPaymentId,
})

describe('reportCalculations', () => {
  describe('buildReportBreakdown', () => {
    it('groups reportable outflows by category descending', () => {
      const transactions = [
        tx('2026-08-05', -50, 'Food'),
        tx('2026-08-06', -20, 'Food'),
        tx('2026-08-07', -100, 'Utilities'),
        tx('2026-08-08', 500, 'Salary'), // inflow excluded
      ]
      const breakdown = buildReportBreakdown(transactions)
      expect(breakdown).toEqual([
        { category: 'Utilities', amount: 100 },
        { category: 'Food', amount: 70 },
      ])
    })
  })

  describe('buildCycleSummaryInsights - no-spend days', () => {
    const cycleStart = new Date(2026, 7, 1) // Aug 1, 2026
    const cycleEnd = new Date(2026, 7, 31) // Aug 31, 2026

    it('returns 0 no-spend days for an upcoming cycle before start date', () => {
      const beforeStart = new Date(2026, 6, 25) // July 25, 2026
      const insights = buildCycleSummaryInsights([], cycleStart, cycleEnd, beforeStart)
      expect(insights.cycleLengthDays).toBe(31)
      expect(insights.noSpendDays).toBe(0)
    })

    it('counts only elapsed days and ignores future dates in an active cycle', () => {
      // Reference date: Aug 10, 2026 (10 days elapsed: Aug 1 to Aug 10)
      const referenceDate = new Date(2026, 7, 10)
      const transactions = [
        tx('2026-08-02', -15),
        tx('2026-08-05', -30),
        // Future transaction scheduled/recorded later in the month should not affect elapsed count
        tx('2026-08-20', -50),
      ]
      const insights = buildCycleSummaryInsights(transactions, cycleStart, cycleEnd, referenceDate)
      // 10 elapsed days - 2 days with spending in the elapsed window = 8 no-spend days
      expect(insights.noSpendDays).toBe(8)
    })

    it('counts all days in a completed past cycle', () => {
      const afterEnd = new Date(2026, 8, 5) // Sept 5, 2026
      const transactions = [
        tx('2026-08-02', -15),
        tx('2026-08-05', -30),
        tx('2026-08-20', -50),
      ]
      const insights = buildCycleSummaryInsights(transactions, cycleStart, cycleEnd, afterEnd)
      // 31 days total - 3 distinct days with spending = 28 no-spend days
      expect(insights.noSpendDays).toBe(28)
    })

    it('returns 0 no-spend days if every elapsed day had spending', () => {
      const referenceDate = new Date(2026, 7, 3) // Aug 3 (3 days elapsed: Aug 1, 2, 3)
      const transactions = [
        tx('2026-08-01', -10),
        tx('2026-08-02', -20),
        tx('2026-08-03', -30),
      ]
      const insights = buildCycleSummaryInsights(transactions, cycleStart, cycleEnd, referenceDate)
      expect(insights.noSpendDays).toBe(0)
    })
  })
})
