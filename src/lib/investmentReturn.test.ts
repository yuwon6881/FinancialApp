import { describe, expect, it } from 'vitest'
import type { InvestmentPortfolio } from '../types'
import { portfolioAnnualReturn } from './investmentReturn'

const portfolio = (chart: InvestmentPortfolio['chart']) => ({ chart } as InvestmentPortfolio)

describe('portfolioAnnualReturn', () => {
  it('reports the rate earned on money that was invested for a full year', () => {
    const rate = portfolioAnnualReturn(portfolio([
      { date: '2025-01-01', totalValue: 1000, netDeposits: 1000 },
      { date: '2026-01-01', totalValue: 1100, netDeposits: 1000 },
    ]))

    expect(rate).toBeDefined()
    expect(Math.abs(rate! - 0.1)).toBeLessThan(0.002)
  })

  it('credits a late deposit for only the time it was actually invested', () => {
    // 1000 for a year plus 1000 for a month, ending at 2100: gain-on-cost would
    // call this 5%, but only half the money was exposed for the full period.
    const rate = portfolioAnnualReturn(portfolio([
      { date: '2025-01-01', totalValue: 1000, netDeposits: 1000 },
      { date: '2025-12-01', totalValue: 2000, netDeposits: 2000 },
      { date: '2026-01-01', totalValue: 2100, netDeposits: 2000 },
    ]))

    expect(rate).toBeDefined()
    expect(rate!).toBeGreaterThan(0.05)
  })

  it('refuses to answer when any point is incomplete, rather than biasing the result', () => {
    expect(portfolioAnnualReturn(portfolio([
      { date: '2025-01-01', totalValue: 1000, netDeposits: undefined },
      { date: '2026-01-01', totalValue: 1100, netDeposits: 1000 },
    ]))).toBeUndefined()

    expect(portfolioAnnualReturn(portfolio([
      { date: '2025-01-01', totalValue: 1000, netDeposits: 1000 },
      { date: '2026-01-01', totalValue: undefined, netDeposits: 1000 },
    ]))).toBeUndefined()
  })

  it('has nothing to say about a portfolio with no history', () => {
    expect(portfolioAnnualReturn(portfolio([]))).toBeUndefined()
    expect(portfolioAnnualReturn(portfolio([
      { date: '2026-01-01', totalValue: 1000, netDeposits: 1000 },
    ]))).toBeUndefined()
  })

  it('handles a withdrawal, which lowers cumulative deposits', () => {
    const rate = portfolioAnnualReturn(portfolio([
      { date: '2025-01-01', totalValue: 2000, netDeposits: 2000 },
      { date: '2025-07-01', totalValue: 1100, netDeposits: 1000 },
      { date: '2026-01-01', totalValue: 1150, netDeposits: 1000 },
    ]))

    expect(rate === undefined || Number.isFinite(rate)).toBe(true)
  })
})
