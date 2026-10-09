import { Button } from '../ui/Button'
import React from 'react'
import { AlertTriangle, ArrowRight, CheckCircle2, Gauge, SlidersHorizontal, TrendingUp } from 'lucide-react'
import type { CategoryLimitProgress, AppTab } from '../../types'
import type { AppNavigationOptions } from '../../lib/appLocation'
import { getCategoryBadgeClass } from '../../lib/categoryColors'
import { InfoHint } from '../ui/InfoHint'
import { getCategoryLimitCardId, type NavigateToLedgerOptions } from './types'
import { cn } from '../../lib/utils'
import { panelClass } from '../ui/panelStyles'
import { InteractiveCard } from '../ui/InteractiveCard'

interface CategoryLimitPerformanceProps {
  items: CategoryLimitProgress[]
  formatSensitive: (value: number) => React.ReactNode
  onNavigateToLedger?: (options: NavigateToLedgerOptions) => void
  onNavigate?: (tab: AppTab, options?: AppNavigationOptions) => void
}

const statusRank = { Exceeded: 0, Watch: 1, OnTrack: 2 } as const

export function CategoryLimitPerformance({
  items,
  formatSensitive,
  onNavigateToLedger,
  onNavigate,
}: CategoryLimitPerformanceProps) {
  if (items.length === 0) {
    return (
      <section className={cn(panelClass, 'flex h-full flex-col justify-between p-5')}>
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-1.5 text-subsection text-foreground">
            <Gauge className="size-4 text-muted-foreground" /> Category limit performance
          </h3>
        </div>
        <div className="mt-4 flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/15 px-6 py-7 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex flex-col items-center gap-3.5 sm:flex-row sm:gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted-foreground">
              <SlidersHorizontal className="size-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-caption font-semibold text-foreground">No category spending guides configured</h4>
              <p className="max-w-md text-xs text-muted-foreground leading-relaxed">
                Set category limits to track spending pace and warnings.
              </p>
            </div>
          </div>
          {onNavigate && (
            <Button variant="tertiary"
              type="button"
              onClick={() => onNavigate('budget', { search: { section: 'categories' } })}
              className="mt-4 inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-border/70 px-4 text-label font-medium text-foreground transition hover:bg-surface-2 sm:mt-0"
            >
              <span>Set Up Limits</span>
              <ArrowRight className="size-3.5" />
            </Button>
          )}
        </div>
      </section>
    )
  }

  const sorted = [...items].sort((a, b) => {
    const statusDelta = statusRank[a.status] - statusRank[b.status]
    if (statusDelta !== 0) return statusDelta
    return (b.limit > 0 ? b.projectedSpend / b.limit : 0) - (a.limit > 0 ? a.projectedSpend / a.limit : 0)
  })
  const exceptionCount = items.filter(item => item.status !== 'OnTrack').length
  const anyProjectionMarker = items.some(item =>
    item.status !== 'Exceeded' && item.limit > 0 && item.projectedSpend / item.limit > Math.max(0, item.percentUsed))

  return (
    <section className={cn(panelClass, 'h-full p-5')}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-1.5 text-subsection text-foreground">
            <Gauge className="size-4 text-muted-foreground" /> Category limit performance
            <InfoHint
              label="category limit performance"
              text="Bars show spending against your limit; marker projects the cycle-end total."
            />
          </h3>
          {exceptionCount > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">{exceptionCount} of {items.length} need attention</p>
          )}
        </div>
        {exceptionCount === 0 ? (
          <CheckCircle2 className="size-5 shrink-0 text-emerald-500" />
        ) : (
          <AlertTriangle className="size-5 shrink-0 text-amber-600 dark:text-amber-400" />
        )}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 min-[1400px]:grid-cols-3">
        {sorted.map(item => {
          const exceeded = item.status === 'Exceeded'
          const watch = item.status === 'Watch'
          const usedPct = Math.max(0, item.percentUsed * 100)
          const projectedPct = item.limit > 0 ? Math.max(0, item.projectedSpend / item.limit * 100) : 0
          return (
            <InteractiveCard
              key={item.category}
              surface="plain"
              id={getCategoryLimitCardId(item.category)}
              onClick={() => onNavigateToLedger?.({ category: item.category })}
              disabled={!onNavigateToLedger}
              className={cn(
                'rounded-xl border p-3',
                // A card with nowhere to navigate is inert, not unavailable: it must keep its
                // status colour rather than fade out under the primitive's disabled treatment.
                !onNavigateToLedger && 'disabled:cursor-default disabled:opacity-100',
                exceeded
                  ? 'border-red-500/35'
                  : watch
                    ? 'border-amber-500/35'
                    : 'border-border/50 bg-muted/20',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`min-w-0 truncate rounded-md border px-2 py-0.5 text-xs font-semibold ${getCategoryBadgeClass(item.category)}`}>
                  {item.category}
                </span>
                <span className={`shrink-0 text-label font-medium ${exceeded ? 'text-red-600 dark:text-red-400' : watch ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {exceeded ? 'Exceeded' : watch ? 'Watch' : 'On track'}
                </span>
              </div>

              <div className="mt-3 flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-foreground tabular-nums">{formatSensitive(item.spent)}</span>
                <span className="text-xs font-medium text-muted-foreground tabular-nums">of {formatSensitive(item.limit)}</span>
              </div>
              <div className="relative mt-2.5 h-2.5 overflow-hidden rounded-full bg-muted/80">
                <div
                  className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${exceeded ? 'bg-red-500' : watch ? 'bg-amber-500' : 'bg-primary'}`}
                  style={{ width: `${Math.min(100, usedPct)}%` }}
                />
                {!exceeded && projectedPct > usedPct && (
                  <div
                    className="absolute inset-y-0 border-r-2 border-amber-500/90"
                    style={{ left: `${Math.min(100, projectedPct)}%` }}
                    title="Where this bar is heading by the end of the cycle at the current pace"
                  />
                )}
              </div>

              <div className="mt-2.5 flex items-center justify-between gap-2 text-xs font-medium">
                <span className={exceeded ? 'font-semibold text-red-600 dark:text-red-400 tabular-nums' : 'text-muted-foreground tabular-nums'}>
                  {exceeded ? <>{formatSensitive(Math.abs(item.remaining))} over</> : <>{formatSensitive(item.remaining)} left</>}
                </span>
                {watch && (
                  <span className="flex items-center gap-1 font-medium text-amber-700 dark:text-amber-300 tabular-nums">
                    <TrendingUp className="size-3.5" /> projects {formatSensitive(item.projectedSpend)}
                  </span>
                )}
                {!watch && item.pendingCommitted > 0 && (
                  <span className="text-muted-foreground tabular-nums">{formatSensitive(item.pendingCommitted)} committed</span>
                )}
              </div>
            </InteractiveCard>
          )
        })}
      </div>

      {anyProjectionMarker && (
        <p className="mt-3.5 flex items-center gap-2 text-xs text-muted-foreground">
          <span aria-hidden className="inline-block h-3 w-0 border-r-2 border-amber-500/90" />
          Projected end-of-cycle total at the current pace.
        </p>
      )}
    </section>
  )
}
