import React from 'react'
import { m, AnimatePresence, useReducedMotion } from 'framer-motion'
import { AlertCircle, Loader2, Clock } from 'lucide-react'
import { cn } from '../../lib/utils'
import { mutationStatusAnnouncement, resolveRowSyncState, type RowSyncFlags, type RowSyncState } from './rowSyncState'

export interface RowSyncStatusProps extends RowSyncFlags {
  entityLabel: string
  className?: string
}

/**
 * Drop-in per-row status indicator. Pass the raw mutation flags and it reserves a
 * fixed slot for the highest-priority state. Prefer this over a hand-written state
 * ternary so precedence and geometry remain consistent.
 */
export const RowSyncStatus: React.FC<RowSyncStatusProps> = ({ entityLabel, className, ...flags }) => {
  const state = resolveRowSyncState(flags)
  return (
    <span
      data-mutation-status-slot=""
      data-mutation-state={state ?? 'idle'}
      className={cn('relative inline-grid size-5 shrink-0 place-items-center align-middle', className)}
      aria-hidden={state ? undefined : 'true'}
    >
      <AnimatePresence mode="wait" initial={false}>
        {state && <RowSyncBadge key={state} state={state} entityLabel={entityLabel} />}
      </AnimatePresence>
    </span>
  )
}

const STATE_STYLE: Record<RowSyncState, string> = {
  deleting: 'text-red-500 bg-red-500/10 border-red-500/20',
  syncing: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
  pending: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
  failed: 'text-destructive bg-destructive/10 border-destructive/20',
}

/**
 * Compact per-row status for optimistic mutations. The parent slot is always
 * present, so entering or leaving a state cannot steal width from a title,
 * amount, or description.
 */
const RowSyncBadge: React.FC<{ state: RowSyncState; entityLabel: string }> = ({ state, entityLabel }) => {
  const reduceMotion = useReducedMotion()
  const title = mutationStatusAnnouncement(state, entityLabel)
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
      className={`absolute inset-0 inline-grid place-items-center rounded-md border select-none ${STATE_STYLE[state]}`}
    >
      <Icon aria-hidden="true" className={`size-3 shrink-0 ${state === 'syncing' || state === 'deleting' ? 'animate-spin' : ''}`} />
    </m.span>
  )
}
