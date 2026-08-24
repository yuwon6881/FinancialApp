import { afterEach, describe, expect, it, vi } from 'vitest'
import { exportTransactionsCsv, fetchPagedTransactions } from './transactions'

describe('fetchPagedTransactions', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('sends the wishlist-only relationship filter for all-cycle paging', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ items: [], total: 0, page: 1, pageSize: 10 }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await fetchPagedTransactions({ page: 1, pageSize: 10, wishlistFilter: 'only', sort: 'amount-desc' })

    const url = new URL(String(fetchMock.mock.calls[0][0]))
    expect(url.searchParams.get('wishlistFilter')).toBe('only')
    expect(url.searchParams.get('sort')).toBe('amount-desc')
    expect(url.searchParams.get('all')).toBe('true')
  })

  it('sends exclusion modes without adding a second filter parameter', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ items: [], total: 0, page: 1, pageSize: 10 }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await fetchPagedTransactions({
      page: 1,
      pageSize: 10,
      recurringFilter: 'exclude',
      wishlistFilter: 'only',
    })

    const url = new URL(String(fetchMock.mock.calls[0][0]))
    expect(url.searchParams.get('recurringFilter')).toBe('exclude')
    expect(url.searchParams.get('wishlistFilter')).toBe('only')
  })

  it('sends exact matching for server-backed Ledger searches', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ items: [], total: 0, page: 1, pageSize: 10 }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await fetchPagedTransactions({ page: 1, pageSize: 10, search: 'Badminton', searchMode: 'exact' })

    const url = new URL(String(fetchMock.mock.calls[0][0]))
    expect(url.searchParams.get('search')).toBe('Badminton')
    expect(url.searchParams.get('searchMode')).toBe('exact')
  })

  it('preserves the active sort and trims search for a full export', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'attachment; filename="ledger.csv"' },
      blob: async () => new Blob(['ledger']),
    })
    vi.stubGlobal('fetch', fetchMock)

    await exportTransactionsCsv({ search: '  coffee  ', sort: 'amount-asc' })

    const url = new URL(String(fetchMock.mock.calls[0][0]))
    expect(url.searchParams.get('search')).toBe('coffee')
    expect(url.searchParams.get('sort')).toBe('amount-asc')
  })
})
