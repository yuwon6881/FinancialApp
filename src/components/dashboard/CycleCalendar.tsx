import { m, useReducedMotion } from 'framer-motion'
import { useMemo, useState } from 'react'
import type { ActiveRecurringPayment, Transaction } from '../../types'
import {
  buildCycleCalendar,
  cycleDayMetric,
  formatCalendarDate,
  type CycleCalendarDay,
  type CycleHeatmapMode,
  type CycleMetricTone,
} from '../../lib/cycleCalendar'
import { InfoHint } from '../ui/InfoHint'
import { Button } from '../ui/Button'
import { CycleCalendarDaySheet } from './CycleCalendarDaySheet'
import { CycleWeeklyPacing } from './CycleWeeklyPacing'
import { cn } from '../../lib/utils'

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
  inflow: 'text-blue-500',
  outflow: 'text-orange-500',
  neutral: 'text-foreground/80',
}

// Phone cells show a presence dot where the tablet/desktop cell shows the figure.
const TONE_DOT_CLASS: Record<CycleMetricTone, string> = {
  inflow: 'bg-blue-500',
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

  const calendar = useMemo(() => buildCycleCalendar({
    selectedMonth: props.selectedMonth,
    selectedYear: props.selectedYear,
    cycleDay: props.cycleDay,
    transactions: props.transactions,
    recurringPayments: props.recurringPayments,
  }), [props.selectedMonth, props.selectedYear, props.cycleDay, props.transactions, props.recurringPayments])

  const today = formatCalendarDate(new Date())

  return (
    <div className="app-panel h-full rounded-2xl border border-border/60 bg-card/92 p-3 sm:p-6">
      {/* Header */}
      <div className="mb-3 flex flex-col gap-2 sm:mb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div>
          <div className="flex items-center gap-1">
            <h3 className="text-sm font-semibold text-foreground sm:text-base">Cycle Calendar</h3>
            <InfoHint
              label="cycle calendar shading"
              text="Shows cashflow rhythms across this billing cycle. Toggle between Spending, Net Flow, and Gross Activity to spot trends and upcoming bills. Tap any day for its full breakdown."
            />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{props.cycleLabel}</p>
        </div>

        {/* Heatmap Mode Selector */}
        <div className="flex items-center gap-1 self-stretch rounded-xl border border-border/60 bg-muted/25 p-1 sm:self-start">
          {MODES.map(entry => (
            <Button
              key={entry.mode}
              size="xs"
              variant={mode === entry.mode ? 'primary' : 'ghost'}
              className={cn('h-7 flex-1 px-2.5 text-xs font-semibold sm:h-7 sm:flex-none', mode !== entry.mode && 'text-muted-foreground hover:text-foreground')}
              onClick={() => setMode(entry.mode)}
              aria-pressed={mode === entry.mode}
            >
              <span className="sm:hidden">{entry.shortLabel}</span>
              <span className="hidden sm:inline">{entry.label}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* Legend & Summary Subtitle -- the legend is desktop/tablet detail; phones get the summary
          line only, since the grid itself already carries the shading. */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2.5">
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

        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <span>{calendar.stats.noSpendDaysCount} zero-spend days</span>
          <span>•</span>
          <span className="tabular-nums">Avg: {props.formatNet(-Math.round(calendar.stats.averageDailySpend))}/day</span>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="px-0.5 py-1 sm:px-1">
        <div aria-label="Cycle days" className="grid w-full min-w-0 grid-cols-[repeat(7,minmax(0,1fr))] gap-1 text-center sm:gap-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => {
            const isWeekendHeader = idx === 0 || idx === 6
            return (
              <div
                key={day}
                className={cn(
                  'pb-1.5 text-xs font-bold',
                  isWeekendHeader ? 'text-muted-foreground/70' : 'text-muted-foreground'
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
              ? 'border-blue-500 ring-2 ring-inset ring-blue-500 bg-card'
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
                className={`relative flex h-11 min-w-0 cursor-pointer flex-col items-center justify-center rounded-lg border text-[10px] sm:h-14 sm:rounded-xl md:h-16 ${color}`}
                onClick={() => setSelectedDay(day)}
              >
                <span
                  className={cn(
                    'text-[11px] font-bold sm:text-sm',
                    isToday ? 'text-blue-500' : day.isFuture ? 'text-muted-foreground/70' : 'text-foreground/90'
                  )}
                >
                  {day.date.getDate()}
                </span>

                {/* Amounts are tablet/desktop detail. A phone column cannot hold a legible figure,
                    so it carries a presence dot instead and the exact numbers stay one tap away. */}
                {metric.value !== undefined ? (
                  <span
                    className={cn(
                      'hidden max-w-full truncate text-[8px] font-bold leading-tight md:inline md:text-[10px]',
                      TONE_CLASS[metric.tone]
                    )}
                  >
                    {props.formatNet(metric.value)}
                  </span>
                ) : day.isFuture && day.projectedBillsAmount > 0 ? (
                  <span className="hidden max-w-full truncate text-[8px] font-medium leading-tight text-amber-500/90 md:inline md:text-[9px]">
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
                        'absolute top-1 right-1 flex size-3 items-center justify-center rounded-full text-[7px] font-bold sm:size-3.5 sm:text-[8px]',
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

      {/* Weekly Pacing Breakdown */}
      <CycleWeeklyPacing
        weeks={calendar.weeks}
        mode={mode}
        formatAmount={props.formatNet}
      />

      {/* Day breakdown */}
      <CycleCalendarDaySheet
        day={selectedDay}
        isOpen={!!selectedDay}
        onClose={() => setSelectedDay(null)}
        onViewInLedger={props.onSelectDate}
        formatAmount={props.formatNet}
      />
    </div>
  )
}
