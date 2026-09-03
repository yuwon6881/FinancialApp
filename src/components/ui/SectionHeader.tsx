import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface SectionHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title: ReactNode
  titleId?: string
  description?: ReactNode
  meta?: ReactNode
  actions?: ReactNode
}

export function SectionHeader({ title, titleId, description, meta, actions, className, ...props }: SectionHeaderProps) {
  return (
    <div className={cn('flex min-w-0 flex-wrap items-start justify-between gap-3', className)} {...props}>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <h2 id={titleId} className="min-w-0 text-base font-bold text-foreground">{title}</h2>
          {meta}
        </div>
        {description && <div className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
