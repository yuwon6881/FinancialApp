import { Button } from '../ui/Button'
import React from 'react'
import { AlertTriangle, ArrowRight, CheckCircle2, Gauge, SlidersHorizontal, TrendingUp } from 'lucide-react'
import type { CategoryLimitProgress, AppTab } from '../../types'
import { getCategoryBadgeClass } from '../../lib/categoryColors'
import { InfoHint } from '../ui/InfoHint'
import { getCategoryLimitCardId, type NavigateToLedgerOptions } from './types'
import { cn } from '../../lib/utils'
import { panelClass } from '../ui/panelStyles'

interface CategoryLimitPerformanceProps {
  items: CategoryLimitProgress[]
  formatSensitive: (value: number) => React.ReactNode
  onNavigateToLedger?: (options: NavigateToLedgerOptions) => void
  onNavigate?: (tab: AppTab) => void
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
            <Gauge className="size-4 text-blue-500" /> Category limit performance
          </h3>
        </div>
        <div className="mt-4 flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/15 px-6 py-7 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex flex-col items-center gap-3.5 sm:flex-row sm:gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-500 shadow-sm">
              <SlidersHorizontal className="size-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-foreground">No category spending guides configured</h4>
              <p className="max-w-md text-xs text-muted-foreground leading-relaxed">
                Set category limits to track spending pace and warnings.
              </p>
            </div>
          </div>
          {onNavigate && (
            <Button variant="tertiary"
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  const url = new URL(window.location.href)
                  url.searchParams.set('section', 'category-limits')
                  window.history.replaceState(null, '', url.toString())
                }
                onNavigate('settings')
              }}
              className="mt-4 inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3.5 py-2 text-xs font-bold text-blue-500 transition hover:border-blue-500/50 hover:bg-blue-500/20 cursor-pointer sm:mt-0"
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
            <Gauge className="size-4 text-blue-500" /> Category limit performance
            <InfoHint
              label="category limit performance"
              text="Bars show spending against your limit; marker projects the cycle-end total."
            />
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {exceptionCount > 0
              ? `${exceptionCount} of ${items.length} tracked categor${items.length === 1 ? 'y needs' : 'ies need'} attention.`
              : `All ${items.length} tracked categor${items.length === 1 ? 'y is' : 'ies are'} currently on plan.`}
          </p>
        </div>
        {exceptionCount === 0 ? (
          <CheckCircle2 className="size-5 shrink-0 text-emerald-500" />
        ) : (
          <AlertTriangle className="size-5 shrink-0 text-amber-500" />
        )}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 min-[1400px]:grid-cols-3">
        {sorted.map(item => {
          const exceeded = item.status === 'Exceeded'
          const watch = item.status === 'Watch'
          const usedPct = Math.max(0, item.percentUsed * 100)
          const projectedPct = item.limit > 0 ? Math.max(0, item.projectedSpend / item.limit * 100) : 0
          return (
            <Button variant="tertiary"
              key={item.category}
              id={getCategoryLimitCardId(item.category)}
              type="button"
              onClick={() => onNavigateToLedger?.({ category: item.category })}
              disabled={!onNavigateToLedger}
              className={`rounded-xl border p-3 text-left transition ${onNavigateToLedger ? 'interactive-card cursor-pointer' : 'cursor-default'} ${
                exceeded
                  ? 'border-orange-500/30 bg-orange-500/5'
                  : watch
                    ? 'border-amber-500/30 bg-amber-500/5'
                    : 'border-border/50 bg-muted/20'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`min-w-0 truncate rounded-md border px-2 py-0.5 text-xs font-semibold ${getCategoryBadgeClass(item.category)}`}>
                  {item.category}
                </span>
                <span className={`shrink-0 text-eyebrow uppercase ${exceeded ? 'text-orange-500' : watch ? 'text-amber-500' : 'text-emerald-500'}`}>
                  {exceeded ? 'Exceeded' : watch ? 'Watch' : 'On track'}
                </span>
              </div>

              <div className="mt-3 flex items-baseline justify-between gap-2">
                <span className="text-sm font-extrabold text-foreground tabular-nums">{formatSensitive(item.spent)}</span>
                <span className="text-xs font-medium text-muted-foreground tabular-nums">of {formatSensitive(item.limit)}</span>
              </div>
              <div className="relative mt-2.5 h-2.5 overflow-hidden rounded-full bg-muted/80">
                <div
                  className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${exceeded ? 'bg-orange-500' : watch ? 'bg-amber-500' : 'bg-blue-500'}`}
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
                <span className={exceeded ? 'font-bold text-orange-500 tabular-nums' : 'text-muted-foreground tabular-nums'}>
                  {exceeded ? <>{formatSensitive(Math.abs(item.remaining))} over</> : <>{formatSensitive(item.remaining)} left</>}
                </span>
                {watch && (
                  <span className="flex items-center gap-1 font-semibold text-amber-500 tabular-nums">
                    <TrendingUp className="size-3.5" /> projects {formatSensitive(item.projectedSpend)}
                  </span>
                )}
                {!watch && item.pendingCommitted > 0 && (
                  <span className="text-muted-foreground tabular-nums">{formatSensitive(item.pendingCommitted)} committed</span>
                )}
              </div>
            </Button>
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
