import type { Transaction } from '../types'

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

// Legacy/corrupted cache entries (e.g. from a pre-schema-change app version) can
// have transactions missing required string fields, which crashes any render
// path that calls .toLowerCase()/.startsWith() on them without a guard. Drop
// those entries instead of letting them poison every future render.
function isWellFormedTransaction(t: unknown): t is Transaction {
  if (!t || typeof t !== 'object') return false
  const tx = t as Record<string, unknown>
  return (
    typeof tx.id === 'string' &&
    typeof tx.date === 'string' &&
    typeof tx.description === 'string' &&
    typeof tx.category === 'string' &&
    typeof tx.ledgerCategory === 'string' &&
    typeof tx.amount === 'number'
  )
}

export function sanitizeTransactions(value: unknown): Transaction[] {
  if (!Array.isArray(value)) return []
  return value.filter(isWellFormedTransaction)
}

export function getCachedTransactions(key: string): Transaction[] {
  return sanitizeTransactions(getCachedJSON<unknown>(key, []))
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
