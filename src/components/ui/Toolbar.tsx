import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

export function Toolbar({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="toolbar"
      className={cn('flex min-h-11 min-w-0 flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-card/85 p-2 sm:p-3', className)}
      {...props}
    />
  )
}
