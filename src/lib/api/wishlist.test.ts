import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchClaimedWishlistPage } from './wishlist'

const okResponse = (payload: unknown) => ({
  ok: true,
  status: 200,
  headers: { get: () => null },
  json: async () => payload,
})

describe('fetchClaimedWishlistPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('requests the claimed page with paging params and maps the result', async () => {
    const payload = {
      items: [
        { id: 2, name: 'Newer', price: 20, priority: 'Low', isPurchased: true, purchasedAt: '2026-01-02', purchaseTransactionId: 'tx-2', createdAt: '2026-01-02', isActive: false },
        { id: 1, name: 'Older', price: 10, priority: 'Low', isPurchased: true, purchasedAt: '2026-01-01', purchaseTransactionId: 'tx-1', createdAt: '2026-01-01', isActive: false },
      ],
      total: 7,
      page: 1,
      pageSize: 5,
    }
    const fetchMock = vi.fn().mockResolvedValue(okResponse(payload))
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchClaimedWishlistPage(1, 5)

    const calledUrl = String(fetchMock.mock.calls[0][0])
    expect(calledUrl).toContain('/wishlist/claimed')
    expect(calledUrl).toContain('page=1')
    expect(calledUrl).toContain('pageSize=5')
    expect(result.total).toBe(7)
    expect(result.items).toHaveLength(2)
    // Deobfuscated price + newest-first order preserved from the server.
    expect(result.items[0]).toMatchObject({ id: 2, name: 'Newer', price: 20 })
  })

  it('defaults missing fields on a sparse response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse({}))
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchClaimedWishlistPage(3, 5)

    expect(result.items).toEqual([])
    expect(result.total).toBe(0)
    expect(result.page).toBe(3)
    expect(result.pageSize).toBe(5)
  })
})
