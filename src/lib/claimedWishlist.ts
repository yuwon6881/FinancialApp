export interface ClaimedWishlistPage<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

interface ClaimItem {
  id: string | number
  isPendingSync?: boolean
}

export function selectClaimedWishlistPage<T extends ClaimItem>(
  cachedItems: T[],
  serverPage: ClaimedWishlistPage<T> | null,
  requestedPage: number,
  pageSize: number,
  serverFailed: boolean,
): { items: T[]; total: number; usesServer: boolean } {
  // While an optimistic claim is queued, the cache is the only complete view of
  // the combined list. Mixing it into a server page would displace the last server
  // row and make that row unreachable on subsequent pages.
  const hasPendingClaim = cachedItems.some(item => item.isPendingSync)
  const serverMatchesRequest = serverPage?.page === requestedPage && serverPage.pageSize === pageSize
  const usesServer = !serverFailed && !hasPendingClaim && serverMatchesRequest

  if (usesServer && serverPage) {
    return { items: serverPage.items, total: serverPage.total, usesServer: true }
  }

  const start = (requestedPage - 1) * pageSize
  return {
    items: cachedItems.slice(start, start + pageSize),
    total: cachedItems.length,
    usesServer: false,
  }
}

export function claimedWishlistChangeSignal(items: ClaimItem[]): string {
  return items.map(item => `${item.id}:${item.isPendingSync ? 1 : 0}`).join('|')
}
