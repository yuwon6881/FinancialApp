import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { InvestmentHistory } from '../../types'
import * as api from '../../lib/api'
import { InvestmentHistoryPanel } from './InvestmentHistoryPanel'

const history: InvestmentHistory = {
  currency: 'USD',
  lifetime: {
    firstMonth: '2030-01-31',
    asOf: '2031-10-31',
    netContributions: 12000,
    value: 13500,
    growth: 1500,
    cumulativeReturnPercent: 13.2,
    annualisedReturnPercent: 6.4,
    isComplete: false,
    segments: [
      { segment: 'USEquity', netContributions: 8000, closingValue: 9200, growth: 1200, returnPercent: 15, isComplete: true },
      { segment: 'Unassigned', netContributions: 4000, closingValue: 4300, growth: 300, returnPercent: 7.5, isComplete: true },
    ],
  },
  years: [
    {
      year: 2031, periodEnd: '2031-10-31', isFullYear: false,
      openingValue: 6200, netContributions: 6000, isComplete: false,
      missingReasons: ['No price for VWRA on 2031-10-31.'], segments: [],
    },
    {
      year: 2030, periodEnd: '2030-12-31', isFullYear: true,
      openingValue: 0, closingValue: 6200, netContributions: 6000, growth: 200, returnPercent: 3.1,
      isComplete: true, missingReasons: [], segments: [],
    },
  ],
  months: [],
}

describe('InvestmentHistoryPanel', () => {
  afterEach(() => vi.restoreAllMocks())

  it('shows each year, the lifetime and markets, keeping unknown figures unknown', async () => {
    vi.spyOn(api, 'readCachedInvestmentHistory').mockReturnValue(null)
    vi.spyOn(api, 'fetchInvestmentHistory').mockResolvedValue(history)

    render(<InvestmentHistoryPanel instruments={[]} masked={false} refreshToken={0} />)

    expect(await screen.findByText('Jan–Oct 2031')).toBeTruthy()
    expect(screen.getByText('Settled months up to the end of Oct 2031; Portfolio shows today’s prices. Money you add is not counted as growth.')).toBeTruthy()
    expect(screen.getByText('Yearly return')).toBeTruthy()
    expect(screen.getByText('+6.4%')).toBeTruthy()
    expect(screen.getByText('$12,000.00')).toBeTruthy()
    expect(screen.getByLabelText(/^Jan–Oct 2031: added \$6,000\.00, growth Unknown, return Unknown$/)).toBeTruthy()
    expect(screen.getByLabelText(/^2030: added \$6,000\.00, growth \+\$200\.00, return \+3\.1%$/)).toBeTruthy()
    expect(screen.getByText('No price for VWRA on 2031-10-31.')).toBeTruthy()
    expect(screen.getByText('US shares')).toBeTruthy()
    expect(screen.getByText('Not sorted yet')).toBeTruthy()
    expect(screen.getByText(/Some months are missing a price or exchange rate/)).toBeTruthy()
  })

  it('hides every figure, including accessible names, while masked', async () => {
    vi.spyOn(api, 'readCachedInvestmentHistory').mockReturnValue(null)
    vi.spyOn(api, 'fetchInvestmentHistory').mockResolvedValue(history)

    const { container } = render(<InvestmentHistoryPanel instruments={[]} masked refreshToken={0} />)

    await screen.findByText('2030')
    expect(container.textContent).not.toMatch(/\$|%/)
    expect(screen.getByLabelText('2030: added ••, growth ••, return ••')).toBeTruthy()
  })

  it('folds years beyond the latest five so a long history stays short', async () => {
    const years = Array.from({ length: 15 }, (_, index) => ({
      ...history.years[1], year: 2040 - index, periodEnd: `${2040 - index}-12-31`,
    }))
    vi.spyOn(api, 'readCachedInvestmentHistory').mockReturnValue(null)
    vi.spyOn(api, 'fetchInvestmentHistory').mockResolvedValue({ ...history, years, lifetime: { ...history.lifetime, firstMonth: '2026-01-31' } })

    render(<InvestmentHistoryPanel instruments={[]} masked={false} refreshToken={0} />)

    expect(await screen.findByText('2040')).toBeTruthy()
    expect(screen.getByText('2036')).toBeTruthy()
    expect(screen.queryByText('2035')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Show 10 earlier years/ }))
    expect(screen.getByText('2026')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Show recent years only/ }).getAttribute('aria-expanded')).toBe('true')
  })

  it('explains an empty history instead of showing zeroes', async () => {
    vi.spyOn(api, 'readCachedInvestmentHistory').mockReturnValue(null)
    vi.spyOn(api, 'fetchInvestmentHistory').mockResolvedValue({
      currency: 'USD', lifetime: { isComplete: true, segments: [] }, years: [], months: [],
    })

    render(<InvestmentHistoryPanel instruments={[]} masked={false} refreshToken={0} />)

    await waitFor(() => expect(screen.getByText(/Your first year starts here/)).toBeTruthy())
    expect(screen.queryByText('Put in')).toBeNull()
  })
})
