import { describe, expect, it } from 'vitest'
import type { InvestmentInstrument } from '../types'
import { allocationStatusLabel, buildSleeveIndex, sleeveLabelFor, sleeveOf, validateInvestmentPlan } from './investmentAllocation'

const instrument = (overrides: Partial<InvestmentInstrument>): InvestmentInstrument => ({
  id: 'instrument-1', symbol: 'VOO', name: 'Vanguard S&P 500 ETF', type: 'ETF', currency: 'USD',
  isCustom: false, isArchived: false, ...overrides,
})

describe('validateInvestmentPlan', () => {
  it('rejects blank, non-finite, and out-of-range drift bands', () => {
    const plan = {
      usEquityTarget: 66,
      internationalExUsTarget: 10,
      bondsTarget: 24,
      watchDrift: 3,
      alertDrift: 5,
    }

    expect(validateInvestmentPlan({ ...plan, watchDrift: Number.NaN })).toContain('valid numbers')
    expect(validateInvestmentPlan({ ...plan, alertDrift: 101 })).toContain('100')
    expect(validateInvestmentPlan(plan)).toBe('')
  })
})

describe('investment allocation sleeve index', () => {
  it('maps assigned instruments to their display label', () => {
    const index = buildSleeveIndex([instrument({ allocationSleeve: 'USEquity' })])
    expect(sleeveOf({ instrumentId: 'instrument-1' }, index)).toEqual({ sleeve: 'USEquity', key: 'USEquity', label: 'US shares' })
  })

  it('returns the unassigned entry for unclassified and unknown instruments', () => {
    const index = buildSleeveIndex([instrument({})])
    expect(sleeveOf({ instrumentId: 'instrument-1' }, index)).toEqual({ key: 'Unassigned', label: 'Not sorted yet' })
    expect(sleeveOf({ instrumentId: 'missing' }, index)).toEqual({ key: 'Unassigned', label: 'Not sorted yet' })
  })

  it('resolves a label from a key alone, and falls back to the key when unknown', () => {
    const index = buildSleeveIndex([instrument({ allocationSleeve: 'Bonds' })])
    expect(sleeveLabelFor('Bonds', index)).toBe('Bonds')
    expect(sleeveLabelFor('Unassigned', index)).toBe('Not sorted yet')
    expect(sleeveLabelFor('Mystery', index)).toBe('Mystery')
  })
})

describe('allocationStatusLabel', () => {
  it('never leaks a raw status code to the screen', () => {
    expect(allocationStatusLabel('OnTrack')).toBe('On track')
    expect(allocationStatusLabel('NotStarted')).toBe('Not started')
    expect(allocationStatusLabel('Incomplete')).toBe('Needs sorting')
    expect(allocationStatusLabel('Watch')).toBe('Drifting')
    expect(allocationStatusLabel('Alert')).toBe('Off target')
  })
})
