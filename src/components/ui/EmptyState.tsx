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
   * because a phone shares the screen with the fixed bottom navigation -- at desktop sizing the
   * block grew tall enough to hide its own call to action behind it.
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
      variant="subtle"
      padding="none"
      role="status"
      className={cn(
        'text-center',
        compact ? 'rounded-control px-4 py-5' : 'px-5 py-8 sm:px-8 sm:py-12',
        className,
      )}
      {...props}
    >
      {icon && !compact && (
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-card text-muted-foreground shadow-xs ring-1 ring-border/70 dark:bg-surface-3 dark:shadow-none sm:size-14">
          {icon}
        </div>
      )}
      {compact
        ? <p className="text-label text-muted-foreground">{title}</p>
        : <h2 className="mt-4 text-section text-foreground">{title}</h2>}
      {description && (
        <div className={cn(
          'mx-auto text-muted-foreground',
          compact ? 'mt-1 text-caption' : 'mt-1.5 max-w-sm text-body sm:max-w-md',
        )}>
          {description}
        </div>
      )}
      {actions && (
        <div className={cn(
          'mx-auto flex justify-center gap-2',
          compact ? 'mt-3 flex-wrap' : 'mt-5 max-w-md flex-col-reverse sm:mt-6 sm:flex-row',
        )}>
          {actions}
        </div>
      )}
    </Panel>
  )
}
