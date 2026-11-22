import { describe, expect, it } from 'vitest'
import { stabilityRepaymentTermOptions } from './stabilityRepaymentTerms'

describe('stabilityRepaymentTermOptions', () => {
  it('offers every supported repayment term in order', () => {
    const options = stabilityRepaymentTermOptions()
    expect(options.map(option => option.value)).toEqual(Array.from({ length: 24 }, (_, index) => index + 1))
    expect(options[0].label).toBe('1 month')
    expect(options[1].label).toBe('2 months')
    expect(options[23].label).toBe('24 months')
  })
})
