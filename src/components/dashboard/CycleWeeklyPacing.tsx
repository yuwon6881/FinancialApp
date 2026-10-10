import React from 'react'
import { ChevronRight } from 'lucide-react'
import { cycleWeekMetric, type CycleHeatmapMode, type CycleMetricTone, type CycleWeekSummary } from '../../lib/cycleCalendar'
import { cn } from '../../lib/utils'
import { InteractiveCard } from '../ui/InteractiveCard'

interface CycleWeeklyPacingProps {
  weeks: CycleWeekSummary[]
  /** The pacing headline follows the shading mode, so the two never disagree. */
  mode: CycleHeatmapMode
  formatAmount: (value: number) => React.ReactNode
  onSelectWeek?: (week: CycleWeekSummary, mode: CycleHeatmapMode) => void
  className?: string
}

const HEADINGS: Record<CycleHeatmapMode, string> = {
  expense: 'Weekly spend pacing',
  net: 'Weekly net pacing',
  activity: 'Weekly activity pacing',
}

const TONE_CLASS: Record<CycleMetricTone, string> = {
  inflow: 'text-emerald-600 dark:text-emerald-400',
  outflow: 'text-foreground',
  neutral: 'text-foreground',
}

function formatShortDate(dateStr: string): string {
  const parts = dateStr.split('-')
  if (parts.length !== 3) return dateStr
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const monthIdx = parseInt(parts[1], 10) - 1
  const day = parseInt(parts[2], 10)
  return `${monthNames[monthIdx]} ${day}`
}

/** The cycle week by week, one row each: its dates, its figure for the current mode, and how far in it is. */
export const CycleWeeklyPacing: React.FC<CycleWeeklyPacingProps> = ({
  weeks,
  mode,
  formatAmount,
  onSelectWeek,
  className,
}) => {
  if (weeks.length === 0) return null

  return (
    <div className={cn('min-w-0', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-subsection text-foreground">{HEADINGS[mode]}</h3>
        <span className="text-caption text-muted-foreground tabular-nums">{weeks.length} weeks</span>
      </div>
      <ul className="-mx-2 mt-1.5">
        {weeks.map((week) => {
          const metric = cycleWeekMetric(week, mode)
          const notStarted = week.elapsedDayCount === 0
          // A week that has not begun has no history to pace; showing a bare zero there read as
          // "nothing spent" when it actually means "not here yet".
          const headline = notStarted
            ? week.projectedBillsAmount > 0
              ? <>~{formatAmount(-week.projectedBillsAmount)}</>
              : 'Not here yet'
            : formatAmount(metric.value ?? 0)
          const progress = notStarted
            ? week.projectedBillsAmount > 0 ? 'Bills due' : null
            : week.elapsedDayCount < week.dayCount
              ? `${week.elapsedDayCount}/${week.dayCount} days`
              : null
          const isDisabled = notStarted && week.transactionCount === 0
          const dates = `${formatShortDate(week.startDate)} – ${formatShortDate(week.endDate)}`

          const content = (
            <span className="flex min-h-10 min-w-0 items-center gap-3">
              <span className="min-w-0 flex-1">
                <span className={cn('block text-body font-medium', isDisabled ? 'text-muted-foreground' : 'text-foreground')}>Week {week.weekNumber}</span>
                <span className="block truncate text-caption text-muted-foreground">{dates}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className={cn('block text-body font-medium tabular-nums', notStarted ? 'text-muted-foreground' : TONE_CLASS[metric.tone])}>
                  {headline}
                </span>
                {progress && <span className="block text-caption text-muted-foreground tabular-nums">{progress}</span>}
              </span>
              {onSelectWeek && (
                <ChevronRight
                  aria-hidden="true"
                  className={cn('size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5', isDisabled && 'invisible')}
                />
              )}
            </span>
          )

          return (
            <li key={week.weekNumber}>
              {onSelectWeek ? (
                <InteractiveCard
                  surface="plain"
                  disabled={isDisabled}
                  onClick={() => onSelectWeek(week, mode)}
                  aria-label={`View Week ${week.weekNumber} transactions in Ledger (${formatShortDate(week.startDate)} to ${formatShortDate(week.endDate)})`}
                  // A week that has not started reads as quiet text already; the primitive's
                  // stronger disabled fade would double it.
                  className="group rounded-control px-2 py-1.5 hover:bg-surface-2 focus-visible:outline-offset-[-2px] disabled:opacity-100"
                >
                  {content}
                </InteractiveCard>
              ) : (
                <div className="px-2 py-1.5">{content}</div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
