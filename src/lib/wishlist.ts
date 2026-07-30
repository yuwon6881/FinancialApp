// Shared wishlist selectors. The "active" (hero) item selection was duplicated
// verbatim between DashboardView and WishlistView.

import type { WishlistItem } from '../types'
import { priorityRank } from './savingsGoals'

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

/**
 * Reading order for the rewards row: the focused item first, then by priority, then oldest first.
 *
 * Leftmost is the position the eye lands on, so it belongs to whatever the user is actually saving
 * toward. Everything after it is ranked the same way commitments are, which is why the row needs no
 * separate "up next" list — one ordered strip says it all.
 */
export function orderRewardsForRail(
  wishlist: WishlistItem[],
  focused: WishlistItem | undefined,
): WishlistItem[] {
  return wishlist
    .filter(item => !item.isPurchased)
    .sort((left, right) => {
      if (focused) {
        if (left.id === focused.id) return -1
        if (right.id === focused.id) return 1
      }
      const byPriority = priorityRank(left.priority) - priorityRank(right.priority)
      if (byPriority !== 0) return byPriority
      const byCreated = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
      if (byCreated !== 0) return byCreated
      return left.id - right.id
    })
}
