import { describe, expect, it } from 'vitest'
import { normalizeRecurringFrequency } from './recurringPayments'

describe('normalizeRecurringFrequency', () => {
  it('coerces a legacy Weekly value to Monthly', () => {
    expect(normalizeRecurringFrequency('Weekly')).toBe('Monthly')
  })

  it('preserves supported frequencies', () => {
    expect(normalizeRecurringFrequency('Monthly')).toBe('Monthly')
    expect(normalizeRecurringFrequency('Annually')).toBe('Annually')
  })
})
