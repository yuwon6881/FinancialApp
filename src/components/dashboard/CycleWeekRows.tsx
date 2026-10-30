import type React from 'react'
import type { CycleCalendarDay, CycleWeekSummary } from '../../lib/cycleCalendar'
import { cn } from '../../lib/utils'
import { InteractiveCard } from '../ui/InteractiveCard'

interface CycleWeekRowsProps {
  /** Rows of seven, Sunday first, with `null` where the cycle has not started or has ended. */
  rows: (CycleCalendarDay | null)[][]
  weeks: CycleWeekSummary[]
  today: string
  hideSensitive?: boolean
  formatNet: (value: number) => React.ReactNode
  onSelectDay: (day: CycleCalendarDay) => void
  onSelectWeek?: (week: CycleWeekSummary) => void
}

const HEAT_LABELS = ['No cash activity', 'Low cash activity', 'Some cash activity', 'High cash activity', 'Busiest cash activity'] as const

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatShortDate(dateStr: string): string {
  const [, month, day] = dateStr.split('-').map(Number)
  return month && day ? `${MONTHS[month - 1]} ${day}` : dateStr
}

/**
 * The cycle as one row per week: the week's dates and spending, and a bar for each of its seven days.
 * Bars share one scale across the whole cycle, so weeks compare at a glance; the exact figures stay
 * one tap away in the day sheet.
 */
export const CycleWeekRows: React.FC<CycleWeekRowsProps> = ({
  rows, weeks, today, hideSensitive, formatNet, onSelectDay, onSelectWeek,
}) => {
  const busiest = Math.max(0, ...rows.flat().map(day => day?.outflow ?? 0))

  const renderDay = (day: CycleCalendarDay) => {
    const isToday = day.dateKey === today
    const level = hideSensitive ? 0 : day.heatLevel
    const fraction = hideSensitive || busiest === 0 ? 0 : day.outflow / busiest
    const state = day.isFuture ? 'future' : level > 0 ? 'active' : 'quiet'
    const label = day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const stateLabel = hideSensitive ? 'Cash activity hidden' : day.isFuture ? 'Not here yet' : HEAT_LABELS[level]
    const billsLabel = day.recurringNames.length ? ` Bills due: ${day.recurringNames.join(', ')}.` : ''

    return (
      <InteractiveCard
        surface="plain"
        key={day.dateKey}
        title={`${label}: ${stateLabel}.${billsLabel}`}
        aria-label={`${label}. ${stateLabel}.${billsLabel}`}
        aria-current={isToday ? 'date' : undefined}
        data-state={state}
        className="relative flex h-14 min-w-0 flex-col items-center justify-end gap-1 rounded-control pb-1 hover:bg-surface-2/60 focus-visible:outline-offset-1"
        onClick={() => onSelectDay(day)}
      >
        <span className="flex w-full flex-1 items-end justify-center" aria-hidden="true">
          <span
            data-bar={state}
            style={state === 'active' ? { height: `${Math.max(12, Math.round(fraction * 100))}%` } : undefined}
            className={cn(
              'w-2/5 max-w-5 rounded-t-[4px] rounded-b-[2px]',
              state === 'active' && 'bg-primary',
              state === 'quiet' && 'h-[3px] bg-border',
              state === 'future' && 'h-[3px] bg-transparent ring-1 ring-inset ring-border/70',
            )}
          />
        </span>
        <span
          className={cn(
            'rounded-full px-1.5 text-caption tabular-nums leading-snug',
            isToday ? 'bg-primary font-semibold text-primary-foreground' : day.isFuture ? 'text-muted-foreground' : 'text-foreground/80',
          )}
        >
          {day.date.getDate()}
        </span>
        {/* A bill on this day: amber while it is still to pay, green once paid. */}
        {day.recurring.length > 0 && (
          <span
            aria-hidden="true"
            className={cn(
              'absolute right-1 top-1 flex items-center justify-center rounded-full',
              day.recurring.length > 1 ? 'h-3.5 min-w-3.5 px-0.5 text-micro font-semibold leading-none' : 'size-1.5',
              day.hasPendingBills
                ? day.recurring.length > 1 ? 'bg-amber-500/18 text-amber-700 dark:text-amber-300' : 'bg-amber-500'
                : day.recurring.length > 1 ? 'bg-emerald-500/18 text-emerald-700 dark:text-emerald-300' : 'bg-emerald-500',
            )}
          >
            {day.recurring.length > 1 ? day.recurring.length : null}
          </span>
        )}
      </InteractiveCard>
    )
  }

  const renderWeekTotal = (week: CycleWeekSummary) => {
    const notStarted = week.elapsedDayCount === 0
    const figure = notStarted
      ? week.projectedBillsAmount > 0 ? <>~{formatNet(week.projectedBillsAmount)}</> : '—'
      : formatNet(-week.totalOutflow)
    const caption = notStarted
      ? week.projectedBillsAmount > 0 ? 'Bills due' : 'Not here yet'
      : week.elapsedDayCount < week.dayCount ? `${week.elapsedDayCount}/${week.dayCount} days` : null
    const content = (
      <span className="flex flex-col items-end justify-center gap-0.5 text-right">
        <span className={cn('text-label font-medium tabular-nums', notStarted ? 'text-muted-foreground' : 'text-foreground')}>{figure}</span>
        {caption && <span className="text-caption text-muted-foreground tabular-nums">{caption}</span>}
      </span>
    )
    const label = `View Week ${week.weekNumber} transactions in Ledger (${formatShortDate(week.startDate)} to ${formatShortDate(week.endDate)})`
    return onSelectWeek ? (
      <InteractiveCard
        surface="plain"
        disabled={notStarted && week.transactionCount === 0}
        onClick={() => onSelectWeek(week)}
        aria-label={label}
        className="min-h-11 w-auto rounded-control px-2.5 py-1.5 hover:bg-surface-2 focus-visible:outline-offset-[-2px] disabled:opacity-100"
      >
        {content}
      </InteractiveCard>
    ) : <div className="px-2.5 py-1.5">{content}</div>
  }

  return (
    <ul aria-label="Cycle weeks" className="min-w-0 divide-y divide-border/60">
      {rows.map((row, rowIndex) => {
        const week = weeks[rowIndex]
        if (!week) return null
        return (
          <li
            key={week.startDate}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-2.5 @xl:grid-cols-[8.5rem_minmax(0,1fr)_7.5rem] @xl:gap-x-5"
          >
            <p className="min-w-0 text-label font-medium text-foreground @xl:row-start-1">
              {formatShortDate(week.startDate)} – {formatShortDate(week.endDate)}
              <span className="block text-caption font-normal text-muted-foreground">Week {week.weekNumber}</span>
            </p>
            <div className="col-span-2 grid grid-cols-7 gap-1 @xl:col-span-1 @xl:col-start-2 @xl:row-start-1">
              {row.map((day, index) => day ? renderDay(day) : <div key={`blank-${rowIndex}-${index}`} aria-hidden="true" />)}
            </div>
            <div className="col-start-2 row-start-1 justify-self-end @xl:col-start-3">{renderWeekTotal(week)}</div>
          </li>
        )
      })}
    </ul>
  )
}
