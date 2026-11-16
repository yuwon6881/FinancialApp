import { describe, expect, it } from 'vitest'
import { stabilityRepaymentTermOptions } from './stabilityRepaymentTerms'

describe('stabilityRepaymentTermOptions', () => {
  it('offers only the common terms', () => {
    expect(stabilityRepaymentTermOptions(3).map(option => option.label))
      .toEqual(['1 month', '3 months', '6 months', '12 months', '18 months', '24 months'])
  })

  it('keeps a saved off-list term selectable in order', () => {
    expect(stabilityRepaymentTermOptions(9).map(option => option.value)).toEqual([1, 3, 6, 9, 12, 18, 24])
  })
})
