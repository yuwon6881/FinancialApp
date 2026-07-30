import { cn } from '../../lib/utils'

export type ControlSize = 'sm' | 'md' | 'lg'

const CONTROL_SIZES: Record<ControlSize, string> = {
  sm: 'h-9 rounded-lg px-3 text-xs',
  md: 'h-10 rounded-xl px-3.5 text-sm',
  lg: 'h-12 rounded-xl px-4 text-sm',
}

export function controlClassName({
  size = 'md',
  invalid = false,
  className,
}: {
  size?: ControlSize
  invalid?: boolean
  className?: string
}) {
  return cn(
    'w-full border bg-background text-foreground shadow-xs outline-none transition duration-200',
    'placeholder:text-muted-foreground/70',
    'disabled:cursor-not-allowed disabled:bg-muted/40 disabled:text-muted-foreground disabled:opacity-70',
    'read-only:cursor-default read-only:bg-muted/20',
    invalid
      ? 'border-destructive focus:border-destructive focus:ring-2 focus:ring-destructive/25'
      : 'border-border focus:border-ring focus:ring-2 focus:ring-ring/25',
    CONTROL_SIZES[size],
    className,
  )
}

export function controlTriggerClassName({
  size = 'md',
  invalid = false,
  className,
}: {
  size?: ControlSize
  invalid?: boolean
  className?: string
}) {
  return controlClassName({
    size,
    invalid,
    className: cn(
      'flex items-center justify-between gap-2 text-left font-semibold select-none',
      'hover:bg-muted/30 focus-visible:outline-none',
      className,
    ),
  })
}
