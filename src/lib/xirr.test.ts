import { describe, expect, it } from 'vitest'
import { xirr } from './xirr'

const close = (value: number | undefined, expected: number) => {
  expect(value).toBeDefined()
  expect(Math.abs(value! - expected)).toBeLessThan(0.002)
}

describe('xirr', () => {
  it('returns 10% for money that grew 10% over exactly one year', () => {
    close(xirr([
      { date: '2025-01-01', amount: -1000 },
      { date: '2026-01-01', amount: 1100 },
    ]), 0.1)
  })

  it('annualises a short holding period rather than reporting the raw gain', () => {
    // +2% over roughly a month is far more than 2% a year.
    const rate = xirr([
      { date: '2026-01-01', amount: -1000 },
      { date: '2026-02-01', amount: 1020 },
    ])
    expect(rate).toBeDefined()
    expect(rate!).toBeGreaterThan(0.25)
  })

  it('handles regular contributions, where gain-on-cost would mislead', () => {
    // Three 1000 deposits across a year ending at 3200: the money was not all
    // invested for the full year, so the true rate is well above 3200/3000 - 1.
    const rate = xirr([
      { date: '2025-01-01', amount: -1000 },
      { date: '2025-05-01', amount: -1000 },
      { date: '2025-09-01', amount: -1000 },
      { date: '2026-01-01', amount: 3200 },
    ])
    expect(rate).toBeDefined()
    expect(rate!).toBeGreaterThan(0.066)
  })

  it('reports losses as a negative rate', () => {
    close(xirr([
      { date: '2025-01-01', amount: -1000 },
      { date: '2026-01-01', amount: 900 },
    ]), -0.1)
  })

  it('gives up rather than guessing when the flows cannot define a rate', () => {
    expect(xirr([])).toBeUndefined()
    expect(xirr([{ date: '2026-01-01', amount: -100 }])).toBeUndefined()
    // No money ever came back.
    expect(xirr([
      { date: '2025-01-01', amount: -100 },
      { date: '2026-01-01', amount: -100 },
    ])).toBeUndefined()
    // Everything on one day: no elapsed time to spread a return over.
    expect(xirr([
      { date: '2026-01-01', amount: -100 },
      { date: '2026-01-01', amount: 110 },
    ])).toBeUndefined()
    expect(xirr([
      { date: 'not-a-date', amount: -100 },
      { date: '2026-01-01', amount: 110 },
    ])).toBeUndefined()
  })

  it('ignores zero-amount entries instead of counting them as flows', () => {
    expect(xirr([
      { date: '2025-01-01', amount: 0 },
      { date: '2026-01-01', amount: 0 },
    ])).toBeUndefined()
  })

  it('survives a total loss without returning NaN', () => {
    const rate = xirr([
      { date: '2025-01-01', amount: -1000 },
      { date: '2026-01-01', amount: 0.01 },
    ])
    expect(rate === undefined || Number.isFinite(rate)).toBe(true)
  })
})
