import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface PageHeaderProps {
  title: ReactNode
  description?: ReactNode
  leading?: ReactNode
  titleActions?: ReactNode
  actions?: ReactNode
  /** Extra classes for the actions row, e.g. to drop it on phones when every action lives elsewhere there. */
  actionsClassName?: string
  children?: ReactNode
  className?: string
  titleId?: string
}

/**
 * The page title, set directly on the canvas rather than inside a card. Large type and space carry
 * the hierarchy; the actions sit on the same baseline on wide screens and wrap beneath the title on
 * narrow ones.
 */
export function PageHeader({
  title,
  description,
  leading,
  titleActions,
  actions,
  actionsClassName,
  children,
  className,
  titleId,
}: PageHeaderProps) {
  return (
    <header className={cn('relative z-30 pt-1', className)}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {leading && <div className="shrink-0">{leading}</div>}
          {/* Spans the row on narrow screens so title actions can take the trailing edge. */}
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-2">
              <h1 id={titleId} className="min-w-0 flex-[1_1_auto] text-title text-foreground sm:text-display">{title}</h1>
              {titleActions && <div data-page-title-actions className="flex shrink-0 flex-wrap items-center gap-2">{titleActions}</div>}
            </div>
            {description && <div className="mt-1.5 max-w-2xl text-body text-muted-foreground line-clamp-2 sm:line-clamp-none">{description}</div>}
          </div>
        </div>
        {actions && <div className={cn('flex min-w-0 shrink-0 flex-wrap items-center gap-2 lg:justify-end', actionsClassName)}>{actions}</div>}
      </div>
      {children}
    </header>
  )
}
