export type RowSyncState = 'deleting' | 'syncing' | 'pending'

export interface RowSyncFlags {
  /** Optimistic-delete in flight or queued (isPendingDelete / deletingId match). */
  isDeleting?: boolean
  /** This row's mutation is the one currently being dispatched (activeSyncId match). */
  isSyncing?: boolean
  /** Row has an unsent queued mutation (offline) — isPendingSync. */
  isPending?: boolean
}

/**
 * Canonical precedence for the per-row status badge. Deleting always wins over
 * syncing, which wins over pending. This is the SINGLE source of truth for that
 * ordering — every view renders through it so the badge can never disagree
 * between tabs (a delete once read "Syncing…" then "Deleting…" only in Settings
 * because that call site inlined the ternary in the opposite order).
 */
export function resolveRowSyncState(flags: RowSyncFlags): RowSyncState | null {
  if (flags.isDeleting) return 'deleting'
  if (flags.isSyncing) return 'syncing'
  if (flags.isPending) return 'pending'
  return null
}
