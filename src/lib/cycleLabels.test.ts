import { describe, expect, it } from 'vitest'
import { ordinal, ordinalSuffix, getCycleLabelForDropdown } from './cycleLabels'

describe('ordinalSuffix', () => {
  it('handles the 1/2/3 base cases', () => {
    expect(ordinalSuffix(1)).toBe('st')
    expect(ordinalSuffix(2)).toBe('nd')
    expect(ordinalSuffix(3)).toBe('rd')
    expect(ordinalSuffix(4)).toBe('th')
  })

  it('treats the 11-13 teens as "th"', () => {
    expect(ordinalSuffix(11)).toBe('th')
    expect(ordinalSuffix(12)).toBe('th')
    expect(ordinalSuffix(13)).toBe('th')
  })

  it('uses the ones digit for 21/22/23/31', () => {
    expect(ordinalSuffix(21)).toBe('st')
    expect(ordinalSuffix(22)).toBe('nd')
    expect(ordinalSuffix(23)).toBe('rd')
    expect(ordinalSuffix(31)).toBe('st')
  })
})

describe('ordinal', () => {
  it('prepends the number to the suffix', () => {
    expect(ordinal(1)).toBe('1st')
    expect(ordinal(22)).toBe('22nd')
    expect(ordinal(13)).toBe('13th')
  })
})

describe('getCycleLabelForDropdown', () => {
  it('returns the input unchanged for an unknown month', () => {
    expect(getCycleLabelForDropdown('Foo', 2026, 28)).toBe('Foo')
  })

  it('formats a mid-month cycle spanning into the next month', () => {
    // Jun 28 -> Jul 27
    expect(getCycleLabelForDropdown('Jun', 2026, 28)).toBe('Jun 28th ~ Jul 27th')
  })

  it('formats a cycleDay=1 cycle as the whole calendar month', () => {
    expect(getCycleLabelForDropdown('Jul', 2026, 1)).toBe('Jul 1st ~ Jul 31st')
    expect(getCycleLabelForDropdown('Feb', 2026, 1)).toBe('Feb 1st ~ Feb 28th')
    expect(getCycleLabelForDropdown('Feb', 2024, 1)).toBe('Feb 1st ~ Feb 29th')
  })

  it('clamps the start day to the anchor month length', () => {
    // Feb has no 31st: start clamps to Feb 28 (2026), end is one month later minus a day.
    expect(getCycleLabelForDropdown('Feb', 2026, 31)).toBe('Feb 28th ~ Mar 27th')
  })

  it('clamps AddMonths when a day-31 cycle enters February', () => {
    expect(getCycleLabelForDropdown('Jan', 2025, 31)).toBe('Jan 31st ~ Feb 27th')
  })

  it('rolls the end month across a year boundary', () => {
    // Dec 15 -> Jan 14 of the following year (label omits the year).
    expect(getCycleLabelForDropdown('Dec', 2026, 15)).toBe('Dec 15th ~ Jan 14th')
  })
})
