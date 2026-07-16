import { describe, it, expect } from 'vitest'
import { addWishlistItem, fetchWishlist, purchaseWishlistItem, unpurchaseWishlistItem } from '@/lib/api/wishlist'
import { fetchTransactionById } from '@/lib/api/transactions'

describe('wishlist integration (purchase → transaction linkage)', () => {
  it('creates a wishlist item', async () => {
    const item = await addWishlistItem({ name: 'Laptop', price: 1500, priority: 'High' })
    expect(item.id).toBeGreaterThan(0)
    expect(item.price).toBe(1500)

    const list = await fetchWishlist()
    expect(list.some(w => w.id === item.id)).toBe(true)
  })

  it('purchasing an item creates a linked transaction (bidirectional link)', async () => {
    const item = await addWishlistItem({ name: 'Headphones', price: 200 })

    const { item: purchased, transaction } = await purchaseWishlistItem(item.id)

    expect(purchased.isPurchased).toBe(true)
    // The created transaction is a negative "reward" spend for the item's price.
    expect(transaction.amount).toBe(-200)
    expect(transaction.wishlistItemId).toBe(item.id)
    // And the link is bidirectional.
    expect(purchased.purchaseTransactionId).toBe(transaction.id)

    // The linked transaction is independently retrievable.
    const fetched = await fetchTransactionById(transaction.id)
    expect(fetched.wishlistItemId).toBe(item.id)
  })

  it('returns the original transaction when a purchase is retried', async () => {
    const item = await addWishlistItem({ name: 'Monitor', price: 300 })
    const first = await purchaseWishlistItem(item.id)
    const retry = await purchaseWishlistItem(item.id)

    expect(retry.item.purchaseTransactionId).toBe(first.transaction.id)
    expect(retry.transaction.id).toBe(first.transaction.id)
  })

  it('unpurchasing clears the purchased flag', async () => {
    const item = await addWishlistItem({ name: 'Keyboard', price: 120 })
    await purchaseWishlistItem(item.id)

    const reverted = await unpurchaseWishlistItem(item.id)
    expect(reverted.isPurchased).toBe(false)
  })
})
