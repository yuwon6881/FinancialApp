import { describe, expect, it } from 'vitest'
import type { InvestmentHistory, InvestmentHistoryYear } from '../types'
import { formatSignedPercent, headlineReturn, monthLabel, yearBarScale, yearLabel } from './investmentHistory'

const year = (overrides: Partial<InvestmentHistoryYear>): InvestmentHistoryYear => ({
  year: 2030,
  periodEnd: '2030-12-31',
  isFullYear: true,
  isComplete: true,
  missingReasons: [],
  segments: [],
  ...overrides,
})

const history = (lifetime: Partial<InvestmentHistory['lifetime']>): InvestmentHistory => ({
  currency: 'USD',
  lifetime: { isComplete: true, segments: [], ...lifetime },
  years: [],
  months: [],
})

describe('investment history formatting', () => {
  it('always signs a return and never shows a negative zero', () => {
    expect(formatSignedPercent(12.345)).toBe('+12.3%')
    expect(formatSignedPercent(-4)).toBe('−4.0%')
    expect(formatSignedPercent(-0.01)).toBe('0.0%')
  })

  it('headlines a yearly rate only once the server has one, else the return so far', () => {
    expect(headlineReturn(history({ annualisedReturnPercent: 7.1, cumulativeReturnPercent: 30 })))
      .toEqual({ label: 'Yearly return', value: 7.1 })
    expect(headlineReturn(history({ cumulativeReturnPercent: 3 })))
      .toEqual({ label: 'Return so far', value: 3 })
    // Unknown stays unknown rather than becoming zero.
    expect(headlineReturn(history({})).value).toBeUndefined()
  })

  it('labels a partial year by the months it covers, without time-zone drift', () => {
    expect(monthLabel('2026-10-31')).toBe('Oct 2026')
    const unfinished = year({ year: 2026, periodEnd: '2026-10-31', isFullYear: false })
    expect(yearLabel(unfinished)).toBe('Jan–Oct 2026')
    // The first year starts at the first settled month, not in January.
    expect(yearLabel(unfinished, '2026-03-31')).toBe('Mar–Oct 2026')
    expect(yearLabel(year({ year: 2026, periodEnd: '2026-12-31' }), '2026-03-31')).toBe('Mar–Dec 2026')
    expect(yearLabel(unfinished, '2026-10-31')).toBe('Oct 2026')
    // A history that began in an earlier year leaves this year starting in January.
    expect(yearLabel(year({}), '2025-06-30')).toBe('2030')
  })

  it('scales bars to the largest added-plus-growth year and ignores unknown growth', () => {
    expect(yearBarScale([
      year({ netContributions: 1000, growth: -200 }),
      year({ netContributions: 500, growth: undefined }),
    ])).toBe(1200)
    expect(yearBarScale([])).toBe(1)
  })
})
