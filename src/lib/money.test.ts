import { describe, expect, it } from 'vitest'
import { roundMoney } from './money'

describe('roundMoney', () => {
  it('matches decimal half-away-from-zero money rounding', () => {
    expect(roundMoney(10.075)).toBe(10.08)
    expect(roundMoney(-0.125)).toBe(-0.13)
    expect(roundMoney(-10.075)).toBe(-10.08)
    expect(roundMoney(1262.045)).toBe(1262.05)
  })

  it('leaves non-finite values untouched', () => {
    expect(roundMoney(Number.NaN)).toBeNaN()
    expect(roundMoney(Number.POSITIVE_INFINITY)).toBe(Number.POSITIVE_INFINITY)
  })
})
