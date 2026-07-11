import { motion } from 'framer-motion'
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
    <div className="app-panel p-6 rounded-2xl bg-card/92 border border-border/60 h-full">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-foreground">Cycle Calendar</h3>
        <p className="text-[10px] text-muted-foreground mt-0.5">{props.cycleLabel}</p>
      </div>
      <div className="overflow-x-auto pb-4 -mx-6 px-6 sm:mx-0 sm:px-0 sm:overflow-visible">
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2 text-center min-w-[420px] sm:min-w-0">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-[10px] md:text-xs text-muted-foreground font-bold pb-2">{day}</div>
          ))}
          {Array.from({ length: calendar.startDayOfWeek }).map((_, index) => <div key={`empty-${index}`} />)}
          {calendar.days.map((day, index) => {
            const hasNet = day.net !== undefined
            const positive = hasNet && day.net! >= 0
            const isToday = day.dateKey === today
            const color = isToday
              ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-card bg-blue-500/10 border-blue-500/30'
              : hasNet
                ? positive ? 'bg-blue-500/8 border-blue-500/20' : 'bg-orange-500/8 border-orange-500/20'
                : 'bg-muted/5 border-border/40 hover:bg-muted/20'
            const label = day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            return (
              <motion.button
                type="button"
                key={day.dateKey}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: index * 0.01 }}
                whileTap={{ scale: 0.95 }}
                title={`${label}${hasNet ? `: ${day.net! >= 0 ? '+' : ''}${day.net!.toFixed(2)}` : ''}${day.recurringNames.length ? `\nBills: ${day.recurringNames.join(', ')}` : ''}`}
                className={`relative h-12 xs:h-14 md:h-16 rounded-xl flex flex-col items-center justify-center border text-[10px] ${color}`}
                onClick={() => props.onSelectDate?.(day.dateKey)}
              >
                <span className={`text-xs md:text-sm font-bold ${isToday ? 'text-blue-500' : 'text-foreground/90'}`}>{day.date.getDate()}</span>
                {hasNet && <span className={`text-[8px] sm:text-[10px] font-black ${positive ? 'text-blue-500' : 'text-orange-500'}`}>{props.formatNet(day.net!)}</span>}
                {day.recurringNames.length > 0 && <span className="absolute top-1 right-1 size-1.5 rounded-full bg-blue-500 animate-pulse" />}
              </motion.button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
