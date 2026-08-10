import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FundPriceChart } from './FundPriceChart'

const history = {
  instrumentId: 'fund-1',
  symbol: 'FUND',
  name: 'Example Fund',
  currency: 'USD',
  points: [
    { date: '2026-01-01', price: 100 },
    { date: '2026-02-01', price: 125 },
  ],
  averageCostNative: 110,
  units: 2,
}

describe('FundPriceChart', () => {
  it('uses only a generic screen-reader summary while masked', () => {
    const { container } = render(<FundPriceChart history={history} masked />)

    expect(screen.getByText('Fund price history values are hidden.')).toBeTruthy()
    expect(container.textContent).not.toContain('25.0%')
    expect(container.textContent).not.toContain('$100.00')
    expect(container.textContent).not.toContain('$125.00')
    expect(screen.getAllByText('Hidden', { selector: 'td' })).toHaveLength(2)
    expect(container.querySelector('svg')?.getAttribute('aria-label')).toBe('Fund price history values hidden')
  })
})
