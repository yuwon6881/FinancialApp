import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { chartRanges } from '../../lib/investmentChartRanges'
import { RECURRING_LEDGER_CATEGORIES, SAVINGS_GOAL_FUNDING_BUCKETS } from '../../lib/ledgerCategories'
import { REFRESH_HEADER_NAME, REFRESH_SLICES } from '../../lib/refreshSlices'

type ConstantsFixture = {
  domain: string
  version: number
  sets: Record<string, string[]>
}

const frontendConstants: Record<string, readonly string[]> = {
  LoanInterestMethod: ['ReducingBalance', 'ReducingBalanceDaily', 'Flat', 'InterestOnly'],
  LoanRateBasis: ['Yearly', 'Monthly'],
  RecurringPaymentMode: ['AutoDeduct', 'Manual'],
  CategoryFlowType: ['both', 'inflow', 'outflow'],
  SavingsGoalStatus: ['active', 'completed'],
  StabilityReloadIntent: ['Unanswered', 'Required', 'NotRequired'],
  StabilityOverflowRedirect: [
    'Essentials 100%',
    'Growth 100%',
    'Rewards 100%',
    'Split: Essentials 50%, Growth 50%',
    'Split: Essentials 50%, Rewards 50%',
    'Split: Growth 50%, Rewards 50%',
  ],
  FundingBucket: SAVINGS_GOAL_FUNDING_BUCKETS,
  LedgerBucket: RECURRING_LEDGER_CATEGORIES,
  PushChannel: ['billReminders', 'categoryAlerts'],
  InvestmentChartRange: chartRanges.map(range => range.value),
  RefreshSlice: REFRESH_SLICES,
  RefreshHeader: [REFRESH_HEADER_NAME],
}

function readFixture(): ConstantsFixture {
  return JSON.parse(
    readFileSync(new URL('./fixtures/constants.cases.json', import.meta.url), 'utf8'),
  ) as ConstantsFixture
}

describe('constant contract parity', () => {
  it('keeps frontend string contracts equal to the canonical fixture', () => {
    const fixture = readFixture()

    expect(fixture.domain).toBe('constants')
    expect(fixture.version).toBe(1)
    expect(Object.keys(frontendConstants).sort()).toEqual(Object.keys(fixture.sets).sort())

    for (const [name, values] of Object.entries(frontendConstants)) {
      expect([...values].sort(), `${name} differs from the canonical contract`).toEqual(
        [...fixture.sets[name]].sort(),
      )
      expect(new Set(values).size, `${name} must not contain duplicate values`).toBe(values.length)
    }
  })
})
