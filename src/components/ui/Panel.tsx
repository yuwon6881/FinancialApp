import type { ComponentPropsWithoutRef, ElementType } from 'react'
import { cn } from '../../lib/utils'

export const panelClass = 'app-panel rounded-2xl border border-border/60 bg-card/92'

const variantClasses = {
  default: panelClass,
  subtle: 'rounded-2xl border border-border/50 bg-muted/20',
  dashed: 'rounded-2xl border border-dashed border-border/70 bg-card/75',
} as const

const paddingClasses = {
  none: '',
  compact: 'p-4',
  default: 'p-4 sm:p-5',
  spacious: 'p-4 sm:p-6',
} as const

type PanelProps<T extends ElementType = 'div'> = {
  as?: T
  padding?: keyof typeof paddingClasses
  variant?: keyof typeof variantClasses
  className?: string
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'className'>

export function Panel<T extends ElementType = 'div'>({
  as,
  padding = 'default',
  variant = 'default',
  className,
  ...props
}: PanelProps<T>) {
  const Component = as ?? 'div'
  return <Component className={cn(variantClasses[variant], paddingClasses[padding], className)} {...props} />
}
