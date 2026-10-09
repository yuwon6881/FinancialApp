import React from 'react'
import type { ActiveRecurringPayment } from '../../types'
import { getBillTimelineAmount, type BillTimelineModel } from '../../lib/billTimeline'
import { cn } from '../../lib/utils'
import { Button } from '../ui/Button'
import { panelClass } from '../ui/panelStyles'

interface BillDayStripProps {
  model: BillTimelineModel
  formatSensitive: (val: number) => React.ReactNode
  selectedDay: string | null
  onSelectDay: (day: string | null) => void
}

type DayTone = 'paid' | 'part' | 'overdue' | 'upcoming' | 'skipped'

const DOT: Record<DayTone, string> = {
  paid: 'bg-emerald-500',
  part: 'bg-primary',
  overdue: 'bg-red-500',
  upcoming: 'bg-muted-foreground/60',
  skipped: 'bg-muted-foreground/25',
}

const TONE_LABEL: Record<DayTone, string> = {
  paid: 'paid',
  part: 'part paid',
  overdue: 'overdue',
  upcoming: 'due',
  skipped: 'skipped',
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

const isoOf = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

function dayTone(bills: readonly ActiveRecurringPayment[], iso: string, todayIso: string): DayTone {
  const live = bills.filter(bill => bill.status !== 'Discarded')
  if (live.length === 0) return 'skipped'
  const settled = (bill: ActiveRecurringPayment) => bill.status === 'Paid' || bill.status === 'SettledByLoanPayoff'
  if (live.every(settled)) return 'paid'
  if (live.some(bill => settled(bill) || bill.status === 'PartiallyPaid')) return 'part'
  return iso < todayIso ? 'overdue' : 'upcoming'
}

/**
 * The cycle as a row of days, every day visible at once: a dot under each day a bill falls on,
 * coloured by whether it is paid. Tapping a day narrows the list below to that day's bills.
 */
export const BillDayStrip: React.FC<BillDayStripProps> = ({ model, formatSensitive, selectedDay, onSelectDay }) => {
  const scrollRef = React.useRef<HTMLOListElement>(null)
  const todayIso = isoOf(new Date())
  const nodesByDay = React.useMemo(() => new Map(model.timelineNodes.map(node => [node.dueDate, node])), [model.timelineNodes])
  const days = React.useMemo(() => {
    const list: Date[] = []
    const start = new Date(model.startTime)
    const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate())
    // A guard on the length keeps a malformed range from spinning.
    while (cursor.getTime() <= model.endTime && list.length < 40) {
      list.push(new Date(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }
    return list
  }, [model.endTime, model.startTime])

  // Start with today in view rather than the first day of the cycle.
  React.useEffect(() => {
    const rail = scrollRef.current
    const today = rail?.querySelector<HTMLElement>('[data-today]')
    if (!rail || !today) return
    rail.scrollLeft = Math.max(0, today.offsetLeft - rail.clientWidth / 2 + today.offsetWidth / 2)
  }, [days])

  const billCount = model.processedPayments.length

  return (
    <section aria-label="Bills this cycle" className={cn(panelClass, 'p-4 sm:p-5')}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex items-baseline gap-2">
          <h2 className="text-subsection text-foreground">This cycle</h2>
          <span className="text-caption text-muted-foreground tabular-nums">{model.startLabel} – {model.endLabel}</span>
        </div>
        <p className="text-label text-muted-foreground tabular-nums">
          {billCount} {billCount === 1 ? 'bill' : 'bills'}
          {' · '}
          <span className="font-semibold text-foreground">{model.cycleTotal == null ? 'Unavailable' : formatSensitive(model.cycleTotal)}</span>
        </p>
      </div>

      <ol
        ref={scrollRef}
        aria-label="Days in this cycle"
        // Focusable so the row can be scrolled from the keyboard even on a cycle with no bills.
        tabIndex={0}
        className="no-scrollbar rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring -mx-1 mt-3 grid auto-cols-[minmax(2.5rem,1fr)] grid-flow-col overflow-x-auto px-1 pb-1"
      >
        {days.map(date => {
          const iso = isoOf(date)
          const node = nodesByDay.get(iso)
          const isToday = iso === todayIso
          const isPast = iso < todayIso
          const isSelected = selectedDay === iso
          const tone = node ? dayTone(node.bills, iso, todayIso) : null
          const amounts = node?.bills.map(getBillTimelineAmount) ?? []
          const names = node?.bills.map(bill => bill.name).join(', ')
          const dateLabel = `${MONTHS[date.getMonth()]} ${date.getDate()}`
          return (
            <li key={iso} data-today={isToday || undefined} className="flex flex-col items-center gap-1">
              <span aria-hidden="true" className={cn('text-micro', isToday ? 'font-semibold text-foreground' : 'text-muted-foreground/80')}>
                {WEEKDAYS[date.getDay()]}
              </span>
              {node && tone ? (
                <Button
                  variant="tertiary"
                  size="icon"
                  aria-pressed={isSelected}
                  aria-label={`${dateLabel}: ${names}, ${TONE_LABEL[tone]}${amounts.length > 1 ? ` (${amounts.length} bills)` : ''}`}
                  onClick={() => onSelectDay(isSelected ? null : iso)}
                  className={cn(
                    'size-10 rounded-full p-0 text-label font-semibold tabular-nums lg:size-10',
                    isSelected
                      ? 'bg-foreground text-background hover:bg-foreground/90'
                      : 'bg-surface-2 text-foreground hover:bg-surface-3 dark:bg-surface-3 dark:hover:bg-surface-3/70',
                    isToday && !isSelected && 'ring-2 ring-foreground/70 ring-inset',
                  )}
                >
                  {date.getDate()}
                </Button>
              ) : (
                <span
                  aria-hidden="true"
                  className={cn(
                    'grid size-10 place-items-center rounded-full text-label tabular-nums',
                    isToday ? 'font-semibold text-foreground ring-2 ring-foreground/70 ring-inset' : isPast ? 'text-muted-foreground' : 'text-foreground/80',
                  )}
                >
                  {date.getDate()}
                </span>
              )}
              <span aria-hidden="true" className="flex h-1.5 items-center gap-0.5">
                {node && tone && node.bills.slice(0, 3).map(bill => (
                  <span key={bill.id} className={cn('size-1.5 rounded-full', DOT[tone])} />
                ))}
              </span>
            </li>
          )
        })}
      </ol>

      <ul aria-label="Colour key" className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted-foreground">
        {(['paid', 'part', 'upcoming', 'overdue'] as const).map(tone => (
          <li key={tone} className="flex items-center gap-1.5">
            <span aria-hidden="true" className={cn('size-1.5 rounded-full', DOT[tone])} />
            {TONE_LABEL[tone].replace(/^./, letter => letter.toUpperCase())}
          </li>
        ))}
      </ul>
    </section>
  )
}
