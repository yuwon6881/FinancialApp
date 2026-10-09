import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface StatTileProps {
  label: ReactNode
  value: ReactNode
  /** One quiet line under the figure: context, a change, a unit. */
  hint?: ReactNode
  /** Optional leading mark, e.g. a `CategoryIcon` or a bucket dot. */
  icon?: ReactNode
  /** Optional trailing visual, e.g. a `Sparkline` or `ProgressRing`. */
  aside?: ReactNode
  className?: string
}

/**
 * A labelled figure. The label is small and quiet, the value is the hero, the hint is one line of
 * context. Carries no surface of its own: wrap it in a `Panel`, an `InteractiveCard` or a grid cell
 * that supplies one, so the same anatomy serves a dashboard tile and a summary strip.
 */
export function StatTile({ label, value, hint, icon, aside, className }: StatTileProps) {
  return (
    <div className={cn('flex min-w-0 items-start gap-3', className)}>
      {icon && <div className="shrink-0">{icon}</div>}
      <div className="min-w-0 flex-1">
        <div className="truncate text-label text-muted-foreground">{label}</div>
        <div className="mt-1 min-w-0 truncate text-section text-foreground tabular-nums">{value}</div>
        {hint && <div className="mt-1 text-caption text-muted-foreground">{hint}</div>}
      </div>
      {aside && <div className="shrink-0 self-center">{aside}</div>}
    </div>
  )
}
