import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

export type BadgeTone = 'neutral' | 'accent' | 'info' | 'success' | 'warning' | 'danger'

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'border-border/60 bg-muted/55 text-muted-foreground',
  accent: 'border-primary/25 bg-primary/12 text-accent-ink',
  info: 'border-blue-500/25 bg-blue-500/10 text-blue-600 dark:text-blue-300',
  success: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  warning: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  danger: 'border-destructive/25 bg-destructive/10 text-destructive',
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
  size?: 'sm' | 'md'
}

export function Badge({ tone = 'neutral', size = 'sm', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full border font-bold leading-none tabular-nums',
        size === 'sm' ? 'min-h-5 px-2 text-xs' : 'min-h-6 px-2.5 text-xs',
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  )
}

export function StatusBadge(props: BadgeProps) {
  return <Badge role="status" {...props} />
}
