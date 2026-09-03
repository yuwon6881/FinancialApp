import { ToggleLeft, ToggleRight } from 'lucide-react'
import { triggerHaptic } from '../../lib/haptics'
import type { RowSyncFlags } from './rowSyncState'
import { Button } from './Button'
import { RowSyncStatus } from './RowSyncBadge'

interface ToggleButtonProps {
  active: boolean
  onClick: () => void
  label: string
  disabled?: boolean
  className?: string
  mutationStatus?: RowSyncFlags
  mutationEntityLabel?: string
}

export function ToggleButton({
  active,
  onClick,
  label,
  disabled,
  className = 'size-8',
  mutationStatus,
  mutationEntityLabel,
}: ToggleButtonProps) {
  return (
    <Button
      variant="tertiary"
      size="icon"
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={label}
      aria-busy={mutationStatus?.isSyncing || mutationStatus?.isDeleting || undefined}
      onClick={() => { triggerHaptic(10); onClick() }}
      disabled={disabled}
      className="relative inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer transition duration-150 disabled:opacity-40 disabled:cursor-not-allowed sm:min-h-8 sm:min-w-8"
    >
      {active ? (
        <ToggleRight className={`${className} text-blue-500`} />
      ) : (
        <ToggleLeft className={className} />
      )}
      {mutationStatus && mutationEntityLabel && (
        <RowSyncStatus
          {...mutationStatus}
          entityLabel={mutationEntityLabel}
          className="pointer-events-none absolute right-0 top-0 origin-top-right scale-75"
        />
      )}
    </Button>
  )
}
