import { useEffect, useMemo, useState } from 'react'
import type React from 'react'
import type { ActiveRecurringPayment, Transaction } from '../../types'
import {
  buildCycleCalendar,
  formatCalendarDate,
  type CycleCalendarDay,
  type CycleWeekSummary,
} from '../../lib/cycleCalendar'
import { InfoHint } from '../ui/InfoHint'
import { SectionHeader } from '../ui/SectionHeader'
import { CycleCalendarDaySheet } from './CycleCalendarDaySheet'
import { CycleWeekRows } from './CycleWeekRows'
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
  onSelectWeek?: (week: CycleWeekSummary) => void
}

export function CycleCalendar(props: CycleCalendarProps) {
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

  // Rows of seven, Sunday first; the cycle's weeks are the same Sunday-to-Saturday rows, so each
  // row carries its own week's total.
  const rows = useMemo(() => {
    const cells: (CycleCalendarDay | null)[] = [
      ...Array.from({ length: calendar.startDayOfWeek }, () => null),
      ...calendar.days,
    ]
    while (cells.length % 7 !== 0) cells.push(null)
    return Array.from({ length: cells.length / 7 }, (_, index) => cells.slice(index * 7, index * 7 + 7))
  }, [calendar])

  return (
    <section id="report-section-calendar" aria-labelledby="report-calendar-heading" className="@container space-y-3">
      <SectionHeader
        titleId="report-calendar-heading"
        title={(
          <span className="flex items-center gap-1">
            Cycle calendar
            <InfoHint
              inline
              label="cycle calendar bars"
              text="Shows cashflow rhythms across this billing cycle, one row per week. Each bar is one day's spending, so busy days and upcoming bills stand out. Tap any day for its full breakdown."
            />
          </span>
        )}
        description={props.cycleLabel}
      />
      <div className={cn(panelClass, 'min-w-0 p-3 sm:p-5')}>
        <dl className="flex items-center justify-end gap-4 text-caption">
          <div>
            <dt className="text-muted-foreground">Zero-spend days</dt>
            <dd className="text-label text-foreground tabular-nums">{calendar.stats.noSpendDaysCount}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Average a day</dt>
            <dd className="text-label text-foreground tabular-nums">{props.formatNet(-Math.round(calendar.stats.averageDailySpend))}</dd>
          </div>
        </dl>

        <div className="mt-3">
          <CycleWeekRows
            rows={rows}
            weeks={calendar.weeks}
            today={today}
            hideSensitive={props.hideSensitive}
            formatNet={props.formatNet}
            onSelectDay={setSelectedDay}
            onSelectWeek={props.onSelectWeek}
          />
        </div>

        {/* One quiet legend line: what a bar means, and what the corner dot means. */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-caption text-muted-foreground">
          <p>{props.hideSensitive ? 'Bars are hidden while amounts are hidden.' : 'A taller bar means more spending that day'}</p>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-amber-500" aria-hidden="true" />Bill due</span>
            <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />Bill paid</span>
          </div>
        </div>
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
