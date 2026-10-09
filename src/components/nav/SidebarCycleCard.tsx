import React from 'react'
import { ProgressRing } from '../ui/ProgressRing'
import { getCurrentCycleYearAndMonth, getCycleProgress, MONTH_NAMES } from '../../lib/cycle'
import { getCycleLabelForDropdown } from '../../lib/cycleLabels'

/** Where today falls in the cycle, as a ring and two lines of text. Desktop only. */
export const SidebarCycleCard: React.FC<{ cycleDay: number }> = ({ cycleDay }) => {
  const { progress, label } = React.useMemo(() => {
    const { year, monthIndex } = getCurrentCycleYearAndMonth(cycleDay)
    return {
      progress: getCycleProgress(year, monthIndex, cycleDay),
      label: getCycleLabelForDropdown(MONTH_NAMES[monthIndex - 1], year, cycleDay),
    }
  }, [cycleDay])
  const headline = progress.phase === 'upcoming'
    ? `Starts in ${progress.daysUntilStart} ${progress.daysUntilStart === 1 ? 'day' : 'days'}`
    : `Day ${progress.dayNumber} of ${progress.totalDays}`
  const detail = progress.phase === 'ended'
    ? 'Cycle closed'
    : `${progress.daysLeft} ${progress.daysLeft === 1 ? 'day' : 'days'} left`
  return (
    <div className="mt-3 hidden items-center gap-3 rounded-2xl bg-surface-2/70 p-3 lg:flex">
      <ProgressRing percent={progress.progressPct} label="Cycle progress" size={38} thickness={4} />
      <div className="min-w-0">
        <p className="text-label font-semibold text-foreground tabular-nums">{headline}</p>
        <p className="truncate text-caption text-muted-foreground">{detail} · {label}</p>
      </div>
    </div>
  )
}

