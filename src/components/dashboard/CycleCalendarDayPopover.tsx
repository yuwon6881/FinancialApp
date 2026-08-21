import React, { useEffect, useRef } from 'react'
import { Clock, ExternalLink, X } from 'lucide-react'
import type { CycleCalendarDay } from '../../lib/cycleCalendar'
import { AnchoredPopover } from '../ui/AnchoredPopover'
import { Button } from '../ui/Button'
import { cn } from '../../lib/utils'

interface CycleCalendarDayPopoverProps {
  day: CycleCalendarDay | null
  isOpen: boolean
  anchorRef: React.RefObject<HTMLElement | null>
  onClose: () => void
  onViewInLedger?: (dateKey: string) => void
  formatAmount: (value: number) => React.ReactNode
}

export const CycleCalendarDayPopover: React.FC<CycleCalendarDayPopoverProps> = ({
  day,
  isOpen,
  anchorRef,
  onClose,
  onViewInLedger,
  formatAmount,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleClickOutside, true)
    document.addEventListener('touchstart', handleClickOutside, true)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleClickOutside, true)
      document.removeEventListener('touchstart', handleClickOutside, true)
    }
  }, [isOpen, onClose, anchorRef])

  if (!day || !isOpen) return null

  const formattedDateTitle = day.date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <AnchoredPopover
      ref={popoverRef}
      open={isOpen}
      anchorRef={anchorRef}
      side="auto"
      align="left"
      gap={8}
      minWidth={280}
      className="z-50 w-80 max-w-[calc(100vw-1.5rem)] rounded-2xl border border-border/80 bg-card/98 p-4 shadow-xl backdrop-blur-md"
    >
      <div className="flex items-start justify-between gap-2 border-b border-border/50 pb-2.5">
        <div>
          <div className="flex items-center gap-1.5">
            <h4 className="text-xs font-bold text-foreground sm:text-sm">{formattedDateTitle}</h4>
            {day.isToday && (
              <span className="rounded-full bg-blue-500/15 px-1.5 py-0.5 text-[9px] font-bold text-blue-500">
                Today
              </span>
            )}
            {day.isFuture && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                Upcoming
              </span>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">
            {day.isWeekend ? 'Weekend' : 'Weekday'} • {day.transactions.length} transaction{day.transactions.length === 1 ? '' : 's'}
          </p>
        </div>
        <Button
          variant="ghost"
          size="xs"
          className="size-7 p-0 text-muted-foreground hover:text-foreground"
          onClick={onClose}
          aria-label="Close day summary"
        >
          <X className="size-4" />
        </Button>
      </div>

      {/* Cashflow Summary Chips */}
      <div className="mt-3 grid grid-cols-3 gap-1.5 text-center text-[10px]">
        <div className="rounded-xl border border-border/40 bg-muted/20 p-1.5">
          <span className="block text-[9px] text-muted-foreground">Inflow</span>
          <span className="font-bold text-emerald-500">
            {day.inflow > 0 ? formatAmount(day.inflow) : '—'}
          </span>
        </div>
        <div className="rounded-xl border border-border/40 bg-muted/20 p-1.5">
          <span className="block text-[9px] text-muted-foreground">Outflow</span>
          <span className="font-bold text-orange-500">
            {day.outflow > 0 ? formatAmount(-day.outflow) : '—'}
          </span>
        </div>
        <div className="rounded-xl border border-border/40 bg-muted/20 p-1.5">
          <span className="block text-[9px] text-muted-foreground">Net</span>
          <span
            className={cn(
              'font-bold',
              day.net !== undefined && day.net > 0 && 'text-emerald-500',
              day.net !== undefined && day.net < 0 && 'text-orange-500',
              (day.net === undefined || day.net === 0) && 'text-muted-foreground'
            )}
          >
            {day.net !== undefined ? formatAmount(day.net) : '—'}
          </span>
        </div>
      </div>

      {/* Recurring Bills Section */}
      {day.recurring.length > 0 && (
        <div className="mt-3 border-t border-border/40 pt-2">
          <div className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold text-foreground">
            <Clock className="size-3 text-amber-500" />
            <span>Bills Due ({day.recurring.length})</span>
          </div>
          <div className="space-y-1 max-h-24 overflow-y-auto pr-0.5">
            {day.recurring.map((bill) => {
              const isSettled = bill.isPaid || bill.status === 'Paid' || bill.status === 'SettledByLoanPayoff'
              const isPartial = bill.status === 'PartiallyPaid'
              const amount = bill.remainingAmount ?? bill.scheduledAmount ?? bill.amount ?? 0

              return (
                <div
                  key={bill.id}
                  className="flex items-center justify-between rounded-lg border border-border/30 bg-muted/15 px-2 py-1 text-[10px]"
                >
                  <span className="truncate max-w-[130px] font-medium text-foreground">{bill.name}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-muted-foreground">{formatAmount(amount)}</span>
                    <span
                      className={cn(
                        'inline-flex items-center gap-0.5 rounded px-1 py-0.2 text-[8px] font-bold',
                        isSettled && 'bg-emerald-500/15 text-emerald-500',
                        isPartial && 'bg-amber-500/15 text-amber-500',
                        !isSettled && !isPartial && 'bg-blue-500/15 text-blue-500'
                      )}
                    >
                      {isSettled ? 'Paid' : isPartial ? 'Part' : 'Due'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Transactions Section */}
      <div className="mt-3 border-t border-border/40 pt-2">
        <div className="mb-1.5 flex items-center justify-between text-[10px] font-semibold text-foreground">
          <span>Transactions ({day.transactions.length})</span>
        </div>
        {day.transactions.length === 0 ? (
          <p className="py-2 text-center text-[10px] italic text-muted-foreground">
            {day.isFuture ? 'No upcoming transactions scheduled.' : 'No transactions recorded on this day.'}
          </p>
        ) : (
          <div className="space-y-1 max-h-28 overflow-y-auto pr-0.5">
            {day.transactions.map((tx) => {
              const isPositive = tx.amount >= 0
              return (
                <div
                  key={tx.id}
                  className="flex items-center justify-between rounded-lg border border-border/30 bg-muted/15 px-2 py-1 text-[10px]"
                >
                  <div className="min-w-0 pr-2">
                    <p className="truncate font-medium text-foreground">{tx.description}</p>
                    <p className="text-[8px] text-muted-foreground">{tx.category}</p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 font-bold',
                      isPositive ? 'text-emerald-500' : 'text-orange-500'
                    )}
                  >
                    {isPositive ? '+' : ''}
                    {formatAmount(tx.amount)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Drill-down Footer */}
      {onViewInLedger && (
        <div className="mt-3 border-t border-border/40 pt-2 flex items-center justify-end">
          <Button
            variant="outline"
            size="xs"
            className="w-full gap-1.5 text-[10px] font-bold sm:w-auto"
            onClick={() => {
              onViewInLedger(day.dateKey)
              onClose()
            }}
          >
            <span>View in Ledger</span>
            <ExternalLink className="size-3" />
          </Button>
        </div>
      )}
    </AnchoredPopover>
  )
}
