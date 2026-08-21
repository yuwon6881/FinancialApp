import React from 'react'
import { cycleWeekMetric, type CycleHeatmapMode, type CycleMetricTone, type CycleWeekSummary } from '../../lib/cycleCalendar'
import { cn } from '../../lib/utils'

interface CycleWeeklyPacingProps {
  weeks: CycleWeekSummary[]
  /** The pacing headline follows the shading mode, so the two never disagree. */
  mode: CycleHeatmapMode
  formatAmount: (value: number) => React.ReactNode
}

const HEADINGS: Record<CycleHeatmapMode, string> = {
  expense: 'Weekly Spend Pacing',
  net: 'Weekly Net Pacing',
  activity: 'Weekly Activity Pacing',
}

const TONE_CLASS: Record<CycleMetricTone, string> = {
  inflow: 'text-blue-500',
  outflow: 'text-orange-500',
  neutral: 'text-foreground/80',
}

function formatShortDate(dateStr: string): string {
  const parts = dateStr.split('-')
  if (parts.length !== 3) return dateStr
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const monthIdx = parseInt(parts[1], 10) - 1
  const day = parseInt(parts[2], 10)
  return `${monthNames[monthIdx]} ${day}`
}

export const CycleWeeklyPacing: React.FC<CycleWeeklyPacingProps> = ({
  weeks,
  mode,
  formatAmount,
}) => {
  if (weeks.length === 0) return null

  return (
    <div className="mt-4 border-t border-border/50 pt-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:text-[11px]">
          {HEADINGS[mode]}
        </h4>
        <span className="text-[10px] text-muted-foreground">
          {weeks.length} week cycles
        </span>
      </div>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2 lg:grid-cols-5">
        {weeks.map((week) => {
          const metric = cycleWeekMetric(week, mode)
          const notStarted = week.elapsedDayCount === 0
          // A week that has not begun has no history to pace; showing a bare zero there read as
          // "nothing spent" when it actually means "not here yet".
          const headline = notStarted
            ? week.projectedBillsAmount > 0
              ? <>~{formatAmount(-week.projectedBillsAmount)}</>
              : <span className="text-muted-foreground">Not here yet</span>
            : formatAmount(metric.value ?? 0)

          return (
            <div
              key={week.weekNumber}
              className={cn(
                'flex flex-col justify-between rounded-xl border border-border/50 p-2 transition-colors sm:p-2.5',
                notStarted ? 'border-dashed bg-transparent' : 'bg-muted/15 hover:bg-muted/30'
              )}
            >
              <div className="flex items-baseline justify-between gap-1 text-[10px]">
                <span className="font-bold text-foreground">Week {week.weekNumber}</span>
                {/* Date ranges are desktop detail; a phone card only has room for the figure. */}
                <span className="hidden text-[9px] text-muted-foreground lg:inline">
                  {formatShortDate(week.startDate)} - {formatShortDate(week.endDate)}
                </span>
              </div>
              <div className="mt-1.5 flex items-baseline justify-between gap-1">
                <span className={cn('text-[10px] font-bold', notStarted ? 'text-muted-foreground' : TONE_CLASS[metric.tone])}>
                  {headline}
                </span>
                {!notStarted && week.elapsedDayCount < week.dayCount && (
                  <span className="text-[9px] font-medium text-muted-foreground">
                    {week.elapsedDayCount}/{week.dayCount}d
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
