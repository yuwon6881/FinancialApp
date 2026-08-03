import { describe, expect, it } from 'vitest'
import { getActiveWishlistItem, orderRewardsForRail } from './wishlist'
import type { WishlistItem } from '../types'

function item(partial: Partial<WishlistItem>): WishlistItem {
  return {
    id: 0,
    name: 'x',
    price: 0,
    isActive: false,
    isPurchased: false,
    createdAt: '2026-01-01T00:00:00Z',
    ...partial,
  } as WishlistItem
}

describe('getActiveWishlistItem', () => {
  it('returns undefined when there are no unpurchased items', () => {
    expect(getActiveWishlistItem([])).toBeUndefined()
    expect(getActiveWishlistItem([item({ isPurchased: true })])).toBeUndefined()
  })

  it('prefers the explicitly active, unpurchased item', () => {
    const active = item({ id: 1, isActive: true })
    const other = item({ id: 2, createdAt: '2026-06-01T00:00:00Z' })
    expect(getActiveWishlistItem([other, active])!.id).toBe(1)
  })

  it('ignores an active flag on a purchased item', () => {
    const purchasedActive = item({ id: 1, isActive: true, isPurchased: true })
    const fresh = item({ id: 2, createdAt: '2026-06-01T00:00:00Z' })
    expect(getActiveWishlistItem([purchasedActive, fresh])!.id).toBe(2)
  })

  it('falls back to the most recently created unpurchased item', () => {
    const older = item({ id: 1, createdAt: '2026-01-01T00:00:00Z' })
    const newer = item({ id: 2, createdAt: '2026-05-01T00:00:00Z' })
    expect(getActiveWishlistItem([older, newer])!.id).toBe(2)
  })
})

describe('orderRewardsForRail', () => {
  it('pins the focused item leftmost regardless of priority or age', () => {
    const focused = item({ id: 3, priority: 'Low', createdAt: '2026-06-01T00:00:00Z', isActive: true })
    const items = [
      item({ id: 1, priority: 'High', createdAt: '2026-02-01T00:00:00Z' }),
      item({ id: 2, priority: 'Medium', createdAt: '2026-01-05T00:00:00Z' }),
      focused,
    ]

    expect(orderRewardsForRail(items, focused).map(entry => entry.id)).toEqual([3, 1, 2])
  })

  it('ranks the rest by priority, then oldest first', () => {
    const items = [
      item({ id: 1, priority: 'Low', createdAt: '2026-01-01T00:00:00Z' }),
      item({ id: 2, priority: 'High', createdAt: '2026-05-01T00:00:00Z' }),
      item({ id: 3, priority: 'Medium', createdAt: '2026-04-01T00:00:00Z' }),
      item({ id: 4, priority: 'Medium', createdAt: '2026-02-01T00:00:00Z' }),
    ]

    // High first; inside the Medium band the earlier creation date sits further left.
    expect(orderRewardsForRail(items, undefined).map(entry => entry.id)).toEqual([2, 4, 3, 1])
  })

  it('puts a positive local id after persisted ids when every domain field ties', () => {
    const createdAt = '2026-02-01T00:00:00Z'
    const items = [
      item({ id: 1_785_000_000_000_123, priority: 'Medium', createdAt }),
      item({ id: 42, priority: 'Medium', createdAt }),
    ]

    expect(orderRewardsForRail(items, undefined).map(entry => entry.id)).toEqual([
      42,
      1_785_000_000_000_123,
    ])
  })

  it('excludes claimed items and leaves the input array untouched', () => {
    const items = [
      item({ id: 1, isPurchased: true }),
      item({ id: 2, priority: 'Low' }),
      item({ id: 3, priority: 'High' }),
    ]

    expect(orderRewardsForRail(items, undefined).map(entry => entry.id)).toEqual([3, 2])
    expect(items.map(entry => entry.id)).toEqual([1, 2, 3])
  })

  it('drops a focused item that has since been claimed', () => {
    const claimed = item({ id: 1, isPurchased: true, isActive: true })
    const items = [claimed, item({ id: 2, priority: 'Medium' })]

    expect(orderRewardsForRail(items, claimed).map(entry => entry.id)).toEqual([2])
  })

  it('returns an empty row when everything is claimed', () => {
    expect(orderRewardsForRail([item({ id: 1, isPurchased: true })], undefined)).toEqual([])
  })
})
