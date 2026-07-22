import { beforeEach, describe, expect, it } from 'vitest'
import {
  ledgerRouteSearch,
  navigateToAppTab,
  readAppLocation,
  updateAppSearch,
} from './appLocation'

describe('app URL state', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/dashboard?month=Jul&year=2026')
  })

  it('parses a deep-linked ledger state', () => {
    window.history.replaceState({}, '', '/ledger?month=Jul&year=2026&filters=Essentials%2CFood&q=coffee&from=2026-07-01&to=2026-07-31&min=5&max=50&recurring=1&wishlist=1&type=outflow&all=1&range=3month&tx=tx-1')

    expect(readAppLocation()).toEqual({
      tab: 'ledger',
      month: 'Jul',
      year: 2026,
      ledger: {
        filters: ['Essentials', 'Food'],
        search: 'coffee',
        startDate: '2026-07-01',
        endDate: '2026-07-31',
        minAmount: '5',
        maxAmount: '50',
        recurringOnly: true,
        wishlistOnly: true,
        txType: 'outflow',
        showAllCycles: true,
        range: '3month',
        highlightedTxId: 'tx-1',
      },
    })
  })

  it('creates clean cross-view URLs while preserving the active cycle', () => {
    navigateToAppTab('ledger', {
      search: ledgerRouteSearch({ filters: ['Rewards'], txType: 'inflow', showAllCycles: true }),
    })
    expect(window.location.pathname).toBe('/ledger')
    expect(window.location.search).toContain('filters=Rewards')
    expect(window.location.search).toContain('month=Jul')

    navigateToAppTab('reports')
    expect(window.location.pathname).toBe('/reports')
    expect(window.location.search).toBe('?month=Jul&year=2026')
  })

  it('updates live search state without changing the route', () => {
    updateAppSearch({ q: 'rent', recurring: true })
    expect(window.location.pathname).toBe('/dashboard')
    expect(new URLSearchParams(window.location.search).get('q')).toBe('rent')
    expect(new URLSearchParams(window.location.search).get('recurring')).toBe('1')
  })
})
