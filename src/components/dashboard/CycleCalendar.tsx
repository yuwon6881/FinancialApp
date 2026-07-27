import { m } from 'framer-motion'
import { useMemo } from 'react'
import type { ActiveRecurringPayment, Transaction } from '../../types'
import { buildCycleCalendar, formatCalendarDate } from '../../lib/cycleCalendar'

interface CycleCalendarProps {
  selectedMonth: string
  selectedYear: number
  cycleDay: number
  cycleLabel: string
  transactions: Transaction[]
  recurringPayments: ActiveRecurringPayment[]
  formatNet: (value: number) => React.ReactNode
  onSelectDate?: (date: string) => void
}

export function CycleCalendar(props: CycleCalendarProps) {
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
        <h3 className="text-base font-semibold text-foreground">Cycle Calendar</h3>
        <p className="text-[10px] text-muted-foreground mt-0.5">{props.cycleLabel}</p>
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
            const color = isToday
              ? 'border-blue-500 bg-blue-500/10 ring-2 ring-inset ring-blue-500'
              : hasNet
                ? positive ? 'bg-blue-500/8 border-blue-500/20' : 'bg-orange-500/8 border-orange-500/20'
                : 'bg-muted/5 border-border/40 hover:bg-muted/20'
            const label = day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            return (
              <m.button
                type="button"
                key={day.dateKey}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: index * 0.01 }}
                whileTap={{ scale: 0.95 }}
                title={`${label}${hasNet ? `: ${day.net! >= 0 ? '+' : ''}${day.net!.toFixed(2)}` : ''}${day.recurringNames.length ? `\nBills: ${day.recurringNames.join(', ')}` : ''}`}
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
