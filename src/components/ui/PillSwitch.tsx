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
      className={`relative inline-flex h-7 w-16 shrink-0 items-center rounded-full border transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked
          ? 'border-blue-500/60 bg-blue-600 text-white'
          : 'border-border bg-muted/70 text-muted-foreground'
      }`}
    >
      <span className={`absolute text-[9px] font-bold uppercase tracking-wide ${checked ? 'left-2' : 'right-2'}`}>
        {checked ? 'On' : 'Off'}
      </span>
      <span
        aria-hidden="true"
        className={`size-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${checked ? 'translate-x-9' : 'translate-x-1'}`}
      />
    </button>
  )
}
