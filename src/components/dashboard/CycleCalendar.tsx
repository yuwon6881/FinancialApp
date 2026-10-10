import { m, useReducedMotion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import type { ActiveRecurringPayment, Transaction } from '../../types'
import {
  buildCycleCalendar,
  cycleDayMetric,
  formatCalendarDate,
  type CycleCalendarDay,
  type CycleHeatmapMode,
  type CycleMetricTone,
  type CycleWeekSummary,
} from '../../lib/cycleCalendar'
import { InfoHint } from '../ui/InfoHint'
import { SectionHeader } from '../ui/SectionHeader'
import { ReportSegmented } from '../reports/ReportSegmented'
import { CycleCalendarDaySheet } from './CycleCalendarDaySheet'
import { CycleWeeklyPacing } from './CycleWeeklyPacing'
import { cn } from '../../lib/utils'
import { panelClass } from '../ui/panelStyles'

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

const HEAT_PERCENT = [0, 10, 18, 27, 38] as const
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

// Phone cells show a presence dot where the tablet/desktop cell shows the figure.
const TONE_DOT_CLASS: Record<CycleMetricTone, string> = {
  inflow: 'bg-emerald-500',
  outflow: 'bg-orange-500',
  neutral: 'bg-foreground/60',
}

const heatStyle = (level: HeatLevel, mode: CycleHeatmapMode, net?: number) => {
  if (level === 0) return undefined
  if (mode === 'net') {
    const colorVar = (net ?? 0) >= 0 ? 'var(--ledger-income-500)' : 'var(--ledger-expense-500)'
    return {
      backgroundColor: `color-mix(in srgb, ${colorVar} ${HEAT_PERCENT[level]}%, var(--card))`,
      borderColor: `color-mix(in srgb, ${colorVar} ${Math.min(60, HEAT_PERCENT[level] + 12)}%, var(--border))`,
    }
  }
  return {
    backgroundColor: `color-mix(in srgb, var(--ledger-purple-500) ${HEAT_PERCENT[level]}%, var(--card))`,
    borderColor: `color-mix(in srgb, var(--ledger-purple-500) ${Math.min(60, HEAT_PERCENT[level] + 12)}%, var(--border))`,
  }
}

// A day the cycle has not reached yet has no history to shade, which used to render identically to
// a day that came and went without a single transaction. The diagonal hatch says "not yet"; a flat
// cell with a centre dot says "nothing happened".
const NOT_YET_REACHED_STYLE = {
  backgroundImage:
    'repeating-linear-gradient(135deg, color-mix(in srgb, var(--border) 65%, transparent) 0 1px, transparent 1px 6px)',
} as const

export function CycleCalendar(props: CycleCalendarProps) {
  const reduceMotion = useReducedMotion()
  const [mode, setMode] = useState<CycleHeatmapMode>('expense')
  const [selectedDay, setSelectedDay] = useState<CycleCalendarDay | null>(null)

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
      <div className={cn(panelClass, 'grid min-w-0 gap-5 p-3 sm:p-5 @4xl:grid-cols-[minmax(0,1fr)_16rem] @4xl:gap-0 max-[359px]:-mx-4 max-[359px]:rounded-none max-[359px]:border-x-0 max-[359px]:px-0.5')}>
      <div className="min-w-0 @4xl:pr-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 max-[359px]:px-2.5">
        <ReportSegmented
          label="Calendar shading"
          value={mode}
          onChange={setMode}
          options={MODES.map(entry => ({
            value: entry.mode,
            label: <><span className="@xl:hidden">{entry.shortLabel}</span><span className="hidden @xl:inline">{entry.label}</span></>,
          }))}
        />
        <p className="flex items-center gap-2 px-1 text-caption text-muted-foreground">
          <span className="tabular-nums">{calendar.stats.noSpendDaysCount} zero-spend days</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">Avg {props.formatNet(-Math.round(calendar.stats.averageDailySpend))}/day</span>
        </p>
      </div>
      {/* Legend & Summary Subtitle -- the legend is desktop/tablet detail; phones get the summary
          line only, since the grid itself already carries the shading. */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1 text-caption empty:hidden max-[359px]:px-3">
        {props.hideSensitive ? (
          <p className="text-xs font-medium text-muted-foreground">Activity shading is hidden while amounts are hidden.</p>
        ) : mode === 'net' ? (
          <div aria-label="Cash activity heat scale" className="hidden items-center gap-1.5 text-xs font-medium text-muted-foreground sm:flex">
            <span>Net outflow</span>
            <span className="size-3 rounded-sm border" style={heatStyle(3, 'net', -100)} aria-hidden="true" />
            <span className="size-3 rounded-sm border" style={heatStyle(1, 'net', -10)} aria-hidden="true" />
            <span className="size-3 rounded-sm border border-border/60 bg-muted/20" aria-hidden="true" />
            <span className="size-3 rounded-sm border" style={heatStyle(1, 'net', 10)} aria-hidden="true" />
            <span className="size-3 rounded-sm border" style={heatStyle(3, 'net', 100)} aria-hidden="true" />
            <span>Net inflow</span>
          </div>
        ) : (
          <div aria-label="Cash activity heat scale" className="hidden items-center gap-1.5 text-xs font-medium text-muted-foreground sm:flex">
            <span>{mode === 'expense' ? 'Less spending' : 'Less activity'}</span>
            {([1, 2, 3, 4] as const).map(level => (
              <span key={level} className="size-3 rounded-sm border" style={heatStyle(level, mode)} aria-hidden="true" />
            ))}
            <span>{mode === 'expense' ? 'More spending' : 'More activity'}</span>
          </div>
        )}

        {/* Tells apart the two cells that used to look alike. */}
        <div className="hidden items-center gap-2.5 text-xs font-medium text-muted-foreground lg:flex">
          <span className="flex items-center gap-1">
            <span className="flex size-3 items-center justify-center rounded-sm border border-border/40 bg-muted/25" aria-hidden="true">
              <span className="size-1 rounded-full bg-muted-foreground/40" />
            </span>
            <span>Nothing spent</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="size-3 rounded-sm border border-dashed border-border/70" style={NOT_YET_REACHED_STYLE} aria-hidden="true" />
            <span>Not here yet</span>
          </span>
        </div>

      </div>

      {/* Calendar Grid */}
      <div className="px-0.5 py-1 sm:px-1">
        <div aria-label="Cycle days" className="grid w-full min-w-0 grid-cols-[repeat(7,minmax(0,1fr))] gap-1 text-center sm:gap-2 max-[359px]:gap-px">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => {
            const isWeekendHeader = idx === 0 || idx === 6
            return (
              <div
                key={day}
                className={cn(
                  'pb-1.5 text-caption text-muted-foreground',
                  // Weekends step down in weight, not colour: a fainter grey would fall below AA.
                  isWeekendHeader ? 'font-medium' : 'font-semibold'
                )}
              >
                {/* Single letter on phones: three-letter headers crowd a 40px column. */}
                <span className="sm:hidden">{day.charAt(0)}</span>
                <span className="hidden sm:inline">{day}</span>
              </div>
            )
          })}
          {Array.from({ length: calendar.startDayOfWeek }).map((_, index) => <div key={`empty-${index}`} />)}
          {calendar.days.map((day, index) => {
            const isToday = day.dateKey === today
            const activeHeatLevel = day.heatLevels[mode]
            const visibleHeatLevel = props.hideSensitive ? 0 : activeHeatLevel
            const metric = cycleDayMetric(day, mode)

            const color = isToday
              ? 'border-primary ring-2 ring-inset ring-primary bg-card'
              : day.isFuture
                ? 'border-dashed border-border/70 hover:border-border'
                : visibleHeatLevel > 0
                  ? 'border-border/50 hover:brightness-110'
                  : day.isWeekend
                    ? 'bg-muted/30 border-border/40 hover:bg-muted/45'
                    : 'bg-muted/25 border-border/40 hover:bg-muted/40'

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
                initial={reduceMotion ? false : { opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.3, delay: index * 0.01 }}
                whileTap={reduceMotion ? undefined : { scale: 0.95 }}
                title={`${label}: ${stateLabel}.${billsLabel}`}
                aria-label={`${label}. ${stateLabel}.${billsLabel}`}
                style={{
                  ...(day.isFuture && !isToday ? NOT_YET_REACHED_STYLE : {}),
                  ...heatStyle(visibleHeatLevel, mode, day.net),
                }}
                className={`relative flex h-11 min-w-0 cursor-pointer flex-col items-center justify-center rounded-lg border text-xs sm:h-14 sm:rounded-xl md:h-16 ${color}`}
                onClick={() => setSelectedDay(day)}
              >
                <span
                  className={cn(
                    'text-caption font-semibold sm:text-sm',
                    isToday ? 'text-accent-ink' : day.isFuture ? 'text-muted-foreground' : 'text-foreground/90'
                  )}
                >
                  {day.date.getDate()}
                </span>

                {/* Amounts are tablet/desktop detail. A phone column cannot hold a legible figure,
                    so it carries a presence dot instead and the exact numbers stay one tap away. */}
                {metric.value !== undefined ? (
                  <span
                    className={cn(
                      'hidden max-w-full truncate text-caption font-semibold leading-tight md:inline md:text-xs',
                      TONE_CLASS[metric.tone]
                    )}
                  >
                    {props.formatNet(metric.value)}
                  </span>
                ) : day.isFuture && day.projectedBillsAmount > 0 ? (
                  <span className="hidden max-w-full truncate text-xs font-medium leading-tight text-amber-600 dark:text-amber-400 md:inline md:text-xs">
                    ~{props.formatNet(-day.projectedBillsAmount)}
                  </span>
                ) : null}

                {!day.isFuture && !props.hideSensitive && (
                  <span
                    className={cn(
                      'mt-0.5 rounded-full',
                      metric.value !== undefined
                        ? cn('size-1.5 md:hidden', TONE_DOT_CLASS[metric.tone])
                        : 'size-1 bg-muted-foreground/40'
                    )}
                    aria-hidden="true"
                  />
                )}

                {/* Recurring Bills Status Badge */}
                {day.recurring.length > 0 && (
                  day.recurring.length > 1 ? (
                    <span
                      className={cn(
                        'absolute top-1 right-1 flex size-3 items-center justify-center rounded-full text-caption font-semibold sm:size-3.5 sm:text-xs',
                        day.hasPendingBills
                          ? 'bg-amber-500/20 text-amber-500 ring-1 ring-amber-500/40 animate-pulse'
                          : 'bg-emerald-500/20 text-emerald-500 ring-1 ring-emerald-500/40'
                      )}
                    >
                      {day.recurring.length}
                    </span>
                  ) : (
                    <span
                      className={cn(
                        'absolute top-1 right-1 size-1.5 rounded-full',
                        day.hasPendingBills ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
                      )}
                    />
                  )
                )}
              </m.button>
            )
          })}
        </div>
      </div>

      </div>

      <CycleWeeklyPacing
        weeks={calendar.weeks}
        mode={mode}
        formatAmount={props.formatNet}
        onSelectWeek={props.onSelectWeek}
        className="border-t border-border/60 px-1 pt-4 @4xl:border-l @4xl:border-t-0 @4xl:pl-6 @4xl:pr-0 @4xl:pt-0 max-[359px]:px-3"
      />
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
