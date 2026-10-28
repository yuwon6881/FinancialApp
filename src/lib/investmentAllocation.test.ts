import { describe, expect, it } from 'vitest'
import type { InvestmentInstrument } from '../types'
import {
  allocationStatusLabel,
  buildSleeveIndex,
  roundSharesToTenth,
  sleeveLabelFor,
  sleeveOf,
  validateInvestmentPlan,
} from './investmentAllocation'

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

describe('roundSharesToTenth', () => {
  it('rounds plan shares together to sum to 100.0 with each result within 0.1 of input', () => {
    const input = [75.04, 10.02, 14.94]
    const result = roundSharesToTenth(input)
    expect(result).not.toBeNull()
    const sum = result!.reduce((acc, v) => acc + v, 0)
    expect(Math.round(sum * 10) / 10).toBe(100.0)
    result!.forEach((val, i) => {
      expect(Math.abs(val - input[i])).toBeLessThanOrEqual(0.1 + 1e-9)
    })
    expect(result).toEqual([75.1, 10.0, 14.9])
  })

  it('distributes tenths to ensure shares sum to 100.0', () => {
    const result = roundSharesToTenth([33.34, 33.33, 33.33])
    expect(result).toEqual([33.4, 33.3, 33.3])
    const sum = result!.reduce((acc, v) => acc + v, 0)
    expect(Math.round(sum * 10) / 10).toBe(100.0)
  })

  it('leaves clean integer shares unchanged', () => {
    expect(roundSharesToTenth([75, 10, 15])).toEqual([75, 10, 15])
  })

  it('returns null when shares do not sum to approximately 100', () => {
    expect(roundSharesToTenth([70, 10, 15])).toBeNull()
  })

  it('returns null for empty, non-finite, or negative inputs', () => {
    expect(roundSharesToTenth([])).toBeNull()
    expect(roundSharesToTenth([Number.NaN, 50, 50])).toBeNull()
    expect(roundSharesToTenth([-10, 60, 50])).toBeNull()
    expect(roundSharesToTenth([Number.POSITIVE_INFINITY, 0, 0])).toBeNull()
  })

  it('prevents overshoot where independent toFixed(1) would sum to 100.1', () => {
    const result = roundSharesToTenth([33.35, 33.35, 33.30])
    expect(result).toEqual([33.4, 33.3, 33.3])
    const sum = result!.reduce((acc, v) => acc + v, 0)
    expect(Math.round(sum * 10) / 10).toBe(100.0)
  })
})
