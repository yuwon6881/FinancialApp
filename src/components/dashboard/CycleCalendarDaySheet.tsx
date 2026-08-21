import React from 'react'
import { Clock, ExternalLink } from 'lucide-react'
import type { CycleCalendarDay } from '../../lib/cycleCalendar'
import { BottomSheet } from '../ui/BottomSheet'
import { Button } from '../ui/Button'
import { cn } from '../../lib/utils'

interface CycleCalendarDaySheetProps {
  day: CycleCalendarDay | null
  isOpen: boolean
  onClose: () => void
  onViewInLedger?: (dateKey: string) => void
  formatAmount: (value: number) => React.ReactNode
}

/**
 * The day breakdown is a modal sheet rather than an anchored popover: it reuses the shared
 * scroll lock, focus trap and back-button handling, so the page behind can no longer scroll out
 * from under an open day on touch.
 */
export const CycleCalendarDaySheet: React.FC<CycleCalendarDaySheetProps> = ({
  day,
  isOpen,
  onClose,
  onViewInLedger,
  formatAmount,
}) => {
  if (!day) return null

  const formattedDateTitle = day.date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  const title = (
    <span className="flex flex-wrap items-center gap-1.5">
      <span>{formattedDateTitle}</span>
      {day.isToday && (
        <span className="rounded-full bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-bold text-blue-500">
          Today
        </span>
      )}
      {day.isFuture && (
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          Upcoming
        </span>
      )}
    </span>
  )

  const description = `${day.isWeekend ? 'Weekend' : 'Weekday'} • ${day.transactions.length} transaction${day.transactions.length === 1 ? '' : 's'}`

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      ariaLabel={`${formattedDateTitle} day summary`}
      description={description}
      maxWidthClassName="max-w-md"
      footer={onViewInLedger ? (
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-1.5 text-xs font-bold"
          onClick={() => {
            onViewInLedger(day.dateKey)
            onClose()
          }}
        >
          <span>View in Ledger</span>
          <ExternalLink className="size-3.5" />
        </Button>
      ) : undefined}
    >
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-xl border border-border/40 bg-muted/20 p-2">
          <span className="block text-[10px] text-muted-foreground">Money in</span>
          <span className="font-bold text-emerald-500">
            {day.inflow > 0 ? formatAmount(day.inflow) : '—'}
          </span>
        </div>
        <div className="rounded-xl border border-border/40 bg-muted/20 p-2">
          <span className="block text-[10px] text-muted-foreground">Money out</span>
          <span className="font-bold text-orange-500">
            {day.outflow > 0 ? formatAmount(-day.outflow) : '—'}
          </span>
        </div>
        <div className="rounded-xl border border-border/40 bg-muted/20 p-2">
          <span className="block text-[10px] text-muted-foreground">Net</span>
          <span
            className={cn(
              'font-bold',
              day.net !== undefined && day.net > 0 && 'text-emerald-500',
              day.net !== undefined && day.net < 0 && 'text-orange-500',
              (day.net === undefined || day.net === 0) && 'text-muted-foreground',
            )}
          >
            {day.net !== undefined ? formatAmount(day.net) : '—'}
          </span>
        </div>
      </div>

      {day.recurring.length > 0 && (
        <div className="border-t border-border/40 pt-3">
          <div className="mb-2 flex items-center gap-1 text-xs font-semibold text-foreground">
            <Clock className="size-3.5 text-amber-500" />
            <span>Bills due ({day.recurring.length})</span>
          </div>
          <div className="max-h-40 space-y-1 overflow-y-auto pr-0.5">
            {day.recurring.map((bill) => {
              const isSettled = bill.isPaid || bill.status === 'Paid' || bill.status === 'SettledByLoanPayoff'
              const isPartial = bill.status === 'PartiallyPaid'
              // A settled bill has nothing remaining, so leading with `remainingAmount` showed
              // every paid bill as zero. Show what was actually settled there, and what is still
              // owed only while the bill is outstanding.
              // A loan payoff settles its occurrence with no tagged transaction of its own, so a
              // zero paid figure there still falls back to what the bill was scheduled for.
              const settledAmount = bill.paidAmount && bill.paidAmount > 0 ? bill.paidAmount : null
              const amount = isSettled
                ? settledAmount ?? bill.scheduledAmount ?? bill.amount
                : bill.remainingAmount ?? bill.scheduledAmount ?? bill.amount

              return (
                <div
                  key={bill.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border/30 bg-muted/15 px-2 py-1.5 text-xs"
                >
                  <span className="min-w-0 flex-1 truncate font-medium text-foreground">{bill.name}</span>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {/* An occurrence with no scheduled amount is genuinely unknown, not zero. */}
                    <span className="font-bold text-muted-foreground">
                      {amount == null ? 'Amount not set' : formatAmount(-Math.abs(amount))}
                    </span>
                    <span
                      className={cn(
                        'inline-flex items-center rounded px-1 py-0.5 text-[9px] font-bold',
                        isSettled && 'bg-emerald-500/15 text-emerald-500',
                        isPartial && 'bg-amber-500/15 text-amber-500',
                        !isSettled && !isPartial && 'bg-blue-500/15 text-blue-500',
                      )}
                    >
                      {isSettled ? 'Paid' : isPartial ? 'Part paid' : 'Due'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="border-t border-border/40 pt-3">
        <div className="mb-2 text-xs font-semibold text-foreground">
          Transactions ({day.transactions.length})
        </div>
        {day.transactions.length === 0 ? (
          <p className="py-2 text-center text-xs italic text-muted-foreground">
            {day.isFuture ? 'No upcoming transactions scheduled.' : 'No transactions recorded on this day.'}
          </p>
        ) : (
          <div className="max-h-52 space-y-1 overflow-y-auto pr-0.5">
            {day.transactions.map((tx) => {
              const isPositive = tx.amount >= 0
              return (
                <div
                  key={tx.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border/30 bg-muted/15 px-2 py-1.5 text-xs"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{tx.description}</p>
                    <p className="text-[10px] text-muted-foreground">{tx.category}</p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 font-bold',
                      isPositive ? 'text-emerald-500' : 'text-orange-500',
                    )}
                  >
                    {formatAmount(tx.amount)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </BottomSheet>
  )
}
