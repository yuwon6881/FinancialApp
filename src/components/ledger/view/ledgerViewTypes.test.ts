import { describe, expect, it } from 'vitest'
import { hasEffectiveAmountFilter, isUnusableAmountFilter, parseAmountFilter } from './ledgerViewTypes'

// The chips, the badge count and the URL all describe the amount range as an active filter. These
// pin them to what the predicate will actually apply: a bound it drops must not be advertised.
describe('amount filter usability', () => {
  it.each([
    ['', undefined],
    ['   ', undefined],
    ['0', 0],
    ['12.50', 12.5],
    ['-5', undefined],
    ['abc', undefined],
    ['NaN', undefined],
    ['Infinity', undefined],
  ])('parses %j as %j', (value, expected) => {
    expect(parseAmountFilter(value)).toBe(expected)
  })

  it('reports a typed bound the predicate cannot use', () => {
    expect(isUnusableAmountFilter('-5')).toBe(true)
    expect(isUnusableAmountFilter('abc')).toBe(true)
    expect(isUnusableAmountFilter('12.50')).toBe(false)
    // Nothing typed is not an error, just no filter.
    expect(isUnusableAmountFilter('')).toBe(false)
  })

  it('counts a range as active only when a bound survives parsing', () => {
    expect(hasEffectiveAmountFilter('', '')).toBe(false)
    expect(hasEffectiveAmountFilter('-5', '')).toBe(false)
    expect(hasEffectiveAmountFilter('-5', '-9')).toBe(false)
    expect(hasEffectiveAmountFilter('10', '')).toBe(true)
    expect(hasEffectiveAmountFilter('', '10')).toBe(true)
    expect(hasEffectiveAmountFilter('-5', '10')).toBe(true)
  })

  it('never calls a bound effective that the predicate would drop', () => {
    for (const value of ['', '-1', '-0.01', 'abc', '0', '1', '999.99']) {
      const parsed = parseAmountFilter(value)
      expect(hasEffectiveAmountFilter(value, '')).toBe(parsed !== undefined)
    }
  })
})
