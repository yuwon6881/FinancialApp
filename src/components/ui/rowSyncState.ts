export type RowSyncState = 'deleting' | 'syncing' | 'failed' | 'pending'

export interface RowSyncFlags {
  /** Optimistic-delete in flight or queued (isPendingDelete / deletingId match). */
  isDeleting?: boolean
  /** This row's mutation is the one currently being dispatched (activeSyncId match). */
  isSyncing?: boolean
  /** Row has an unsent queued mutation (offline) — isPendingSync. */
  isPending?: boolean
  /** The queued mutation exhausted automatic retry and needs user attention. */
  isFailed?: boolean
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
  if (flags.isFailed) return 'failed'
  if (flags.isPending) return 'pending'
  return null
}

/**
 * The two extra states a list-level summary can report that a single row cannot:
 * an add is "Saving…" and an undo of a delete is "Undoing…". Rows never need these
 * because a queued add renders as its own optimistic row.
 */
export type MutationBusyState = RowSyncState | 'saving' | 'undoing'

/**
 * Every user-visible busy word in the mutation vocabulary, in one place. The row
 * badge and any list-level summary read from this map so they cannot drift apart
 * in wording or in punctuation — the ellipsis is the single `…` character used
 * throughout the app, not three periods.
 */
const MUTATION_BUSY_LABELS: Record<MutationBusyState, string> = {
  deleting: 'Deleting…',
  syncing: 'Syncing…',
  pending: 'Pending',
  failed: 'Failed',
  saving: 'Saving…',
  undoing: 'Undoing…',
}

export function mutationBusyLabel(state: MutationBusyState): string {
  return MUTATION_BUSY_LABELS[state]
}

/**
 * Maps an in-flight outbox op type onto the same vocabulary, for surfaces that
 * report one aggregate status for a whole list (Investments' activity header) as
 * opposed to a per-row badge. Kept here rather than inlined at the call site so a
 * new op type gets its wording decided once.
 */
export function resolveMutationBusyLabel(opType: string | undefined): string | null {
  if (!opType) return null
  if (opType === 'delete') return MUTATION_BUSY_LABELS.deleting
  if (opType === 'restore') return MUTATION_BUSY_LABELS.undoing
  if (opType === 'add') return MUTATION_BUSY_LABELS.saving
  return MUTATION_BUSY_LABELS.syncing
}
