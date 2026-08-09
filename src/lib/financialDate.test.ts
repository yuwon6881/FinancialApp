import { describe, expect, it } from 'vitest'
import { financialDate } from './financialDate'

describe('financialDate', () => {
  it('uses the Malaysia calendar date across the UTC boundary', () => {
    expect(financialDate(new Date('2026-08-08T17:00:00.000Z'))).toBe('2026-08-09')
  })
})
