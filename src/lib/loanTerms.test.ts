import { describe, expect, it } from 'vitest'
import {
  LOAN_INTEREST_METHOD_COPY,
  LOAN_INTEREST_METHOD_OPTIONS,
  annualRateFromEntry,
  entryRateFromAnnual,
  formatRatePercent,
} from './loanTerms'

describe('loanTerms', () => {
  it('keeps all four method options in product order with plain-language copy', () => {
    expect(LOAN_INTEREST_METHOD_OPTIONS).toHaveLength(4)
    expect(LOAN_INTEREST_METHOD_OPTIONS.map(option => option.value)).toEqual([
      'ReducingBalance',
      'ReducingBalanceDaily',
      'Flat',
      'InterestOnly',
    ])
    expect(Object.values(LOAN_INTEREST_METHOD_COPY).map(copy => `${copy.label} ${copy.hint}`).join(' '))
      .not.toMatch(/amortis|principal|reducing balance|accrual/i)
  })

  it('round-trips a four-decimal monthly entry through the annual authority', () => {
    const annual = annualRateFromEntry(1.42, 'Monthly')

    expect(annual).toBe(17.04)
    expect(entryRateFromAnnual(annual, 'Monthly')).toBe(1.42)
    expect(formatRatePercent(annual)).toBe('17.04%')
  })

  it('shows the small yearly conversion drift instead of hiding it', () => {
    expect(entryRateFromAnnual(5.5, 'Monthly')).toBe(0.4583)
    expect(annualRateFromEntry(0.4583, 'Monthly')).toBe(5.4996)
  })
})
