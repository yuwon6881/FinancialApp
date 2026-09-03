import React from 'react'
import { m, useReducedMotion } from 'framer-motion'
import { AlertTriangle, ChevronRight, Gauge } from 'lucide-react'
import type { CategoryLimitProgress } from '../../types'
import { Button } from '../ui/Button'

interface CategoryWatchExceptionCardProps {
  items: CategoryLimitProgress[]
  formatSensitive: (value: number) => React.ReactNode
  onOpenCategoryLimits: (category: string) => void
}

/**
 * Today only speaks up about category budgets when one actually needs attention.
 * The full breakdown of every tracked category lives in Reports; showing it here
 * as well made the daily view report on categories that were entirely fine.
 */
export function CategoryWatchExceptionCard({
  items,
  formatSensitive,
  onOpenCategoryLimits,
}: CategoryWatchExceptionCardProps) {
  const reduceMotion = useReducedMotion()

  const exceptions = items.filter(item => item.status !== 'OnTrack')
  if (exceptions.length === 0) return null

  const exceeded = exceptions.filter(item => item.status === 'Exceeded')
  // Lead with the worst case: over budget first, then whichever is closest to its limit.
  const worst = [...exceptions].sort((a, b) => {
    if ((a.status === 'Exceeded') !== (b.status === 'Exceeded')) return a.status === 'Exceeded' ? -1 : 1
    return b.percentUsed - a.percentUsed
  })[0]
  const anyExceeded = exceeded.length > 0
  const others = exceptions.length - 1

  return (
    <m.section
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      aria-labelledby="category-watch-exception"
      className={`app-panel rounded-2xl border p-4 sm:p-5 shadow-xs ${anyExceeded ? 'border-orange-500/30 bg-card/92 text-card-foreground' : 'border-amber-500/30 bg-card/92 text-card-foreground'}`}
    >
      <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl border ${anyExceeded ? 'border-orange-500/25 bg-orange-500/15 text-orange-600 dark:text-orange-400' : 'border-amber-500/25 bg-amber-500/15 text-amber-600 dark:text-amber-400'}`}>
            {anyExceeded ? <AlertTriangle className="size-5" /> : <Gauge className="size-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <h3 id="category-watch-exception" className={`text-sm font-bold ${anyExceeded ? 'text-orange-700 dark:text-orange-300' : 'text-amber-700 dark:text-amber-300'}`}>
              {anyExceeded
                ? `${worst.category} is over its budget`
                : `${worst.category} is close to its budget`}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {worst.status === 'Exceeded' ? (
                <>Spent {formatSensitive(worst.spent)} of {formatSensitive(worst.limit)} — {formatSensitive(Math.abs(worst.remaining))} over.</>
              ) : (
                <>Spent {formatSensitive(worst.spent)} of {formatSensitive(worst.limit)}; at this pace, finish near {formatSensitive(worst.projectedSpend)}.</>
              )}
              {others > 0 && ` ${others} more need a look.`}
            </p>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onOpenCategoryLimits(worst.category)}
          className={`w-full justify-center sm:w-auto shrink-0 ${anyExceeded ? 'border-orange-500/30 bg-card/60 text-orange-700 hover:bg-orange-500/10 dark:text-orange-300' : 'border-amber-500/30 bg-card/60 text-amber-700 hover:bg-amber-500/10 dark:text-amber-300'}`}
        >
          See categories
          <ChevronRight className="size-3.5 ml-1" />
        </Button>
      </div>
    </m.section>
  )
}
