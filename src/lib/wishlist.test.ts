import { describe, expect, it } from 'vitest'
import { getActiveWishlistItem } from './wishlist'
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
