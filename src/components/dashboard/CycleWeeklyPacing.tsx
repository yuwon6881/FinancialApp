import React from 'react'
import type { CycleWeekSummary } from '../../lib/cycleCalendar'
import { cn } from '../../lib/utils'

interface CycleWeeklyPacingProps {
  weeks: CycleWeekSummary[]
  formatAmount: (value: number) => React.ReactNode
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
  formatAmount,
}) => {
  if (weeks.length === 0) return null

  return (
    <div className="mt-4 border-t border-border/50 pt-3">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Weekly Spend Pacing
        </h4>
        <span className="text-[10px] text-muted-foreground">
          {weeks.length} week cycles
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
        {weeks.map((week) => {
          const hasNet = week.totalNet !== 0
          const isNetPositive = week.totalNet > 0
          return (
            <div
              key={week.weekNumber}
              className="flex flex-col justify-between rounded-xl border border-border/50 bg-muted/15 p-2.5 transition-colors hover:bg-muted/30"
            >
              <div className="flex items-center justify-between text-[10px]">
                <span className="font-bold text-foreground">Week {week.weekNumber}</span>
                <span className="text-[9px] text-muted-foreground">
                  {formatShortDate(week.startDate)} - {formatShortDate(week.endDate)}
                </span>
              </div>
              <div className="mt-1.5 flex items-baseline justify-between gap-1">
                <span className="text-[10px] font-bold text-orange-500">
                  {week.totalOutflow > 0 ? formatAmount(-week.totalOutflow) : 'RM0'}
                </span>
                {hasNet && (
                  <span
                    className={cn(
                      'text-[9px] font-medium',
                      isNetPositive ? 'text-emerald-500' : 'text-muted-foreground'
                    )}
                  >
                    net {isNetPositive ? '+' : ''}{formatAmount(week.totalNet)}
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
