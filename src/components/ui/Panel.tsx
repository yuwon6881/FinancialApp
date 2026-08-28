import type { ComponentPropsWithoutRef, ElementType } from 'react'
import { cn } from '../../lib/utils'

export const panelClass = 'app-panel rounded-2xl border border-border/60 bg-card/92'

const paddingClasses = {
  none: '',
  compact: 'p-4',
  default: 'p-4 sm:p-5',
  spacious: 'p-4 sm:p-6',
} as const

type PanelProps<T extends ElementType = 'div'> = {
  as?: T
  padding?: keyof typeof paddingClasses
  className?: string
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'className'>

export function Panel<T extends ElementType = 'div'>({
  as,
  padding = 'default',
  className,
  ...props
}: PanelProps<T>) {
  const Component = as ?? 'div'
  return <Component className={cn(panelClass, paddingClasses[padding], className)} {...props} />
}
