import { m, useReducedMotion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import type React from 'react'
import type { ActiveRecurringPayment, Transaction } from '../../types'
import {
  buildCycleCalendar,
  cycleDayMetric,
  formatCalendarDate,
  type CycleCalendarDay,
  type CycleHeatmapMode,
  type CycleMetricTone,
  type CycleWeekSummary,
  cycleWeekMetric,
} from '../../lib/cycleCalendar'
import { InfoHint } from '../ui/InfoHint'
import { SectionHeader } from '../ui/SectionHeader'
import { ReportSegmented } from '../reports/ReportSegmented'
import { CycleCalendarDaySheet } from './CycleCalendarDaySheet'
import { CycleWeeklyPacing } from './CycleWeeklyPacing'
import { cn } from '../../lib/utils'
import { panelClass } from '../ui/panelStyles'
import { InteractiveCard } from '../ui/InteractiveCard'

interface CycleCalendarProps {
  selectedMonth: string
  selectedYear: number
  cycleDay: number
  cycleLabel: string
  transactions: Transaction[]
  recurringPayments: ActiveRecurringPayment[]
  formatNet: (value: number) => React.ReactNode
  hideSensitive?: boolean
  onSelectDate?: (date: string) => void
  onSelectWeek?: (week: CycleWeekSummary, mode: CycleHeatmapMode) => void
}

// Fill strength per heat level, mixed into the card colour. Capped so a day's number stays legible
// on the strongest fill in both themes.
const HEAT_PERCENT = [0, 12, 22, 32, 44] as const
const HEAT_LABELS = ['No cash activity', 'Low cash activity', 'Some cash activity', 'High cash activity', 'Busiest cash activity'] as const
type HeatLevel = 0 | 1 | 2 | 3 | 4

const MODES: { mode: CycleHeatmapMode; label: string; shortLabel: string }[] = [
  { mode: 'expense', label: 'Spending', shortLabel: 'Spent' },
  { mode: 'net', label: 'Net Flow', shortLabel: 'Net' },
  { mode: 'activity', label: 'Activity', shortLabel: 'All' },
]

const TONE_CLASS: Record<CycleMetricTone, string> = {
  inflow: 'text-emerald-600 dark:text-emerald-400',
  outflow: 'text-foreground',
  neutral: 'text-foreground/80',
}

const heatStyle = (level: HeatLevel, mode: CycleHeatmapMode, net?: number) => {
  if (level === 0) return undefined
  // Spending is never red: a net outflow day is shaded in plain ink, a net inflow day in green,
  // and spending/activity in Iris, the one colour the app spends on "how much".
  const colorVar = mode === 'net'
    ? (net ?? 0) >= 0 ? 'var(--color-emerald-500)' : 'var(--foreground)'
    : 'var(--primary)'
  const percent = mode === 'net' && (net ?? 0) < 0 ? Math.round(HEAT_PERCENT[level] * 0.55) : HEAT_PERCENT[level]
  return { backgroundColor: `color-mix(in srgb, ${colorVar} ${percent}%, var(--card))` }
}

function formatShortDate(dateStr: string): string {
  const [, month, day] = dateStr.split('-').map(Number)
  if (!month || !day) return dateStr
  return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][month - 1]} ${day}`
}

/** True once the calendar's own box is wide enough to give each week row a trailing total. */
function useWideCalendar(ref: React.RefObject<HTMLElement | null>, minWidth: number) {
  const [wide, setWide] = useState(false)
  useEffect(() => {
    const element = ref.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width ?? 0
      setWide(width >= minWidth)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref, minWidth])
  return wide
}

export function CycleCalendar(props: CycleCalendarProps) {
  const reduceMotion = useReducedMotion()
  const [mode, setMode] = useState<CycleHeatmapMode>('expense')
  const [selectedDay, setSelectedDay] = useState<CycleCalendarDay | null>(null)
  const gridBoxRef = useRef<HTMLDivElement | null>(null)
  // Seven days plus a week total need about 40rem; below that the totals stay in their own list.
  const wide = useWideCalendar(gridBoxRef, 640)

  useEffect(() => {
    setSelectedDay(null)
  }, [props.selectedMonth, props.selectedYear])

  const calendar = useMemo(() => buildCycleCalendar({
    selectedMonth: props.selectedMonth,
    selectedYear: props.selectedYear,
    cycleDay: props.cycleDay,
    transactions: props.transactions,
    recurringPayments: props.recurringPayments,
  }), [props.selectedMonth, props.selectedYear, props.cycleDay, props.transactions, props.recurringPayments])

  const today = formatCalendarDate(new Date())

  // Rows of seven, Sunday first; the cycle's weeks are the same Sunday-to-Saturday rows, so each
  // row can carry its own week's total at its trailing edge.
  const rows = useMemo(() => {
    const cells: (CycleCalendarDay | null)[] = [
      ...Array.from({ length: calendar.startDayOfWeek }, () => null),
      ...calendar.days,
    ]
    while (cells.length % 7 !== 0) cells.push(null)
    return Array.from({ length: cells.length / 7 }, (_, index) => cells.slice(index * 7, index * 7 + 7))
  }, [calendar])

  const renderDay = (day: CycleCalendarDay) => {
    const isToday = day.dateKey === today
    const visibleHeatLevel = (props.hideSensitive ? 0 : day.heatLevels[mode]) as HeatLevel
    const metric = cycleDayMetric(day, mode)
    const label = day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const stateLabel = props.hideSensitive
      ? 'Cash activity hidden'
      : day.isFuture
        ? 'Not here yet'
        : HEAT_LABELS[visibleHeatLevel]
    const billsLabel = day.recurringNames.length ? ` Bills due: ${day.recurringNames.join(', ')}.` : ''

    return (
      <m.button
        type="button"
        key={day.dateKey}
        whileTap={reduceMotion ? undefined : { scale: 0.96 }}
        title={`${label}: ${stateLabel}.${billsLabel}`}
        aria-label={`${label}. ${stateLabel}.${billsLabel}`}
        aria-current={isToday ? 'date' : undefined}
        style={heatStyle(visibleHeatLevel, mode, day.net)}
        className={cn(
          'relative flex h-11 min-w-0 cursor-pointer flex-col items-center justify-center rounded-[10px] text-center transition-[background-color,box-shadow] duration-150',
          'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
          'sm:h-[4.25rem] sm:items-start sm:justify-between sm:p-2 sm:text-left',
          isToday && 'ring-2 ring-inset ring-primary',
          day.isFuture
            ? 'bg-transparent ring-1 ring-inset ring-border/70 hover:bg-surface-2/60'
            : visibleHeatLevel === 0 && 'bg-surface-2/60 hover:bg-surface-2 dark:bg-surface-2/50',
          visibleHeatLevel > 0 && 'hover:brightness-110',
        )}
        onClick={() => setSelectedDay(day)}
      >
        <span
          className={cn(
            'text-caption font-semibold tabular-nums sm:text-label',
            isToday ? 'text-accent-ink' : day.isFuture ? 'text-muted-foreground' : 'text-foreground',
          )}
        >
          {day.date.getDate()}
        </span>

        {/* The figure is tablet/desktop detail; a phone column carries the shading only and the
            exact numbers stay one tap away. */}
        {metric.value !== undefined ? (
          <span className={cn('hidden max-w-full truncate text-caption font-medium tabular-nums leading-tight md:block', TONE_CLASS[metric.tone])}>
            {props.formatNet(metric.value)}
          </span>
        ) : day.isFuture && day.projectedBillsAmount > 0 ? (
          <span className="hidden max-w-full truncate text-caption leading-tight text-muted-foreground tabular-nums md:block">
            ~{props.formatNet(day.projectedBillsAmount)}
          </span>
        ) : null}

        {/* A bill on this day: amber while it is still to pay, green once paid. */}
        {day.recurring.length > 0 && (
          <span
            aria-hidden="true"
            className={cn(
              'absolute right-1.5 top-1.5 flex items-center justify-center rounded-full',
              day.recurring.length > 1 ? 'h-3.5 min-w-3.5 px-0.5 text-micro font-semibold leading-none' : 'size-1.5',
              day.hasPendingBills
                ? day.recurring.length > 1 ? 'bg-amber-500/18 text-amber-700 dark:text-amber-300' : 'bg-amber-500'
                : day.recurring.length > 1 ? 'bg-emerald-500/18 text-emerald-700 dark:text-emerald-300' : 'bg-emerald-500',
            )}
          >
            {day.recurring.length > 1 ? day.recurring.length : null}
          </span>
        )}
      </m.button>
    )
  }

  const renderWeekTotal = (week: CycleWeekSummary | undefined) => {
    if (!week) return <div />
    const metric = cycleWeekMetric(week, mode)
    const notStarted = week.elapsedDayCount === 0
    const isDisabled = notStarted && week.transactionCount === 0
    const figure = notStarted
      ? week.projectedBillsAmount > 0 ? <>~{props.formatNet(week.projectedBillsAmount)}</> : '—'
      : props.formatNet(metric.value ?? 0)
    const caption = notStarted
      ? week.projectedBillsAmount > 0 ? 'Bills due' : 'Not here yet'
      : week.elapsedDayCount < week.dayCount ? `${week.elapsedDayCount}/${week.dayCount} days` : `Week ${week.weekNumber}`
    const content = (
      <span className="flex h-full flex-col items-end justify-center gap-0.5 text-right">
        <span className={cn('text-label tabular-nums', notStarted ? 'text-muted-foreground' : metric.tone === 'inflow' ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground')}>{figure}</span>
        <span className="text-caption text-muted-foreground tabular-nums">{caption}</span>
      </span>
    )
    return props.onSelectWeek ? (
      <InteractiveCard
        surface="plain"
        disabled={isDisabled}
        onClick={() => props.onSelectWeek?.(week, mode)}
        aria-label={`View Week ${week.weekNumber} transactions in Ledger (${formatShortDate(week.startDate)} to ${formatShortDate(week.endDate)})`}
        className="h-[4.25rem] rounded-[10px] px-2.5 hover:bg-surface-2 focus-visible:outline-offset-[-2px] disabled:opacity-100"
      >
        {content}
      </InteractiveCard>
    ) : <div className="h-[4.25rem] px-2.5">{content}</div>
  }

  return (
    <section id="report-section-calendar" aria-labelledby="report-calendar-heading" className="@container space-y-3">
      <SectionHeader
        titleId="report-calendar-heading"
        title={(
          <span className="flex items-center gap-1">
            Cycle calendar
            <InfoHint
              inline
              label="cycle calendar shading"
              text="Shows cashflow rhythms across this billing cycle. Toggle between Spending, Net Flow, and Gross Activity to spot trends and upcoming bills. Tap any day for its full breakdown."
            />
          </span>
        )}
        description={props.cycleLabel}
      />
      {/* Below 360px seven 44px day targets do not fit inside the page gutters, so the panel runs
          edge to edge there and the days sit a hairline apart instead of overlapping. */}
      <div className={cn(panelClass, 'min-w-0 p-3 sm:p-5 max-[359px]:-mx-4 max-[359px]:rounded-none max-[359px]:border-x-0 max-[359px]:px-0.5')}>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 max-[359px]:px-2.5">
          <ReportSegmented
            label="Calendar shading"
            value={mode}
            onChange={setMode}
            options={MODES.map(entry => ({
              value: entry.mode,
              label: <><span className="@xl:hidden">{entry.shortLabel}</span><span className="hidden @xl:inline">{entry.label}</span></>,
            }))}
          />
          <dl className="flex items-center gap-4 text-caption">
            <div>
              <dt className="text-muted-foreground">Zero-spend days</dt>
              <dd className="text-label text-foreground tabular-nums">{calendar.stats.noSpendDaysCount}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Average a day</dt>
              <dd className="text-label text-foreground tabular-nums">{props.formatNet(-Math.round(calendar.stats.averageDailySpend))}</dd>
            </div>
          </dl>
        </div>

        <div ref={gridBoxRef} className="mt-4 min-w-0">
          <div
            aria-label="Cycle days"
            className={cn(
              'grid w-full min-w-0 gap-1 sm:gap-1.5 max-[359px]:gap-px',
              wide ? 'grid-cols-[repeat(7,minmax(0,1fr))_minmax(6.5rem,8rem)]' : 'grid-cols-[repeat(7,minmax(0,1fr))]',
            )}
          >
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
              <div
                key={day}
                className={cn('pb-1 text-center text-caption text-muted-foreground sm:px-2 sm:text-left', index === 0 || index === 6 ? 'font-normal' : 'font-medium')}
              >
                {/* Single letter on phones: three-letter headers crowd a 40px column. */}
                <span className="sm:hidden">{day.charAt(0)}</span>
                <span className="hidden sm:inline">{day}</span>
              </div>
            ))}
            {wide && <div className="pb-1 pr-2.5 text-right text-caption font-medium text-muted-foreground">Week</div>}
            {rows.map((row, rowIndex) => (
              <div key={rowIndex} className="contents">
                {row.map((day, index) => day ? renderDay(day) : <div key={`blank-${rowIndex}-${index}`} aria-hidden="true" />)}
                {wide && renderWeekTotal(calendar.weeks[rowIndex])}
              </div>
            ))}
          </div>
        </div>

        {/* One quiet legend line: what the shading means, and what the corner dot means. */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-caption text-muted-foreground max-[359px]:px-2.5">
          {props.hideSensitive ? (
            <p>Activity shading is hidden while amounts are hidden.</p>
          ) : mode === 'net' ? (
            <div aria-label="Cash activity heat scale" className="flex items-center gap-1.5">
              <span>Net outflow</span>
              <span className="size-3 rounded-[4px]" style={heatStyle(4, 'net', -100)} aria-hidden="true" />
              <span className="size-3 rounded-[4px]" style={heatStyle(2, 'net', -10)} aria-hidden="true" />
              <span className="size-3 rounded-[4px] bg-surface-2" aria-hidden="true" />
              <span className="size-3 rounded-[4px]" style={heatStyle(2, 'net', 10)} aria-hidden="true" />
              <span className="size-3 rounded-[4px]" style={heatStyle(4, 'net', 100)} aria-hidden="true" />
              <span>Net inflow</span>
            </div>
          ) : (
            <div aria-label="Cash activity heat scale" className="flex items-center gap-1.5">
              <span>{mode === 'expense' ? 'Less spending' : 'Less activity'}</span>
              {([1, 2, 3, 4] as const).map(level => (
                <span key={level} className="size-3 rounded-[4px]" style={heatStyle(level, mode)} aria-hidden="true" />
              ))}
              <span>{mode === 'expense' ? 'More spending' : 'More activity'}</span>
            </div>
          )}
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-amber-500" aria-hidden="true" />Bill due</span>
            <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />Bill paid</span>
            <span className="hidden items-center gap-1.5 sm:flex"><span className="size-3 rounded-[4px] ring-1 ring-inset ring-border/70" aria-hidden="true" />Not here yet</span>
          </div>
        </div>

        {!wide && (
          <CycleWeeklyPacing
            weeks={calendar.weeks}
            mode={mode}
            formatAmount={props.formatNet}
            onSelectWeek={props.onSelectWeek}
            className="mt-4 border-t border-border/60 px-1 pt-4 max-[359px]:px-3"
          />
        )}
      </div>

      <CycleCalendarDaySheet
        day={selectedDay}
        isOpen={!!selectedDay}
        onClose={() => setSelectedDay(null)}
        onViewInLedger={props.onSelectDate}
        formatAmount={props.formatNet}
      />
    </section>
  )
}
