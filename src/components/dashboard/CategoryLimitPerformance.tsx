import React from 'react'
import { ArrowRight, ChevronDown, SlidersHorizontal } from 'lucide-react'
import type { CategoryLimitProgress, AppTab } from '../../types'
import type { AppNavigationOptions } from '../../lib/appLocation'
import { InfoHint } from '../ui/InfoHint'
import { getCategoryLimitCardId, type NavigateToLedgerOptions } from './types'
import { cn } from '../../lib/utils'
import { Button } from '../ui/Button'
import { CategoryIcon } from '../ui/CategoryIcon'
import { InteractiveCard } from '../ui/InteractiveCard'
import { SegmentedMeter } from '../ui/SegmentedMeter'

interface CategoryLimitPerformanceProps {
  items: CategoryLimitProgress[]
  formatSensitive: (value: number) => React.ReactNode
  onNavigateToLedger?: (options: NavigateToLedgerOptions) => void
  onNavigate?: (tab: AppTab, options?: AppNavigationOptions) => void
  /** A category arrived at from another tab: the list opens in full so its row can be revealed. */
  revealCategory?: string | null
}

/** Rows a compact list shows before the rest wait behind "Show all". */
const COMPACT_ROWS = 4

const statusRank = { Exceeded: 0, Watch: 1, OnTrack: 2 } as const

const STATUS = {
  Exceeded: { label: 'Over', text: 'text-red-600 dark:text-red-400', fill: 'var(--color-red-500)' },
  Watch: { label: 'Watch', text: 'text-amber-700 dark:text-amber-300', fill: 'var(--color-amber-500)' },
  OnTrack: { label: 'On track', text: 'text-muted-foreground', fill: 'color-mix(in srgb, var(--foreground) 40%, transparent)' },
} as const

/**
 * Spending against each category limit, worst first, as a compact list: the category, what it has
 * spent of its limit, one bar with a marker where the cycle is heading, and a quiet status word.
 * Only Watch and Over carry colour; a category on track draws a quiet ink bar and stays out of the way.
 */
export function CategoryLimitPerformance({
  items,
  formatSensitive,
  onNavigateToLedger,
  onNavigate,
  revealCategory = null,
}: CategoryLimitPerformanceProps) {
  const [showAll, setShowAll] = React.useState(Boolean(revealCategory))
  React.useEffect(() => {
    if (revealCategory) setShowAll(true)
  }, [revealCategory])

  if (items.length === 0) {
    return (
      <div className="min-w-0">
        <h3 id="report-category-limits-heading" className="text-subsection text-foreground">Category limits</h3>
        <div className="mt-3 flex flex-col items-start gap-3 rounded-control bg-surface-2/70 p-4 @sm:flex-row @sm:items-center">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-card text-muted-foreground">
            <SlidersHorizontal className="size-4.5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-label text-foreground">No category spending guides configured</p>
            <p className="mt-0.5 text-caption text-muted-foreground">Set category limits to track spending pace and warnings.</p>
          </div>
          {onNavigate && (
            <Button variant="secondary" size="sm" onClick={() => onNavigate('budget', { search: { section: 'categories' } })}>
              Set Up Limits
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
    )
  }

  const sorted = [...items].sort((a, b) => {
    const statusDelta = statusRank[a.status] - statusRank[b.status]
    if (statusDelta !== 0) return statusDelta
    return (b.limit > 0 ? b.projectedSpend / b.limit : 0) - (a.limit > 0 ? a.projectedSpend / a.limit : 0)
  })
  const exceptionCount = items.filter(item => item.status !== 'OnTrack').length
  // A touch layout keeps every exception and enough on-track rows to read as a list; the rest are
  // one tap away. The expanded tier has the room and shows everything.
  const compactCount = Math.max(COMPACT_ROWS, exceptionCount)
  const hiddenCount = showAll ? 0 : Math.max(0, sorted.length - compactCount)
  const anyProjectionMarker = items.some(item =>
    item.status !== 'Exceeded' && item.limit > 0 && item.projectedSpend / item.limit > Math.max(0, item.percentUsed))

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
        <h3 id="report-category-limits-heading" className="flex items-center gap-1 whitespace-nowrap text-subsection text-foreground">
          Category limits
          <InfoHint
            inline
            label="category limit performance"
            text="Bars show spending against your limit; marker projects the cycle-end total."
          />
        </h3>
        <p className={cn('text-caption tabular-nums', exceptionCount > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground')}>
          {exceptionCount > 0 ? `${exceptionCount} of ${items.length} need attention` : 'All on track'}
        </p>
      </div>

      <ul className="-mx-2 mt-2 grid grid-cols-1 @xl:grid-cols-2 @xl:gap-x-4">
        {sorted.map((item, index) => {
          const status = STATUS[item.status]
          const exceeded = item.status === 'Exceeded'
          const watch = item.status === 'Watch'
          const usedPct = Math.max(0, item.percentUsed * 100)
          const projectedPct = item.limit > 0 ? Math.max(0, item.projectedSpend / item.limit * 100) : 0
          const showMarker = !exceeded && projectedPct > usedPct
          return (
            <li key={item.category} className={cn('min-w-0', hiddenCount > 0 && index >= compactCount && 'hidden lg:block')}>
              <InteractiveCard
                surface="plain"
                id={getCategoryLimitCardId(item.category)}
                onClick={() => onNavigateToLedger?.({ category: item.category })}
                disabled={!onNavigateToLedger}
                className={cn(
                  'rounded-control px-2 py-2.5 hover:bg-surface-2 focus-visible:outline-offset-[-2px]',
                  // A row with nowhere to navigate is inert, not unavailable: it keeps its status
                  // colour rather than fading out under the primitive's disabled treatment.
                  !onNavigateToLedger && 'disabled:cursor-default disabled:opacity-100',
                )}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <CategoryIcon category={item.category} size="sm" />
                  <span className="min-w-0 flex-1">
                    {/* Wraps the figure under the name when a narrow row cannot hold both. */}
                    <span className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3">
                      <span className="min-w-0 max-w-full truncate text-body font-medium text-foreground">{item.category}</span>
                      <span className="whitespace-nowrap text-label tabular-nums text-foreground">
                        {formatSensitive(item.spent)}
                        <span className="text-muted-foreground"> of {formatSensitive(item.limit)}</span>
                      </span>
                    </span>
                    <SegmentedMeter
                      className="mt-2"
                      size="sm"
                      total={100}
                      label={`${item.category}: ${Math.round(usedPct)}% of limit used`}
                      segments={[{ label: 'Spent', value: Math.min(100, usedPct), color: status.fill }]}
                      markerPercent={showMarker ? Math.min(100, projectedPct) : undefined}
                      markerLabel="Where this bar is heading by the end of the cycle at the current pace"
                    />
                    <span className="mt-1.5 flex min-w-0 items-baseline justify-between gap-3 text-caption">
                      <span className="min-w-0 truncate tabular-nums text-muted-foreground">
                        {exceeded
                          ? <span className="font-medium text-red-600 dark:text-red-400">{formatSensitive(Math.abs(item.remaining))} over</span>
                          : <>{formatSensitive(item.remaining)} left</>}
                        {watch && <> · projects {formatSensitive(item.projectedSpend)}</>}
                        {!watch && item.pendingCommitted > 0 && <> · {formatSensitive(item.pendingCommitted)} committed</>}
                      </span>
                      <span className={cn('shrink-0 font-medium', status.text)}>{status.label}</span>
                    </span>
                  </span>
                </span>
              </InteractiveCard>
            </li>
          )
        })}
      </ul>

      {hiddenCount > 0 && (
        <Button variant="tertiary" size="sm" onClick={() => setShowAll(true)} className="-ml-2 mt-1 lg:hidden">
          Show {hiddenCount} more on track
          <ChevronDown className="size-3.5" aria-hidden="true" />
        </Button>
      )}

      {anyProjectionMarker && (
        <p className="mt-2 flex items-center gap-2 text-caption text-muted-foreground">
          <span aria-hidden="true" className="inline-block h-3 w-0.5 rounded-full bg-foreground/70" />
          Projected end-of-cycle total at the current pace.
        </p>
      )}
    </div>
  )
}
