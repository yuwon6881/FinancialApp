import { triggerHaptic } from '../../lib/haptics'
import type { RowSyncFlags } from './rowSyncState'
import { Button } from './Button'
import { RowSyncStatus } from './RowSyncBadge'
import { SwitchTrack } from './PillSwitch'

interface ToggleButtonProps {
  active: boolean
  onClick: () => void
  label: string
  disabled?: boolean
  /** Formerly the icon size. The switch track has one size now, so this is accepted and ignored. */
  className?: string
  mutationStatus?: RowSyncFlags
  mutationEntityLabel?: string
}

export function ToggleButton({
  active,
  onClick,
  label,
  disabled,
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
      className="relative inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full cursor-pointer hover:bg-transparent disabled:opacity-40 disabled:cursor-not-allowed lg:min-h-8 lg:min-w-8"
    >
      <SwitchTrack checked={active} />
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
