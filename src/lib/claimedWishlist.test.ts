import { describe, expect, it } from 'vitest'
import { claimedWishlistChangeSignal, selectClaimedWishlistPage } from './claimedWishlist'

const item = (id: number, isPendingSync = false) => ({ id, isPendingSync })

describe('selectClaimedWishlistPage', () => {
  it('uses the matching server page when there are no optimistic claims', () => {
    const result = selectClaimedWishlistPage(
      [item(3), item(2), item(1)],
      { items: [item(2)], total: 3, page: 2, pageSize: 1 },
      2,
      1,
      false,
    )

    expect(result).toEqual({ items: [item(2)], total: 3, usesServer: true })
  })

  it('slices the complete cache while a claim is pending so no server row is skipped', () => {
    const cached = [item(6, true), item(5), item(4), item(3), item(2), item(1)]
    const staleServerPage = { items: [item(5), item(4), item(3), item(2), item(1)], total: 5, page: 1, pageSize: 5 }

    const first = selectClaimedWishlistPage(cached, staleServerPage, 1, 5, false)
    const second = selectClaimedWishlistPage(cached, null, 2, 5, false)

    expect(first.items.map(value => value.id)).toEqual([6, 5, 4, 3, 2])
    expect(second.items.map(value => value.id)).toEqual([1])
    expect(first.total).toBe(6)
    expect(first.usesServer).toBe(false)
  })

  it('does not display a stale server page while the requested page is loading', () => {
    const result = selectClaimedWishlistPage(
      [item(6), item(5), item(4), item(3), item(2), item(1)],
      { items: [item(6), item(5), item(4), item(3), item(2)], total: 6, page: 1, pageSize: 5 },
      2,
      5,
      false,
    )

    expect(result.items.map(value => value.id)).toEqual([1])
    expect(result.usesServer).toBe(false)
  })
})

describe('claimedWishlistChangeSignal', () => {
  it('changes when a queued claim finishes syncing', () => {
    expect(claimedWishlistChangeSignal([item(1, true)]))
      .not.toBe(claimedWishlistChangeSignal([item(1, false)]))
  })
})
