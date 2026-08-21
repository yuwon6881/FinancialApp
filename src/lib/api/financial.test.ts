import { describe, expect, it } from 'vitest'
import { mapDashboardCore } from './financial'
import { obfuscateAmount } from './amounts'
import type { WireDashboardData } from '../apiTypes'

const wireDashboard = (cycleSummaryInsights: unknown): WireDashboardData => ({
  setting: {
    selectedMonth: 'Aug',
    selectedYear: 2026,
    targetStabilityFund: obfuscateAmount(10000),
    hideSensitive: false,
    darkMode: null,
    currency: 'MYR',
  },
  stats: {
    totalBalance: obfuscateAmount(0),
    monthlyIncome: obfuscateAmount(0),
    monthlyInflow: obfuscateAmount(0),
    monthlyExpenses: obfuscateAmount(0),
    activeRecurringTotal: obfuscateAmount(0),
  },
  categories: [],
  activeRecurringPayments: [],
  trendPoints: [],
  pendingNotifications: [],
  monthlyCategoryBreakdown: [],
  categoryLimitProgress: [],
  cycleSummaryInsights,
} as unknown as WireDashboardData)

describe('mapDashboardCore cycle summary insights', () => {
  // A cycle with no reportable expenses sends these as explicit nulls. Decoding a null as an
  // amount produced 0, so the report card claimed a real "$0.00 per day" average and a $0.00
  // biggest expense for a cycle that simply has no spending to describe.
  it('keeps unknown insight amounts absent rather than decoding them to zero', () => {
    const core = mapDashboardCore(wireDashboard({
      largestExpenseDescription: null,
      largestExpenseAmount: null,
      biggestDayDate: null,
      biggestDayTotal: null,
      avgDailySpend: null,
      cycleLengthDays: 31,
      velocityFirstHalf: null,
      velocitySecondHalf: null,
      noSpendDays: 31,
      transactionCount: 0,
      committedSpend: obfuscateAmount(0),
      discretionarySpend: obfuscateAmount(0),
    }))

    expect(core.cycleSummaryInsights?.avgDailySpend).toBeUndefined()
    expect(core.cycleSummaryInsights?.largestExpenseAmount).toBeUndefined()
    expect(core.cycleSummaryInsights?.largestExpenseDescription).toBeUndefined()
    expect(core.cycleSummaryInsights?.biggestDayTotal).toBeUndefined()
    expect(core.cycleSummaryInsights?.biggestDayDate).toBeUndefined()
    expect(core.cycleSummaryInsights?.velocityFirstHalf).toBeUndefined()
    expect(core.cycleSummaryInsights?.velocitySecondHalf).toBeUndefined()
    expect(core.cycleSummaryInsights?.cycleLengthDays).toBe(31)
  })

  it('decodes insight amounts that are present', () => {
    const core = mapDashboardCore(wireDashboard({
      largestExpenseDescription: 'Rent',
      largestExpenseAmount: obfuscateAmount(1200),
      biggestDayDate: '2026-08-03',
      biggestDayTotal: obfuscateAmount(1250),
      avgDailySpend: obfuscateAmount(62.5),
      cycleLengthDays: 31,
      velocityFirstHalf: obfuscateAmount(900),
      velocitySecondHalf: obfuscateAmount(350),
      noSpendDays: 12,
      transactionCount: 9,
      committedSpend: obfuscateAmount(1200),
      discretionarySpend: obfuscateAmount(50),
    }))

    expect(core.cycleSummaryInsights?.avgDailySpend).toBe(62.5)
    expect(core.cycleSummaryInsights?.largestExpenseAmount).toBe(1200)
    expect(core.cycleSummaryInsights?.biggestDayDate).toBe('2026-08-03')
  })
})
