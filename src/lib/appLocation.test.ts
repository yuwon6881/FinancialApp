import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  APP_CONTEXT_WILL_CHANGE_EVENT,
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
      searchMode: 'contains',
        startDate: '2026-07-01',
        endDate: '2026-07-31',
        minAmount: '5',
        maxAmount: '50',
        recurringFilter: 'only',
        wishlistFilter: 'only',
        txType: 'outflow',
        showAllCycles: true,
        range: '3month',
        highlightedTxId: 'tx-1',
      },
      destination: {
        recurringPaymentId: null,
        loanId: null,
        reportSection: null,
        reportCategory: null,
        accountId: null,
        commitmentId: null,
        rewardId: null,
        draftId: null,
      },
    })
  })

  it('drops malformed ledger dates and negative or non-numeric amounts', () => {
    window.history.replaceState({}, '', '/ledger?from=2026-02-30&to=not-a-date&min=-1&max=lots')

    const location = readAppLocation()

    expect(location.ledger.startDate).toBe('')
    expect(location.ledger.endDate).toBe('')
    expect(location.ledger.minAmount).toBe('')
    expect(location.ledger.maxAmount).toBe('')
  })

  it('persists exact Ledger matching and migrates the former whole-word URL', () => {
    window.history.replaceState({}, '', '/ledger?match=exact')
    expect(readAppLocation().ledger.searchMode).toBe('exact')
    expect(ledgerRouteSearch({ searchMode: 'exact' }).match).toBe('exact')

    window.history.replaceState({}, '', '/ledger?match=whole-word')
    expect(readAppLocation().ledger.searchMode).toBe('exact')
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

  it('uses the canonical commitments and rewards route', () => {
    navigateToAppTab('wishlist')
    expect(window.location.pathname).toBe('/commitments-rewards')
    expect(window.location.search).toBe('?month=Jul&year=2026')
  })

  it('parses destination ids and removes stale ids when leaving their page', () => {
    window.history.replaceState({}, '', '/commitments-rewards?reward=7&commitment=9&month=Jul&year=2026')
    expect(readAppLocation().destination).toEqual(expect.objectContaining({ rewardId: '7', commitmentId: '9' }))

    navigateToAppTab('settings', { search: { account: 'acc-1' } })
    const params = new URLSearchParams(window.location.search)
    expect(params.get('account')).toBe('acc-1')
    expect(params.has('reward')).toBe(false)
    expect(params.has('commitment')).toBe(false)

    navigateToAppTab('drafts', { search: { draft: 'draft-1' } })
    expect(new URLSearchParams(window.location.search).get('draft')).toBe('draft-1')
    navigateToAppTab('reports')
    expect(new URLSearchParams(window.location.search).has('draft')).toBe(false)
  })

  it('recognizes the legacy wishlist route and query view', () => {
    window.history.replaceState({}, '', '/wishlist?month=Jul&year=2026')
    expect(readAppLocation().tab).toBe('wishlist')

    window.history.replaceState({}, '', '/?view=wishlist&month=Jul&year=2026')
    expect(readAppLocation().tab).toBe('wishlist')
  })

  it('updates live search state without changing the route', () => {
    const contextListener = vi.fn()
    window.addEventListener(APP_CONTEXT_WILL_CHANGE_EVENT, contextListener)
    updateAppSearch({ q: 'rent', recurring: true })
    expect(window.location.pathname).toBe('/dashboard')
    expect(new URLSearchParams(window.location.search).get('q')).toBe('rent')
    expect(new URLSearchParams(window.location.search).get('recurring')).toBe('1')
    expect(contextListener).not.toHaveBeenCalled()
    window.removeEventListener(APP_CONTEXT_WILL_CHANGE_EVENT, contextListener)
  })

  it('closes and consumes an open modal entry before changing app context', () => {
    const contextListener = vi.fn()
    window.addEventListener(APP_CONTEXT_WILL_CHANGE_EVENT, contextListener)
    window.history.pushState({ modalId: 'modal-1' }, '')

    navigateToAppTab('reports')

    expect(contextListener).toHaveBeenCalledTimes(1)
    expect(window.location.pathname).toBe('/reports')
    expect(window.history.state).toEqual({})
    window.removeEventListener(APP_CONTEXT_WILL_CHANGE_EVENT, contextListener)
  })

  it('treats a cycle change as app context navigation', () => {
    const contextListener = vi.fn()
    window.addEventListener(APP_CONTEXT_WILL_CHANGE_EVENT, contextListener)

    updateAppSearch({ month: 'Aug' })

    expect(contextListener).toHaveBeenCalledTimes(1)
    window.removeEventListener(APP_CONTEXT_WILL_CHANGE_EVENT, contextListener)
  })

  it('preserves exclusion modes in the ledger URL', () => {
    window.history.replaceState({}, '', '/ledger?recurring=exclude&wishlist=only')

    expect(readAppLocation().ledger.recurringFilter).toBe('exclude')
    expect(readAppLocation().ledger.wishlistFilter).toBe('only')
    expect(ledgerRouteSearch({ recurringFilter: 'exclude', wishlistFilter: 'only' })).toEqual({
      filters: null,
      q: null,
      match: null,
      from: null,
      to: null,
      min: null,
      max: null,
      recurring: 'exclude',
      wishlist: 'only',
      type: null,
      all: null,
      range: null,
      tx: null,
    })
  })
})
