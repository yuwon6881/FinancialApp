import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

/**
 * `warning` and `urgent` are the same distinction `PANEL_TONES` makes, in the same two colours:
 * amber for "needs attention eventually", orange for "already over". Hand-rolled pills used both
 * on sibling elements, so the names have to agree across the two primitives or a reader learns the
 * colour twice.
 *
 * Lumen badges are tinted pills with no outline: the tint carries the tone, and a border on a
 * 20px pill only adds noise.
 */
export type BadgeTone = 'neutral' | 'accent' | 'info' | 'success' | 'warning' | 'urgent' | 'danger'

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'border-transparent bg-surface-2 text-muted-foreground dark:bg-surface-3',
  accent: 'border-transparent bg-primary/12 text-accent-ink',
  info: 'border-transparent bg-blue-500/10 text-blue-700 dark:bg-blue-500/14 dark:text-blue-300',
  success: 'border-transparent bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/14 dark:text-emerald-300',
  warning: 'border-transparent bg-amber-500/10 text-amber-700 dark:bg-amber-500/14 dark:text-amber-300',
  urgent: 'border-transparent bg-orange-500/10 text-orange-600 dark:bg-orange-500/14 dark:text-orange-300',
  danger: 'border-transparent bg-destructive/10 text-destructive dark:bg-destructive/14',
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
  size?: 'sm' | 'md'
}

export function Badge({ tone = 'neutral', size = 'sm', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-1 rounded-full border font-medium leading-none tabular-nums',
        size === 'sm' ? 'min-h-5 px-2 text-caption' : 'min-h-6 px-2.5 text-label',
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
