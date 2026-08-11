import { ToggleLeft, ToggleRight } from 'lucide-react'
import { triggerHaptic } from '../../lib/haptics'
import { Button } from './Button'

interface ToggleButtonProps {
  active: boolean
  onClick: () => void
  label: string
  disabled?: boolean
  className?: string
}

export function ToggleButton({ active, onClick, label, disabled, className = 'size-8' }: ToggleButtonProps) {
  return (
    <Button
      variant="unstyled"
      size="icon"
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={label}
      onClick={() => { triggerHaptic(10); onClick() }}
      disabled={disabled}
      className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer transition duration-150 disabled:opacity-40 disabled:cursor-not-allowed sm:min-h-8 sm:min-w-8"
    >
      {active ? (
        <ToggleRight className={`${className} text-blue-500`} />
      ) : (
        <ToggleLeft className={className} />
      )}
    </Button>
  )
}
