import { cn } from '../../lib/utils'

export type ControlSize = 'sm' | 'md' | 'lg'

const CONTROL_SIZES: Record<ControlSize, string> = {
  sm: 'h-11 rounded-control px-3 text-label lg:h-9',
  md: 'h-11 rounded-control px-3.5 text-body lg:h-10',
  lg: 'h-12 rounded-control px-4 text-callout',
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
    // A field is a quiet well: in Day one step below the white card, in Night a faint tint over it
    // (the canvas colour read as a hole punched through the card). Focus settles it on the card
    // colour with an Iris ring.
    'w-full border bg-background text-foreground outline-none dark:bg-surface-2/50 transition-[background-color,border-color,box-shadow] duration-200 ease-fluid',
    'placeholder:text-subtle-foreground',
    'disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted-foreground disabled:opacity-70',
    'read-only:cursor-default read-only:bg-surface-2/60',
    invalid
      ? 'border-destructive focus:border-destructive focus:ring-2 focus:ring-destructive/25'
      : 'border-border hover:border-input focus:border-ring focus:bg-card focus:ring-2 focus:ring-ring/25 dark:focus:bg-card',
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
      'flex items-center justify-between gap-2 text-left font-medium select-none',
      'hover:bg-surface-2/60 focus-visible:outline-none',
      className,
    ),
  })
}
