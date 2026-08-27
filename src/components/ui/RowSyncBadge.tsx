import React from 'react'
import { m, AnimatePresence, useReducedMotion } from 'framer-motion'
import { AlertCircle, Loader2, Clock } from 'lucide-react'
import { mutationBusyLabel, resolveRowSyncState, type RowSyncFlags, type RowSyncState } from './rowSyncState'

export interface RowSyncStatusProps extends RowSyncFlags {
  entityLabel: string
}

/**
 * Drop-in per-row status indicator. Pass the three raw booleans and it picks the
 * right badge (or renders nothing). Prefer this over calling RowSyncBadge with a
 * hand-written state ternary — that's how the precedence drifted in the first place.
 */
export const RowSyncStatus: React.FC<RowSyncStatusProps> = ({ entityLabel, ...flags }) => {
  const state = resolveRowSyncState(flags)
  return (
    <AnimatePresence mode="wait">
      {state && <RowSyncBadge key={state} state={state} entityLabel={entityLabel} />}
    </AnimatePresence>
  )
}

const STATE_STYLE: Record<RowSyncState, string> = {
  deleting: 'text-red-500 bg-red-500/10 border-red-500/20',
  syncing: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
  pending: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
  failed: 'text-destructive bg-destructive/10 border-destructive/20',
}

/**
 * Inline per-row status badge for optimistic mutations (delete/update/queued).
 * Shared across Ledger/Wishlist/Settings/RecurringPayments so the three sync
 * states read identically everywhere instead of six near-duplicate blocks.
 */
const RowSyncBadge: React.FC<{ state: RowSyncState; entityLabel: string }> = ({ state, entityLabel }) => {
  const reduceMotion = useReducedMotion()
  const title = state === 'pending'
    ? 'Pending sync (offline)'
    : state === 'failed'
      ? `${entityLabel} sync failed; open Sync issues to retry`
      : `${state === 'deleting' ? 'Deleting' : 'Updating'} ${entityLabel}…`
  const Icon = state === 'pending' ? Clock : state === 'failed' ? AlertCircle : Loader2

  return (
    <m.span
      initial={reduceMotion ? false : { opacity: 0, scale: 0.85, y: -2 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, scale: 0.85, y: 2 }}
      transition={{ duration: reduceMotion ? 0 : 0.18, ease: 'easeOut' }}
      title={title}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label={title}
      className={`inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded-md border shrink-0 select-none ${STATE_STYLE[state]}`}
    >
      <Icon aria-hidden="true" className={`size-2.5 shrink-0 mr-1 ${state === 'syncing' || state === 'deleting' ? 'animate-spin' : ''}`} />
      <span aria-hidden="true">{mutationBusyLabel(state)}</span>
    </m.span>
  )
}
