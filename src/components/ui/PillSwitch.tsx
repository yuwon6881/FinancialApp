import { cn } from '../../lib/utils'

interface PillSwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  ariaLabel: string
  disabled?: boolean
}

/**
 * The visual half of every switch in the app: a track with a sliding thumb, brand-coloured when on.
 * Drawn as a span so a 44px hit area can wrap it without stretching the track.
 */
export function SwitchTrack({ checked, className }: { checked: boolean; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors duration-200 ease-fluid',
        checked ? 'bg-primary' : 'bg-foreground/15 dark:bg-foreground/20',
        className,
      )}
    >
      <span
        className={cn(
          'size-5 rounded-full bg-thumb shadow-sm ring-1 ring-foreground/5 transition-transform duration-200 ease-fluid',
          checked ? 'translate-x-[1.125rem]' : 'translate-x-0.5',
        )}
      />
    </span>
  )
}

export function PillSwitch({ checked, onChange, ariaLabel, disabled = false }: PillSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 lg:min-h-8"
    >
      <SwitchTrack checked={checked} />
    </button>
  )
}
