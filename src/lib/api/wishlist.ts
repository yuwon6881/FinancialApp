import type { Transaction, WishlistItem } from '../../types'
import type { WireWishlistItem, WireWishlistPurchaseResult, WirePagedWishlistResult } from '../apiTypes'
import { deobfuscateTransaction, deobfuscateWishlistItem, obfuscateAmount } from './amounts'
import { cachedGet, invalidateCache, jsonBody, request, requestVoid } from './client'

export function fetchWishlist(signal?: AbortSignal): Promise<WishlistItem[]> {
  return cachedGet('wishlist', async () => {
    const data = await request<WireWishlistItem[] | null>('/wishlist', {
      errorMessage: 'Failed to fetch wishlist',
    })
    return (data || []).map(deobfuscateWishlistItem)
  }, { signal, staleTime: 120_000 })
}

export interface PagedWishlistResult {
  items: WishlistItem[]
  total: number
  page: number
  pageSize: number
}

// Server-paged "Rewards Claimed" history (purchased items only, newest first).
export async function fetchClaimedWishlistPage(
  page: number,
  pageSize: number,
  signal?: AbortSignal,
): Promise<PagedWishlistResult> {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  const data = await request<WirePagedWishlistResult>(`/wishlist/claimed?${query}`, {
    signal,
    errorMessage: 'Failed to fetch claimed rewards',
  })
  return {
    items: (data.items || []).map(deobfuscateWishlistItem),
    total: data.total ?? 0,
    page: data.page ?? page,
    pageSize: data.pageSize ?? pageSize,
  }
}

export async function addWishlistItem(item: Partial<WishlistItem>, clientKey?: string): Promise<WishlistItem> {
  const data = await request<WireWishlistItem>('/wishlist', {
    method: 'POST',
    // clientKey is the stable outbox op id: sending it lets the server dedupe a lost-response
    // retry to the already-created row instead of inserting a duplicate wishlist item.
    ...jsonBody({ ...item, price: obfuscateAmount(item.price ?? 0), ...(clientKey ? { clientKey } : {}) }),
    errorMessage: 'Failed to create wishlist item',
  })
  invalidateCache()
  return deobfuscateWishlistItem(data)
}

export async function updateWishlistItem(id: number, item: WishlistItem): Promise<void> {
  await requestVoid(`/wishlist/${id}`, {
    method: 'PUT',
    ...jsonBody({ ...item, price: obfuscateAmount(item.price) }),
    errorMessage: 'Failed to update wishlist item',
  })
  invalidateCache()
}

export async function deleteWishlistItem(id: number): Promise<void> {
  await requestVoid(`/wishlist/${id}`, {
    method: 'DELETE',
    errorMessage: 'Failed to delete wishlist item',
  })
  invalidateCache()
}

export async function purchaseWishlistItem(id: number, date?: string): Promise<{ item: WishlistItem; transaction: Transaction }> {
  const data = await request<WireWishlistPurchaseResult>(`/wishlist/${id}/purchase`, {
    method: 'POST',
    ...(date ? jsonBody({ date }) : {}),
    errorMessage: 'Failed to purchase wishlist item',
  })
  invalidateCache()
  return {
    item: deobfuscateWishlistItem(data.item),
    transaction: deobfuscateTransaction(data.transaction),
  }
}

export async function unpurchaseWishlistItem(id: number): Promise<WishlistItem> {
  const data = await request<WireWishlistItem>(`/wishlist/${id}/purchase`, {
    method: 'DELETE',
    errorMessage: 'Failed to undo wishlist purchase',
  })
  invalidateCache()
  return deobfuscateWishlistItem(data)
}
