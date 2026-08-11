import type { Transaction, DashboardData, WishlistItem } from '../types'
import { sanitizeQueuedOps, type QueuedOp } from './outbox'

type LegacyPendingTransaction = Transaction & { serverTxId?: string }

export const CACHE_KEYS = {
  dashboardData: 'cached_dashboard_data',
  transactions: 'cached_transactions',
  recurringPayments: 'cached_recurring_payments',
  categories: 'cached_categories',
  wishlist: 'cached_wishlist',
  savingsGoals: 'cached_savings_goals',
  pendingTransactions: 'pending_transactions',
  pendingOperations: 'pending_operations',
  walletBalance: 'cached_wallet_balance',
  investmentPortfolio: 'cached_investment_portfolio',
} as const

// Local amount masking only discourages casual inspection. It is deliberately
// not described as encryption: code running in this origin can reverse it.
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const CACHE_TIMESTAMP_SUFFIX = ':cached_at'
const CYCLE_SNAPSHOTS_KEY = 'cached_cycle_snapshots'
const DISPOSABLE_CACHE_KEYS = new Set<string>([
  CACHE_KEYS.dashboardData,
  CACHE_KEYS.transactions,
  CACHE_KEYS.recurringPayments,
  CACHE_KEYS.categories,
  CACHE_KEYS.wishlist,
  CACHE_KEYS.savingsGoals,
  CACHE_KEYS.walletBalance,
  CACHE_KEYS.investmentPortfolio,
  CYCLE_SNAPSHOTS_KEY,
])
const EXPIRING_CACHE_KEYS = DISPOSABLE_CACHE_KEYS
const LEGACY_VAULT_DOCUMENT_TYPES_CACHE_KEYS = [
  'cached_vault_document_types',
  'documents:types',
] as const

function removeCachedKey(key: string): void {
  localStorage.removeItem(key)
  localStorage.removeItem(`${key}${CACHE_TIMESTAMP_SUFFIX}`)
}

/** Remove state written by the retired Vault Type feature before it can be rendered again. */
export function clearLegacyVaultDocumentTypeState(): void {
  try {
    LEGACY_VAULT_DOCUMENT_TYPES_CACHE_KEYS.forEach(removeCachedKey)
  } catch {
    // Local storage may be unavailable; the feature has no fallback consumer.
  }
}

export function getCachedJSON<T>(key: string, fallback: T): T {
  try {
    if (EXPIRING_CACHE_KEYS.has(key) || key === CYCLE_SNAPSHOTS_KEY) {
      const timestamp = Number(localStorage.getItem(`${key}${CACHE_TIMESTAMP_SUFFIX}`))
      if (timestamp > 0 && Date.now() - timestamp > CACHE_TTL_MS) {
        removeCachedKey(key)
        return fallback
      }
    }
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
    typeof tx.amount === 'number' && Number.isFinite(tx.amount)
  )
}

export function sanitizeTransactions(value: unknown): Transaction[] {
  if (!Array.isArray(value)) return []
  return value.filter(isWellFormedTransaction)
}

export function getCachedTransactions(key: string): Transaction[] {
  return sanitizeTransactions(getCachedJSON<unknown>(key, []))
}

// Privacy/display masking only. This fixed-key encoding is NOT encryption and
// must never be relied upon to protect data from scripts or device access.
const OBFUSCATION_KEY = "FinancialAppObfuscationKey"

function decodeCachedAmount(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value !== 'string') return 0

  // Try the obfuscated form FIRST, and accept it only if it decodes to the exact shape
  // obfuscateAmount() emits (`toFixed(2)`, so always two decimal places). Testing
  // `Number(value)` first was ambiguous in the wrong direction: the base64 alphabet
  // includes digits, so an obfuscated amount whose encoding happens to be all digits
  // parses as a finite number and was returned raw — a wildly wrong figure rather than
  // the real one. Deciding on the decoded *shape* removes the ambiguity, because a
  // legacy plaintext value either fails to base64-decode at all or decodes to bytes
  // that do not look like money, and so still falls through to the plain branch below.
  const decoded = decodeObfuscatedMoney(value)
  if (decoded !== undefined) return decoded

  const plain = Number(value)
  return Number.isFinite(plain) ? plain : 0
}

/** `undefined` when `value` is not an obfuscated amount, so the caller can fall back. */
function decodeObfuscatedMoney(value: string): number | undefined {
  try {
    const binaryString = atob(value)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i) ^ OBFUSCATION_KEY.charCodeAt(i % OBFUSCATION_KEY.length)
    }
    const text = new TextDecoder().decode(bytes)
    if (!/^-?\d+\.\d{2}$/.test(text)) return undefined
    const amount = Number(text)
    return Number.isFinite(amount) ? amount : undefined
  } catch {
    return undefined
  }
}

function isWellFormedWishlistItem(item: unknown): item is WishlistItem {
  if (!item || typeof item !== 'object') return false
  const wish = item as Record<string, unknown>
  return (
    typeof wish.id === 'number' &&
    typeof wish.name === 'string' &&
    typeof wish.priority === 'string' &&
    typeof wish.isPurchased === 'boolean' &&
    typeof wish.createdAt === 'string' &&
    typeof wish.isActive === 'boolean'
  )
}

function sanitizeWishlist(value: unknown): WishlistItem[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(isWellFormedWishlistItem)
    .map(item => ({
      ...item,
      price: decodeCachedAmount((item as unknown as Record<string, unknown>).price)
    }))
}

export function getCachedWishlist(key: string): WishlistItem[] {
  return sanitizeWishlist(getCachedJSON<unknown>(key, []))
}

export function setCachedJSON(key: string, value: unknown): boolean {
  const serialized = JSON.stringify(value)
  const write = () => {
    localStorage.setItem(key, serialized)
    if (EXPIRING_CACHE_KEYS.has(key)) {
      localStorage.setItem(`${key}${CACHE_TIMESTAMP_SUFFIX}`, Date.now().toString())
    }
  }

  try {
    write()
    return true
  } catch {
    // Pending/failed operation queues are user data. Only stale-while-revalidate
    // caches may be sacrificed to make room for an outbox write.
    //
    // Evict one at a time and retry after each, so a write that overruns the quota by a
    // few bytes costs one cold panel rather than all of them. Dropping the whole set up
    // front meant a marginal overrun re-fetched the dashboard, ledger, wishlist,
    // investments and settings on the next open. The key being written is skipped: it is
    // about to be overwritten anyway, and if the write ultimately fails, deleting it
    // would destroy the very data this call was trying to persist — for an outbox write
    // that means losing queued user mutations, so failing with the old value intact is
    // strictly better than clearing it.
    for (const disposableKey of DISPOSABLE_CACHE_KEYS) {
      if (disposableKey === key) continue
      try {
        removeCachedKey(disposableKey)
      } catch {
        // Storage can also reject removals (private mode / disabled storage).
      }
      try {
        write()
        return true
      } catch {
        // Still over quota — sacrifice the next one.
      }
    }

    return false
  }
}

export function hasCachedKey(key: string): boolean {
  return getCachedJSON<unknown>(key, null) !== null
}

export function clearCachedInvestmentPages(): void {
  try {
    const keys: string[] = []
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (key?.startsWith('cached_investment_activity:') || key?.startsWith('cached_investment_cash_flows:')) {
        keys.push(key)
      }
    }
    keys.forEach(removeCachedKey)
  } catch {
    // Investment page caches are stale-while-revalidate only. Clearing them is
    // best-effort when storage is unavailable or restricted.
  }
}

export function clearLocalFinancialData(): void {
  void import('./draftTransactionDocuments').then(({ clearDraftTransactionDocuments }) =>
    clearDraftTransactionDocuments())
  for (const key of [...Object.values(CACHE_KEYS), CYCLE_SNAPSHOTS_KEY]) {
    try {
      removeCachedKey(key)
    } catch {
      // Clearing local data is best-effort. One rejected storage operation
      // should not prevent the remaining caches and drafts from being removed.
    }
  }
  clearCachedInvestmentPages()
  clearLegacyVaultDocumentTypeState()
  for (const key of [
    'draft_transactions', 'pending_operations_backup', 'pending_transactions_backup',
    'draft_transactions_backup', 'failed_operations', 'failed_operations_backup',
  ]) {
    try {
      localStorage.removeItem(key)
    } catch {
      // See above.
    }
  }
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

// Per-cycle snapshots let switching to a previously-visited month/year render
// instantly with the last-seen data (stale-while-revalidate) instead of
// always showing a skeleton while loadAll() re-fetches. Capped at
// MAX_CYCLE_SNAPSHOTS, evicting the least-recently-cached entry, so this
// can't grow unbounded across a long-lived session.
const MAX_CYCLE_SNAPSHOTS = 6

interface CycleSnapshot {
  dashboardData: DashboardData
  transactions: Transaction[]
  cachedAt: number
}

function cycleSnapshotKey(month: string, year: number): string {
  return `${year}-${month}`
}

export function getCachedCycleSnapshot(month: string, year: number): CycleSnapshot | null {
  const all = getCachedJSON<Record<string, CycleSnapshot>>(CYCLE_SNAPSHOTS_KEY, {})
  return all[cycleSnapshotKey(month, year)] || null
}

export function setCachedCycleSnapshot(month: string, year: number, dashboardData: DashboardData, transactions: Transaction[]): void {
  const all = getCachedJSON<Record<string, CycleSnapshot>>(CYCLE_SNAPSHOTS_KEY, {})
  all[cycleSnapshotKey(month, year)] = { dashboardData, transactions, cachedAt: Date.now() }

  const entries = Object.entries(all)
  if (entries.length > MAX_CYCLE_SNAPSHOTS) {
    entries.sort((a, b) => a[1].cachedAt - b[1].cachedAt)
    for (let i = 0; i < entries.length - MAX_CYCLE_SNAPSHOTS; i++) delete all[entries[i][0]]
  }

  setCachedJSON(CYCLE_SNAPSHOTS_KEY, all)
}

export function getCachedOps(): QueuedOp[] {
  clearLegacyVaultDocumentTypeState()
  const rawOps = localStorage.getItem(CACHE_KEYS.pendingOperations)
  if (rawOps !== null) {
    const raw = getCachedJSON<unknown>(CACHE_KEYS.pendingOperations, [])
    const sanitized = sanitizeQueuedOps(raw)
    if (Array.isArray(raw) && sanitized.length !== raw.length) {
      setCachedJSON(CACHE_KEYS.pendingOperations, sanitized)
    }
    return sanitized
  }

  // Migration path for legacy pending_transactions key
  const rawPendingTx = localStorage.getItem(CACHE_KEYS.pendingTransactions)
  if (rawPendingTx !== null) {
    const legacyTxs = getCachedTransactions(CACHE_KEYS.pendingTransactions) as LegacyPendingTransaction[]
    const convertedOps: QueuedOp[] = legacyTxs.map(tx => {
      const finalId = tx.serverTxId || tx.id
      const payload = { ...tx, id: finalId }
      delete payload.serverTxId
      delete payload.isPendingSync
      return {
        id: `op-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        entity: 'transaction' as const,
        type: 'add' as const,
        targetId: finalId,
        payload,
        createdAt: Date.now(),
        retryCount: 0
      }
    })
    setCachedJSON(CACHE_KEYS.pendingOperations, convertedOps)
    localStorage.removeItem(CACHE_KEYS.pendingTransactions)
    return convertedOps
  }

  return []
}
