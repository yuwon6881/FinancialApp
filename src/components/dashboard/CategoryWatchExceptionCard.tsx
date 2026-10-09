import React from 'react'
import { AlertTriangle, ChevronRight, Gauge } from 'lucide-react'
import type { CategoryLimitProgress } from '../../types'
import { Button } from '../ui/Button'
import { Meter } from '../ui/Meter'
import { NoticeCard } from '../ui/NoticeCard'

interface CategoryWatchExceptionCardProps {
  items: CategoryLimitProgress[]
  formatSensitive: (value: number) => React.ReactNode
  onOpenCategoryLimits: (category: string) => void
  isMasked?: boolean
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
  isMasked = false,
}: CategoryWatchExceptionCardProps) {
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
    <NoticeCard
      tone={anyExceeded ? 'urgent' : 'attention'}
      icon={anyExceeded ? <AlertTriangle /> : <Gauge />}
      titleId="category-watch-exception"
      title={anyExceeded
        ? `${worst.category} is over its budget`
        : `${worst.category} is close to its budget`}
      description={(
        <>
          {worst.status === 'Exceeded' ? (
            <>Spent {formatSensitive(worst.spent)} of {formatSensitive(worst.limit)} — {formatSensitive(Math.abs(worst.remaining))} over.</>
          ) : (
            <>Spent {formatSensitive(worst.spent)} of {formatSensitive(worst.limit)}; at this pace, finish near {formatSensitive(worst.projectedSpend)}.</>
          )}
          {others > 0 && ` ${others} more need a look.`}
        </>
      )}
      actions={(
        <Button variant="secondary" size="sm" onClick={() => onOpenCategoryLimits(worst.category)}>
          See categories
          <ChevronRight className="size-3.5" aria-hidden="true" />
        </Button>
      )}
    >
      <Meter
        size="sm"
        percent={Math.min(100, worst.percentUsed * 100)}
        tone={worst.status === 'Exceeded' ? 'bg-red-500' : 'bg-amber-500'}
        label={`${worst.category} budget used`}
        valueHidden={isMasked}
      />
    </NoticeCard>
  )
}
