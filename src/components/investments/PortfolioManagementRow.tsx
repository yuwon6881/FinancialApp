import { useId } from 'react'
import type { ReactNode } from 'react'
import { Button } from '../ui/Button'
import { RowSyncStatus } from '../ui/RowSyncBadge'

interface PortfolioManagementRowProps {
  name: string
  details: string
  entityLabel: string
  isArchived: boolean
  canDelete?: boolean
  canArchive?: boolean
  archiveUnavailableReason?: string
  isPendingSync?: boolean
  isPendingDelete?: boolean
  isSyncing: boolean
  mutationsDisabled: boolean
  onArchive: () => void
  onDelete: () => void
  onUnarchive: () => void
}

export function PortfolioManagementRow({
  name, details, entityLabel, isArchived, canDelete, canArchive,
  archiveUnavailableReason, isPendingSync, isPendingDelete, isSyncing,
  mutationsDisabled, onArchive, onDelete, onUnarchive,
}: PortfolioManagementRowProps) {
  const reasonId = useId()
  const blocked = !isArchived && !canDelete && !canArchive
  const pending = Boolean(isPendingSync || isPendingDelete || isSyncing)
  const action = isArchived ? 'Unarchive' : canDelete ? 'Delete' : 'Archive'
  const reason: ReactNode = blocked
    ? archiveUnavailableReason ?? 'Archive availability is not yet confirmed. Refresh the portfolio to check.'
    : undefined

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 rounded-control bg-surface-2/70 p-3" aria-busy={pending}>
      <div className="min-w-0 self-center">
        <div className="flex min-w-0 items-center gap-2">
          <strong className="min-w-0 break-words text-body font-medium text-foreground">{name}</strong>
          {pending && <RowSyncStatus
            isDeleting={Boolean(isPendingDelete)}
            isSyncing={isSyncing}
            isPending={isPendingSync && !isSyncing}
            entityLabel={entityLabel}
          />}
        </div>
        <p className="mt-1 break-words text-caption text-muted-foreground">{details}{isArchived ? ' · Archived' : ''}</p>
      </div>
      <Button
        variant={!isArchived && canDelete ? 'destructive' : 'secondary'}
        size="sm"
        disabled={mutationsDisabled || pending || blocked}
        aria-label={`${action} ${name}`}
        aria-describedby={blocked ? reasonId : undefined}
        onClick={isArchived ? onUnarchive : canDelete ? onDelete : onArchive}
      >
        {action}
      </Button>
      {blocked && <p id={reasonId} className="col-span-2 break-words text-caption leading-relaxed text-muted-foreground">
        <span className="font-semibold text-foreground">Before archiving: </span>{reason}
      </p>}
    </div>
  )
}
