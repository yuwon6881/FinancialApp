export const CACHE_KEYS = {
  dashboardData: 'cached_dashboard_data',
  transactions: 'cached_transactions',
  recurringPayments: 'cached_recurring_payments',
  categories: 'cached_categories',
  wishlist: 'cached_wishlist',
  pendingTransactions: 'pending_transactions',
} as const

export function getCachedJSON<T>(key: string, fallback: T): T {
  try {
    const cached = localStorage.getItem(key)
    return cached ? JSON.parse(cached) : fallback
  } catch {
    return fallback
  }
}

export function setCachedJSON(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value))
}

export function hasCachedKey(key: string): boolean {
  return localStorage.getItem(key) !== null
}

// The dashboard cache is the source of truth for which month/year was last active,
// so several call sites need to peek at just that nested field.
export function getCachedDashboardPeriod(): { month?: string; year?: number } {
  const cached = getCachedJSON<{ setting?: { selectedMonth?: string; selectedYear?: number } } | null>(
    CACHE_KEYS.dashboardData,
    null
  )
  return {
    month: cached?.setting?.selectedMonth || undefined,
    year: cached?.setting?.selectedYear || undefined
  }
}
