import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { Panel } from './Panel'

interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  /**
   * `default` is the section-level empty state: an icon, a heading, an explanation and a call to
   * action, filling the space a populated section would have taken. It steps down at compact,
   * because a phone shares the screen with the fixed bottom navigation and the floating action —
   * at desktop sizing the block grew tall enough to hide its own call to action behind them.
   *
   * `compact` is the one-line note that sits inside an already-titled panel -- "No accounts added
   * for Essentials yet." with a small action beside it. It deliberately renders the title as a
   * paragraph rather than a heading, because a note inside a section is not a section heading and
   * promoting it would put entries into the document outline that do not belong there.
   */
  density?: 'default' | 'compact'
}

export function EmptyState({
  icon,
  title,
  description,
  actions,
  density = 'default',
  className,
  ...props
}: EmptyStateProps) {
  const compact = density === 'compact'
  return (
    <Panel
      variant="dashed"
      padding="none"
      role="status"
      className={cn(
        'text-center',
        // A nested note is a control-scale surface rather than a page-level panel, so it keeps the
        // smaller radius; the section-level state uses the panel radius it inherits.
        compact ? 'rounded-control bg-muted/15 px-4 py-6' : 'p-4 sm:p-6',
        className,
      )}
      {...props}
    >
      {icon && !compact && (
        <div className="mx-auto grid size-11 place-items-center rounded-2xl border border-border/60 bg-muted/35 text-muted-foreground sm:size-12">
          {icon}
        </div>
      )}
      {compact
        ? <p className="text-xs text-muted-foreground">{title}</p>
        : <h2 className="mt-3 text-sm font-bold text-foreground sm:mt-4 sm:text-base">{title}</h2>}
      {description && (
        <div className={cn(
          'mx-auto leading-relaxed text-muted-foreground',
          compact ? 'mt-1 text-xs' : 'mt-1 max-w-sm text-xs sm:max-w-md sm:text-sm',
        )}>
          {description}
        </div>
      )}
      {actions && (
        <div className={cn(
          'mx-auto flex justify-center gap-2',
          compact ? 'mt-3 flex-wrap' : 'mt-4 max-w-md flex-col-reverse sm:mt-5 sm:flex-row',
        )}>
          {actions}
        </div>
      )}
    </Panel>
  )
}
