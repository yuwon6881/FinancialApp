import type { ReactNode } from 'react'
import { AlertCircle, Clock, Loader2 } from 'lucide-react'
import { mutationBusyLabel, mutationStatusAnnouncement, type MutationBusyState } from './rowSyncState'

interface MutationButtonContentProps {
  state: MutationBusyState | null
  entityLabel: string
  idleLabel: string
  busyLabel?: string
  idleIcon?: ReactNode
}

const stateIcon = (state: MutationBusyState): ReactNode => {
  if (state === 'pending') return <Clock className="size-4" aria-hidden="true" />
  if (state === 'failed') return <AlertCircle className="size-4" aria-hidden="true" />
  return <Loader2 className="size-4 animate-spin" aria-hidden="true" />
}

/**
 * Stable content for mutation buttons. Both the idle and busy variants take part
 * in intrinsic sizing, while only the active variant is painted. This prevents
 * neighbouring controls from moving when a label changes to "Saving…" or similar.
 */
export function MutationButtonContent({
  state,
  entityLabel,
  idleLabel,
  busyLabel = state ? mutationBusyLabel(state) : idleLabel,
  idleIcon,
}: MutationButtonContentProps) {
  const busy = state !== null
  const announcement = busy && state
    ? state === 'pending' || state === 'failed'
      ? mutationStatusAnnouncement(state, entityLabel)
      : `${busyLabel.replace(/…$/, '')} ${entityLabel}…`
    : null

  return (
    <span
      className="inline-grid items-center"
      data-mutation-button-content=""
      data-mutation-state={state ?? 'idle'}
    >
      <span aria-hidden="true" className="invisible col-start-1 row-start-1 inline-flex items-center justify-center gap-1.5">
        {idleIcon && <span className="inline-grid size-4 shrink-0 place-items-center">{idleIcon}</span>}
        <span>{idleLabel}</span>
      </span>
      <span aria-hidden="true" className="invisible col-start-1 row-start-1 inline-flex items-center justify-center gap-1.5">
        <span className="inline-grid size-4 shrink-0 place-items-center" />
        <span>{busyLabel}</span>
      </span>
      <span
        data-mutation-visible-content=""
        className="col-start-1 row-start-1 inline-flex items-center justify-center gap-1.5"
        aria-hidden={busy ? 'true' : undefined}
      >
        {(busy || idleIcon) && (
          <span data-mutation-visible-icon="" className="inline-grid size-4 shrink-0 place-items-center">
            {busy && state ? stateIcon(state) : idleIcon}
          </span>
        )}
        <span>{busy ? busyLabel : idleLabel}</span>
      </span>
      {announcement && (
        <span className="sr-only" role="status" aria-label={announcement} aria-live="polite" aria-atomic="true">
          {announcement}
        </span>
      )}
    </span>
  )
}

export function MutationStatusAnnouncement({ state, entityLabel }: { state: MutationBusyState | null; entityLabel: string }) {
  if (!state) return null
  const announcement = mutationStatusAnnouncement(state, entityLabel)
  return (
    <span className="sr-only" role="status" aria-label={announcement} aria-live="polite" aria-atomic="true">
      {announcement}
    </span>
  )
}
