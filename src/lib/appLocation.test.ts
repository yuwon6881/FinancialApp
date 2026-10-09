import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  APP_CONTEXT_WILL_CHANGE_EVENT,
  canonicalizeAppLocation,
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
        reloadFilter: 'all',
        accountIds: [],
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
        section: null,
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
    expect(window.location.pathname).toBe('/activity')
    expect(window.location.search).toContain('filters=Rewards')
    expect(window.location.search).toContain('month=Jul')

    navigateToAppTab('reports')
    expect(window.location.pathname).toBe('/insights')
    expect(window.location.search).toBe('?month=Jul&year=2026')
  })

  it('preserves an Android launcher action until its authenticated handler consumes it', () => {
    window.history.replaceState({}, '', '/?pwaAction=scan-receipt&month=Jul&year=2026')
    navigateToAppTab('ledger')
    expect(window.location.pathname).toBe('/activity')
    expect(new URLSearchParams(window.location.search).get('pwaAction')).toBe('scan-receipt')

    navigateToAppTab('ledger', { search: { type: 'outflow' } })
    expect(new URLSearchParams(window.location.search).get('pwaAction')).toBe('scan-receipt')
  })

  it('uses the canonical Lumen destination paths', () => {
    const cases: Array<[Parameters<typeof navigateToAppTab>[0], string]> = [
      ['dashboard', '/today'],
      ['ledger', '/activity'],
      ['drafts', '/activity/review'],
      ['budget', '/plan/budget'],
      ['recurring', '/plan/bills'],
      ['wishlist', '/plan/goals'],
      ['accounts', '/wealth/accounts'],
      ['investments', '/wealth/investments'],
      ['documents', '/wealth/vault'],
      ['reports', '/insights'],
      ['settings', '/settings'],
    ]
    for (const [tab, path] of cases) {
      navigateToAppTab(tab)
      expect(window.location.pathname, tab).toBe(path)
      expect(window.location.search).toBe('?month=Jul&year=2026')
    }
  })

  it('gives Loans an address of its own and keeps a bill on Bills', () => {
    navigateToAppTab('recurring', { search: { section: 'loans' } })
    expect(window.location.pathname).toBe('/plan/loans')
    expect(new URLSearchParams(window.location.search).has('section')).toBe(false)
    expect(readAppLocation()).toEqual(expect.objectContaining({ tab: 'recurring' }))
    expect(readAppLocation().destination.section).toBe('loans')

    navigateToAppTab('recurring', { search: { loan: 'loan-1' } })
    expect(window.location.pathname).toBe('/plan/loans')

    navigateToAppTab('recurring', { search: { subscription: 'bill-1', loan: null } })
    expect(window.location.pathname).toBe('/plan/bills')
  })

  it.each([
    ['/dashboard', 'dashboard', '/today'],
    ['/ledger?tx=abc', 'ledger', '/activity'],
    ['/drafts?draft=d1', 'drafts', '/activity/review'],
    ['/recurring?subscription=s1', 'recurring', '/plan/bills'],
    ['/recurring?section=loans', 'recurring', '/plan/loans'],
    ['/commitments-rewards?reward=7', 'wishlist', '/plan/goals'],
    ['/wishlist', 'wishlist', '/plan/goals'],
    ['/investments', 'investments', '/wealth/investments'],
    ['/vault', 'documents', '/wealth/vault'],
    ['/reports?focus=category-limits', 'reports', '/insights'],
    ['/settings?section=accounts', 'accounts', '/wealth/accounts'],
    ['/settings?section=categories', 'budget', '/plan/budget'],
    ['/settings?section=model', 'budget', '/plan/budget'],
    ['/settings?section=rules', 'budget', '/plan/budget'],
    ['/', 'dashboard', '/today'],
  ] as const)('resolves the published address %s and settles on its canonical path', (address, tab, canonical) => {
    window.history.replaceState({}, '', address)
    expect(readAppLocation().tab).toBe(tab)
    canonicalizeAppLocation()
    expect(window.location.pathname).toBe(canonical)
  })

  it('leaves the automation-only specimen page where it is', () => {
    window.history.replaceState({}, '', '/ui-specimen')
    canonicalizeAppLocation()
    expect(window.location.pathname).toBe('/ui-specimen')
  })

  it('keeps the query a published address carried', () => {
    window.history.replaceState({}, '', '/recurring?subscription=s1&month=Jul&year=2026')
    canonicalizeAppLocation()
    const params = new URLSearchParams(window.location.search)
    expect(params.get('subscription')).toBe('s1')
    expect(params.get('month')).toBe('Jul')

    window.history.replaceState({}, '', '/settings?section=categories')
    canonicalizeAppLocation()
    expect(new URLSearchParams(window.location.search).get('section')).toBe('categories')
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
    expect(window.location.pathname).toBe('/insights')
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
      reload: null,
      accounts: null,
      type: null,
      all: null,
      range: null,
      tx: null,
    })
  })

  it('round-trips a multi-account ledger filter through the URL', () => {
    window.history.replaceState({}, '', '/ledger?accounts=acc-b,acc-a,acc-b,,acc-c')

    // Duplicates and blanks are dropped on read; a filter is a set, not a list.
    expect(readAppLocation().ledger.accountIds).toEqual(['acc-b', 'acc-a', 'acc-c'])

    // Written back sorted, so the same selection always produces the same URL and does not
    // churn browser history on re-render.
    expect(ledgerRouteSearch({ accountIds: ['acc-c', 'acc-a', 'acc-c'] }).accounts).toBe('acc-a,acc-c')
    expect(ledgerRouteSearch({ accountIds: [] }).accounts).toBeNull()
    expect(ledgerRouteSearch({}).accounts).toBeNull()
  })

  it('supports multi-select transaction types in ledger URL state', () => {
    window.history.replaceState({}, '', '/ledger?type=inflow,outflow')
    expect(readAppLocation().ledger.txType).toBe('inflow,outflow')

    window.history.replaceState({}, '', '/ledger?type=inflow,outflow,transfer')
    expect(readAppLocation().ledger.txType).toBeNull()

    expect(ledgerRouteSearch({ txType: ['inflow', 'transfer'] })).toEqual(expect.objectContaining({
      type: 'inflow,transfer',
    }))
    expect(ledgerRouteSearch({ txType: ['inflow', 'outflow', 'transfer'] })).toEqual(expect.objectContaining({
      type: null,
    }))
  })

  it('supports stability reload put-back filter in ledger URL state', () => {
    for (const filter of ['put-back', 'needs-put-back', 'outstanding', 'partly-repaid', 'complete', 'not-required'] as const) {
      window.history.replaceState({}, '', `/ledger?reload=${filter}`)
      expect(readAppLocation().ledger.reloadFilter).toBe(filter)
      expect(ledgerRouteSearch({ reloadFilter: filter })).toEqual(expect.objectContaining({
        reload: filter,
      }))
    }

    expect(ledgerRouteSearch({ reloadFilter: 'all' })).toEqual(expect.objectContaining({
      reload: null,
    }))
  })
})
