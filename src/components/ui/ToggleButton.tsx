import { ToggleLeft, ToggleRight } from 'lucide-react'
import { triggerHaptic } from '../../lib/haptics'

interface ToggleButtonProps {
  active: boolean
  onClick: () => void
  label: string
  disabled?: boolean
  className?: string
}

export function ToggleButton({ active, onClick, label, disabled, className = 'size-8' }: ToggleButtonProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={label}
      onClick={() => { triggerHaptic(10); onClick() }}
      disabled={disabled}
      className="inline-flex min-h-8 min-w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer transition duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {active ? (
        <ToggleRight className={`${className} text-blue-500`} />
      ) : (
        <ToggleLeft className={className} />
      )}
    </button>
  )
}
