import { m, useReducedMotion } from 'framer-motion'
import { useMemo, useRef, useState } from 'react'
import type { ActiveRecurringPayment, Transaction } from '../../types'
import {
  buildCycleCalendar,
  formatCalendarDate,
  type CycleCalendarDay,
  type CycleHeatmapMode,
} from '../../lib/cycleCalendar'
import { InfoHint } from '../ui/InfoHint'
import { Button } from '../ui/Button'
import { CycleCalendarDayPopover } from './CycleCalendarDayPopover'
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

export function CycleCalendar(props: CycleCalendarProps) {
  const reduceMotion = useReducedMotion()
  const [mode, setMode] = useState<CycleHeatmapMode>('expense')
  const [selectedDay, setSelectedDay] = useState<CycleCalendarDay | null>(null)
  const activeAnchorRef = useRef<HTMLElement | null>(null)

  const calendar = useMemo(() => buildCycleCalendar({
    selectedMonth: props.selectedMonth,
    selectedYear: props.selectedYear,
    cycleDay: props.cycleDay,
    transactions: props.transactions,
    recurringPayments: props.recurringPayments,
  }), [props.selectedMonth, props.selectedYear, props.cycleDay, props.transactions, props.recurringPayments])

  const today = formatCalendarDate(new Date())

  return (
    <div className="app-panel h-full rounded-2xl border border-border/60 bg-card/92 p-4 sm:p-6">
      {/* Header */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-1">
            <h3 className="text-base font-semibold text-foreground">Cycle Calendar</h3>
            <InfoHint
              label="cycle calendar shading"
              text="Shows cashflow rhythms across this billing cycle. Toggle between Spending, Net Flow, and Gross Activity to spot trends and upcoming bills."
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">{props.cycleLabel}</p>
        </div>

        {/* Heatmap Mode Selector */}
        <div className="flex items-center gap-1 rounded-xl border border-border/60 bg-muted/25 p-1 self-start">
          <Button
            size="xs"
            variant={mode === 'expense' ? 'primary' : 'ghost'}
            className={cn('h-6 px-2 text-[10px]', mode !== 'expense' && 'text-muted-foreground hover:text-foreground')}
            onClick={() => setMode('expense')}
            aria-pressed={mode === 'expense'}
          >
            Spending
          </Button>
          <Button
            size="xs"
            variant={mode === 'net' ? 'primary' : 'ghost'}
            className={cn('h-6 px-2 text-[10px]', mode !== 'net' && 'text-muted-foreground hover:text-foreground')}
            onClick={() => setMode('net')}
            aria-pressed={mode === 'net'}
          >
            Net Flow
          </Button>
          <Button
            size="xs"
            variant={mode === 'activity' ? 'primary' : 'ghost'}
            className={cn('h-6 px-2 text-[10px]', mode !== 'activity' && 'text-muted-foreground hover:text-foreground')}
            onClick={() => setMode('activity')}
            aria-pressed={mode === 'activity'}
          >
            Activity
          </Button>
        </div>
      </div>

      {/* Legend & Summary Subtitle */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2.5">
        {props.hideSensitive ? (
          <p className="text-[10px] font-medium text-muted-foreground">Activity shading is hidden while amounts are hidden.</p>
        ) : mode === 'net' ? (
          <div aria-label="Cash activity heat scale" className="flex items-center gap-1.5 text-[9px] font-medium text-muted-foreground sm:text-[10px]">
            <span>Net outflow</span>
            <span className="size-3 rounded-sm border" style={heatStyle(3, 'net', -100)} aria-hidden="true" />
            <span className="size-3 rounded-sm border" style={heatStyle(1, 'net', -10)} aria-hidden="true" />
            <span className="size-3 rounded-sm border border-border/60 bg-muted/20" aria-hidden="true" />
            <span className="size-3 rounded-sm border" style={heatStyle(1, 'net', 10)} aria-hidden="true" />
            <span className="size-3 rounded-sm border" style={heatStyle(3, 'net', 100)} aria-hidden="true" />
            <span>Net inflow</span>
          </div>
        ) : (
          <div aria-label="Cash activity heat scale" className="flex items-center gap-1.5 text-[9px] font-medium text-muted-foreground sm:text-[10px]">
            <span>{mode === 'expense' ? 'Less spending' : 'Less activity'}</span>
            {([1, 2, 3, 4] as const).map(level => (
              <span key={level} className="size-3 rounded-sm border" style={heatStyle(level, mode)} aria-hidden="true" />
            ))}
            <span>{mode === 'expense' ? 'More spending' : 'More activity'}</span>
          </div>
        )}

        <div className="flex items-center gap-2 text-[9px] font-medium text-muted-foreground sm:text-[10px]">
          <span>{calendar.stats.noSpendDaysCount} zero-spend days</span>
          <span>•</span>
          <span>Avg: {props.formatNet(-Math.round(calendar.stats.averageDailySpend))}/day</span>
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
                  'pb-1.5 text-[9px] font-bold sm:text-xs',
                  isWeekendHeader ? 'text-muted-foreground/70' : 'text-muted-foreground'
                )}
              >
                {day}
              </div>
            )
          })}
          {Array.from({ length: calendar.startDayOfWeek }).map((_, index) => <div key={`empty-${index}`} />)}
          {calendar.days.map((day, index) => {
            const hasNet = day.net !== undefined
            const positive = hasNet && day.net! >= 0
            const isToday = day.dateKey === today
            const activeHeatLevel = day.heatLevels[mode]
            const visibleHeatLevel = props.hideSensitive ? 0 : activeHeatLevel

            const color = isToday
              ? 'border-blue-500 ring-2 ring-inset ring-blue-500 bg-card'
              : day.isFuture
                ? 'border-dashed border-border/50 bg-muted/5 opacity-80 hover:opacity-100 hover:border-border'
                : visibleHeatLevel > 0
                  ? 'border-border/50 hover:brightness-110'
                  : day.isWeekend
                    ? 'bg-muted/10 border-border/40 hover:bg-muted/25'
                    : 'bg-muted/5 border-border/40 hover:bg-muted/20'

            const label = day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            const activityLabel = props.hideSensitive ? 'Cash activity hidden' : HEAT_LABELS[visibleHeatLevel]
            const billsLabel = day.recurringNames.length ? ` Bills due: ${day.recurringNames.join(', ')}.` : ''
            const futureLabel = day.isFuture ? ' (Upcoming)' : ''

            return (
              <m.button
                type="button"
                key={day.dateKey}
                initial={reduceMotion ? false : { opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.3, delay: index * 0.01 }}
                whileTap={reduceMotion ? undefined : { scale: 0.95 }}
                title={`${label}${futureLabel}: ${activityLabel}.${billsLabel}`}
                aria-label={`${label}${futureLabel}. ${activityLabel}.${billsLabel}`}
                style={heatStyle(visibleHeatLevel, mode, day.net)}
                className={`relative flex h-11 min-w-0 flex-col items-center justify-center rounded-lg border text-[10px] cursor-pointer sm:h-14 sm:rounded-xl md:h-16 ${color}`}
                onClick={(e) => {
                  activeAnchorRef.current = e.currentTarget
                  setSelectedDay(day)
                }}
              >
                <span
                  className={cn(
                    'text-[11px] font-bold sm:text-sm',
                    isToday ? 'text-blue-500' : day.isFuture ? 'text-muted-foreground' : 'text-foreground/90'
                  )}
                >
                  {day.date.getDate()}
                </span>

                {/* Amount display */}
                {hasNet ? (
                  <span
                    className={cn(
                      'max-w-full truncate text-[7px] font-bold leading-tight sm:text-[8px] md:text-[10px]',
                      positive ? 'text-blue-500' : 'text-orange-500'
                    )}
                  >
                    {props.formatNet(day.net!)}
                  </span>
                ) : day.isFuture && day.projectedBillsAmount > 0 ? (
                  <span className="max-w-full truncate text-[7px] font-medium leading-tight text-amber-500/90 sm:text-[8px] md:text-[9px]">
                    ~{props.formatNet(-day.projectedBillsAmount)}
                  </span>
                ) : null}

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
        formatAmount={props.formatNet}
      />

      {/* Day Preview Popover */}
      <CycleCalendarDayPopover
        day={selectedDay}
        isOpen={!!selectedDay}
        anchorRef={activeAnchorRef}
        onClose={() => setSelectedDay(null)}
        onViewInLedger={props.onSelectDate}
        formatAmount={props.formatNet}
      />
    </div>
  )
}
