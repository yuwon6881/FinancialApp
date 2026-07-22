import React from 'react'
import { AlertTriangle, CheckCircle2, Gauge, TrendingUp } from 'lucide-react'
import type { CategoryLimitProgress } from '../../types'
import { getCategoryBadgeClass } from '../../lib/categoryColors'
import type { NavigateToLedgerOptions } from './types'

interface CategoryLimitPerformanceProps {
  items: CategoryLimitProgress[]
  formatSensitive: (value: number) => React.ReactNode
  onNavigateToLedger?: (options: NavigateToLedgerOptions) => void
  compact?: boolean
}

const statusRank = { Exceeded: 0, Watch: 1, OnTrack: 2 } as const

export function CategoryLimitPerformance({
  items,
  formatSensitive,
  onNavigateToLedger,
  compact = false,
}: CategoryLimitPerformanceProps) {
  if (items.length === 0) return null

  const sorted = [...items].sort((a, b) => {
    const statusDelta = statusRank[a.status] - statusRank[b.status]
    if (statusDelta !== 0) return statusDelta
    return (b.limit > 0 ? b.projectedSpend / b.limit : 0) - (a.limit > 0 ? a.projectedSpend / a.limit : 0)
  })
  const visibleItems = compact ? sorted.slice(0, 3) : sorted
  const exceptionCount = items.filter(item => item.status !== 'OnTrack').length

  return (
    <section className="app-panel rounded-2xl border border-border/60 bg-card/92 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-bold text-foreground">
            <Gauge className="size-4 text-blue-500" /> {compact ? 'Category watch' : 'Category limit performance'}
          </h3>
          <p className="mt-1 text-[11px] text-muted-foreground">
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

      <div className={`mt-4 grid gap-3 ${compact ? 'md:grid-cols-3' : 'sm:grid-cols-2 xl:grid-cols-3'}`}>
        {visibleItems.map(item => {
          const exceeded = item.status === 'Exceeded'
          const watch = item.status === 'Watch'
          const usedPct = Math.max(0, item.percentUsed * 100)
          const projectedPct = item.limit > 0 ? Math.max(0, item.projectedSpend / item.limit * 100) : 0
          return (
            <button
              key={item.category}
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
                <span className={`min-w-0 truncate rounded border px-2 py-0.5 text-[10px] font-semibold ${getCategoryBadgeClass(item.category)}`}>
                  {item.category}
                </span>
                <span className={`shrink-0 text-[9px] font-bold uppercase tracking-wide ${exceeded ? 'text-orange-500' : watch ? 'text-amber-500' : 'text-emerald-500'}`}>
                  {exceeded ? 'Exceeded' : watch ? 'Watch' : 'On track'}
                </span>
              </div>

              <div className="mt-3 flex items-baseline justify-between gap-2">
                <span className="text-sm font-extrabold text-foreground">{formatSensitive(item.spent)}</span>
                <span className="text-[10px] font-semibold text-muted-foreground">of {formatSensitive(item.limit)}</span>
              </div>
              <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={`absolute inset-y-0 left-0 rounded-full ${exceeded ? 'bg-orange-500' : watch ? 'bg-amber-500' : 'bg-blue-500'}`}
                  style={{ width: `${Math.min(100, usedPct)}%` }}
                />
                {!exceeded && projectedPct > usedPct && (
                  <div
                    className="absolute inset-y-0 border-r-2 border-amber-500/90"
                    style={{ left: `${Math.min(100, projectedPct)}%` }}
                    title="Projected cycle position"
                  />
                )}
              </div>

              <div className="mt-2 flex items-center justify-between gap-2 text-[10px]">
                <span className={exceeded ? 'font-bold text-orange-500' : 'text-muted-foreground'}>
                  {exceeded ? <>{formatSensitive(Math.abs(item.remaining))} over</> : <>{formatSensitive(item.remaining)} left</>}
                </span>
                {watch && (
                  <span className="flex items-center gap-1 font-semibold text-amber-500">
                    <TrendingUp className="size-3" /> projects {formatSensitive(item.projectedSpend)}
                  </span>
                )}
                {!watch && item.pendingCommitted > 0 && (
                  <span className="text-muted-foreground">{formatSensitive(item.pendingCommitted)} committed</span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {compact && items.length > visibleItems.length && (
        <p className="mt-3 text-right text-[10px] font-semibold text-muted-foreground">
          {items.length - visibleItems.length} more tracked in Reports
        </p>
      )}
    </section>
  )
}
