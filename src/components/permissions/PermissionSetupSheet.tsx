import type { LucideIcon } from 'lucide-react'
import { BottomSheet } from '../ui/BottomSheet'
import { Button } from '../ui/Button'
import { ModalActions } from '../ui/ModalActions'
import { StatusBadge, type BadgeTone } from '../ui/Badge'

/** `incomplete` is a feature switched on whose system access is not finished yet. */
export type PermissionRowStatus = 'allowed' | 'needed' | 'incomplete' | 'blocked' | 'optional' | 'checking' | 'unavailable'

export interface PermissionRowAction {
  label: string
  onClick: () => void
  loading?: boolean
  disabled?: boolean
}

export interface PermissionRow {
  id: string
  icon: LucideIcon
  title: string
  /** What the user gets, in one line. Never what the permission is called by the system. */
  description: string
  status: PermissionRowStatus
  /** Why the row cannot finish here, or what to do next. */
  note?: string
  action?: PermissionRowAction
}

const STATUS: Record<PermissionRowStatus, { label: string; tone: BadgeTone }> = {
  allowed: { label: 'Allowed', tone: 'success' },
  needed: { label: 'Not allowed', tone: 'neutral' },
  incomplete: { label: 'Setup needed', tone: 'warning' },
  blocked: { label: 'Blocked', tone: 'warning' },
  optional: { label: 'Optional', tone: 'neutral' },
  checking: { label: 'Checking', tone: 'neutral' },
  unavailable: { label: 'Unavailable', tone: 'neutral' },
}

function PermissionItem({ row }: { row: PermissionRow }) {
  const Icon = row.icon
  const status = STATUS[row.status]
  return (
    <li className="flex gap-3 rounded-control border border-border/60 bg-card p-3" aria-label={row.title}>
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/12 text-accent-ink" aria-hidden="true">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-0.5">
            <p className="text-body font-medium text-foreground">{row.title}</p>
            <p className="text-caption text-muted-foreground">{row.description}</p>
          </div>
          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
        </div>
        {row.note && <p className="text-caption text-muted-foreground">{row.note}</p>}
        {row.action && (
          <div className="flex justify-end">
            <Button
              variant="secondary"
              size="sm"
              loading={row.action.loading}
              disabled={row.action.disabled}
              aria-label={`${row.action.label}: ${row.title}`}
              onClick={row.action.onClick}
            >
              {row.action.label}
            </Button>
          </div>
        )}
      </div>
    </li>
  )
}

interface Props {
  isOpen: boolean
  rows: PermissionRow[]
  /** Absent when nothing is left that one press can ask for. */
  onAllowAll?: () => void
  allowAllBusy: boolean
  /** Not now, Close and Done all mean the same: the sheet goes, and nothing is asked again unprompted. */
  onClose: () => void
  /** The first, unprompted showing says "Not now"; one opened from Settings says "Close". */
  firstRun: boolean
}

/**
 * Every permission the app can use on this phone, in one place. Each row is independent, so some,
 * all or none can be allowed; the system's own dialog is only ever shown from a press here.
 */
export function PermissionSetupSheet({ isOpen, rows, onAllowAll, allowAllBusy, onClose, firstRun }: Props) {
  const counted = rows.filter(row => row.status !== 'optional' && row.status !== 'unavailable')
  const allowed = counted.filter(row => row.status === 'allowed').length
  const done = counted.length > 0 && allowed === counted.length
  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="App permissions"
      description="Choose what FinancialApp can use on this phone. Allow some, all or none — you can change this any time in Settings."
      footer={
        <ModalActions>
          {done || !onAllowAll ? (
            <Button variant="primary" onClick={onClose}>Done</Button>
          ) : (
            <>
              <Button variant="secondary" disabled={allowAllBusy} onClick={onClose}>{firstRun ? 'Not now' : 'Close'}</Button>
              <Button variant="primary" loading={allowAllBusy} onClick={onAllowAll}>Allow all</Button>
            </>
          )}
        </ModalActions>
      }
    >
      <div className="space-y-3">
        {counted.length > 0 && (
          <p className="text-label text-muted-foreground" aria-live="polite">
            {allowed} of {counted.length} allowed
          </p>
        )}
        <ul className="space-y-2.5" aria-label="Permissions">
          {rows.map(row => <PermissionItem key={row.id} row={row} />)}
        </ul>
      </div>
    </BottomSheet>
  )
}
