import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface ListRowProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  leading?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  trailing?: ReactNode
  /** Secondary trailing line under `trailing`, e.g. a date under an amount. */
  trailingSubtitle?: ReactNode
}

/**
 * The grouped-list row: a leading mark, a title over a quiet subtitle, and a trailing figure. The
 * anatomy every list in the app converges on -- transactions, bills, accounts, settings -- so a row
 * reads the same wherever it appears. Layout only; interaction comes from whatever wraps it.
 */
export function ListRow({ leading, title, subtitle, trailing, trailingSubtitle, className, ...props }: ListRowProps) {
  return (
    <div className={cn('flex min-h-14 min-w-0 items-center gap-3 py-2.5', className)} {...props}>
      {leading && <div className="shrink-0">{leading}</div>}
      <div className="min-w-0 flex-1">
        <div className="truncate text-body font-medium text-foreground">{title}</div>
        {subtitle && <div className="mt-0.5 truncate text-caption text-muted-foreground">{subtitle}</div>}
      </div>
      {(trailing || trailingSubtitle) && (
        <div className="shrink-0 text-right">
          {trailing && <div className="text-body font-medium text-foreground tabular-nums">{trailing}</div>}
          {trailingSubtitle && <div className="mt-0.5 text-caption text-muted-foreground">{trailingSubtitle}</div>}
        </div>
      )}
    </div>
  )
}
