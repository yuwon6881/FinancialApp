interface PillSwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  ariaLabel: string
  disabled?: boolean
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
      className={`relative inline-flex h-7 w-16 shrink-0 items-center rounded-full border transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked
          ? 'border-primary/60 bg-primary text-primary-foreground'
          : 'border-border bg-muted/70 text-muted-foreground'
      }`}
    >
      <span className={`absolute text-eyebrow uppercase ${checked ? 'left-2' : 'right-2'}`}>
        {checked ? 'On' : 'Off'}
      </span>
      <span
        aria-hidden="true"
        // The knob reads against the track it sits on: the surface colour on the
        // accent fill (a white knob on Ayu's gold barely separates), the ink colour
        // on the muted off state.
        className={`size-5 rounded-full shadow-sm transition-transform duration-200 ${checked ? 'bg-primary-foreground translate-x-9' : 'bg-foreground/70 translate-x-1'}`}
      />
    </button>
  )
}
