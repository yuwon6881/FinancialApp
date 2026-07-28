import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchPagedTransactions } from './transactions'

describe('fetchPagedTransactions', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('sends the wishlist-only filter for all-cycle paging', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ items: [], total: 0, page: 1, pageSize: 10 }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await fetchPagedTransactions({ page: 1, pageSize: 10, wishlistOnly: true, sort: 'amount-desc' })

    const url = new URL(String(fetchMock.mock.calls[0][0]))
    expect(url.searchParams.get('wishlistOnly')).toBe('true')
    expect(url.searchParams.get('sort')).toBe('amount-desc')
    expect(url.searchParams.get('all')).toBe('true')
  })
})
