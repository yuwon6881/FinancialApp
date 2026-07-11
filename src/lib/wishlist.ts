// Shared wishlist selectors. The "active" (hero) item selection was duplicated
// verbatim between DashboardView and WishlistView.

import type { WishlistItem } from '../types'

/**
 * The wishlist item to feature as the current goal: the explicitly-active,
 * not-yet-purchased item if one exists, otherwise the most recently created
 * unpurchased item. Returns `undefined` when there are no unpurchased items.
 */
export function getActiveWishlistItem(wishlist: WishlistItem[]): WishlistItem | undefined {
  return (
    wishlist.find(w => w.isActive && !w.isPurchased) ||
    wishlist
      .filter(w => !w.isPurchased)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
  )
}
