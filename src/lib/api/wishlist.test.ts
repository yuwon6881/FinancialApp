import { afterEach, describe, expect, it, vi } from 'vitest'
import { purchaseWishlistItem } from './wishlist'

describe('wishlist API contract', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('uses the compatibility wishlist purchase route and preserves claim metadata', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({
        item: { id: 7, name: 'Reward', price: 25, isPurchased: true },
        transaction: { id: 'tx-7', amount: -25, ledgerCategory: 'Rewards' },
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await purchaseWishlistItem(7, '2026-08-15', 'tx-7', '2026-08-15T04:00:00.000Z', 'acct-rewards')

    expect(String(fetchMock.mock.calls[0][0])).toContain('/wishlist/7/purchase')
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({
      date: '2026-08-15',
      transactionId: 'tx-7',
      postedAt: '2026-08-15T04:00:00.000Z',
      accountId: 'acct-rewards',
    })
  })
})
