import { m, useReducedMotion } from 'framer-motion'
import { useMemo } from 'react'
import type { ActiveRecurringPayment, Transaction } from '../../types'
import { buildCycleCalendar, formatCalendarDate } from '../../lib/cycleCalendar'
import { InfoHint } from '../ui/InfoHint'

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

const heatStyle = (level: HeatLevel) => level === 0 ? undefined : {
  backgroundColor: `color-mix(in srgb, var(--ledger-purple-500) ${HEAT_PERCENT[level]}%, var(--card))`,
  borderColor: `color-mix(in srgb, var(--ledger-purple-500) ${Math.min(60, HEAT_PERCENT[level] + 12)}%, var(--border))`,
}

export function CycleCalendar(props: CycleCalendarProps) {
  const reduceMotion = useReducedMotion()
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
      <div className="mb-4">
        <div className="flex items-center gap-1">
          <h3 className="text-base font-semibold text-foreground">Cycle Calendar</h3>
          <InfoHint
            label="cycle calendar shading"
            text="Darker days had more cash moving in or out. The scale is relative to the busiest day in this cycle; transfers and balance corrections are not counted."
          />
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">{props.cycleLabel}</p>
        {props.hideSensitive ? (
          <p className="mt-2 text-[10px] font-medium text-muted-foreground">Activity shading is hidden while amounts are hidden.</p>
        ) : (
          <div aria-label="Cash activity heat scale" className="mt-2 flex items-center gap-1.5 text-[9px] font-medium text-muted-foreground sm:text-[10px]">
            <span>Less activity</span>
            {([1, 2, 3, 4] as const).map(level => (
              <span key={level} className="size-3 rounded-sm border" style={heatStyle(level)} aria-hidden="true" />
            ))}
            <span>More activity</span>
          </div>
        )}
      </div>
      <div className="px-0.5 py-1 sm:px-1">
        <div aria-label="Cycle days" className="grid w-full min-w-0 grid-cols-[repeat(7,minmax(0,1fr))] gap-1 text-center sm:gap-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="pb-2 text-[9px] font-bold text-muted-foreground sm:text-xs">{day}</div>
          ))}
          {Array.from({ length: calendar.startDayOfWeek }).map((_, index) => <div key={`empty-${index}`} />)}
          {calendar.days.map((day, index) => {
            const hasNet = day.net !== undefined
            const positive = hasNet && day.net! >= 0
            const isToday = day.dateKey === today
            const visibleHeatLevel = props.hideSensitive ? 0 : day.heatLevel
            const color = isToday
              ? 'border-blue-500 ring-2 ring-inset ring-blue-500'
              : visibleHeatLevel > 0
                ? 'border-border/50 hover:brightness-110'
                : 'bg-muted/5 border-border/40 hover:bg-muted/20'
            const label = day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            const activityLabel = props.hideSensitive ? 'Cash activity hidden' : HEAT_LABELS[visibleHeatLevel]
            const billsLabel = day.recurringNames.length ? ` Bills due: ${day.recurringNames.join(', ')}.` : ''
            return (
              <m.button
                type="button"
                key={day.dateKey}
                initial={reduceMotion ? false : { opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.3, delay: index * 0.01 }}
                whileTap={reduceMotion ? undefined : { scale: 0.95 }}
                title={`${label}: ${activityLabel}.${billsLabel}`}
                aria-label={`${label}. ${activityLabel}.${billsLabel}`}
                style={heatStyle(visibleHeatLevel)}
                className={`relative flex h-11 min-w-0 flex-col items-center justify-center rounded-lg border text-[10px] cursor-pointer sm:h-14 sm:rounded-xl md:h-16 ${color}`}
                onClick={() => props.onSelectDate?.(day.dateKey)}
              >
                <span className={`text-[11px] font-bold sm:text-sm ${isToday ? 'text-blue-500' : 'text-foreground/90'}`}>{day.date.getDate()}</span>
                {hasNet && <span className={`max-w-full truncate text-[7px] font-bold leading-tight sm:text-[8px] md:text-[10px] ${positive ? 'text-blue-500' : 'text-orange-500'}`}>{props.formatNet(day.net!)}</span>}
                {day.recurringNames.length > 0 && <span className="absolute top-1 right-1 size-1.5 rounded-full bg-blue-500 animate-pulse" />}
              </m.button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
