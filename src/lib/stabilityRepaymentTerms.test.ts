import { describe, expect, it } from 'vitest'
import { stabilityRepaymentPresets, stabilityRepaymentTermOptions } from './stabilityRepaymentTerms'

describe('stabilityRepaymentTermOptions', () => {
  it('offers every supported repayment term in order', () => {
    const options = stabilityRepaymentTermOptions()
    expect(options.map(option => option.value)).toEqual(Array.from({ length: 24 }, (_, index) => index + 1))
    expect(options[0].label).toBe('1 cycle')
    expect(options[23].label).toBe('24 cycles')
  })

  it('keeps common terms and Other in the first picker', () => {
    expect(stabilityRepaymentPresets.map(option => option.value)).toEqual([1, 3, 6, 12, 24, 'other'])
  })
})
