import { ToggleLeft, ToggleRight } from 'lucide-react'
import { triggerHaptic } from '../../lib/haptics'

interface ToggleButtonProps {
  active: boolean
  onClick: () => void
  disabled?: boolean
  className?: string
}

export function ToggleButton({ active, onClick, disabled, className = 'size-8' }: ToggleButtonProps) {
  return (
    <button
      type="button"
      onClick={() => { triggerHaptic(10); onClick() }}
      disabled={disabled}
      className="text-muted-foreground hover:text-foreground cursor-pointer transition duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {active ? (
        <ToggleRight className={`${className} text-blue-500`} />
      ) : (
        <ToggleLeft className={className} />
      )}
    </button>
  )
}
