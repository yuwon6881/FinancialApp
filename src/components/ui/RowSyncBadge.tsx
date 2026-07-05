import React from 'react'
import { Loader2, Clock } from 'lucide-react'

type RowSyncState = 'deleting' | 'syncing' | 'pending'

const STATE_STYLE: Record<RowSyncState, string> = {
  deleting: 'text-red-500 bg-red-500/10 border-red-500/20',
  syncing: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
  pending: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
}

const STATE_LABEL: Record<RowSyncState, string> = {
  deleting: 'Deleting...',
  syncing: 'Syncing...',
  pending: 'Pending',
}

/**
 * Inline per-row status badge for optimistic mutations (delete/update/queued).
 * Shared across Ledger/Wishlist/Settings/RecurringPayments so the three sync
 * states read identically everywhere instead of six near-duplicate blocks.
 */
export const RowSyncBadge: React.FC<{ state: RowSyncState; entityLabel: string }> = ({ state, entityLabel }) => {
  const title = state === 'pending' ? 'Pending sync (offline)' : `${state === 'deleting' ? 'Deleting' : 'Updating'} ${entityLabel}...`
  const Icon = state === 'pending' ? Clock : Loader2

  return (
    <span
      title={title}
      className={`inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded-md border shrink-0 select-none animate-pulse ${STATE_STYLE[state]}`}
    >
      <Icon className={`size-2.5 shrink-0 mr-1 ${state === 'pending' ? '' : 'animate-spin'}`} />
      {STATE_LABEL[state]}
    </span>
  )
}
