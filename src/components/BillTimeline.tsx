import React, { useState } from 'react'
import type { ActiveRecurringPayment } from '../types'
import { Calendar, CheckCircle2, AlertCircle, X, Ban } from 'lucide-react'
import { formatCurrencyVal } from '../lib/utils'

interface BillTimelineProps {
  activeRecurringPayments: ActiveRecurringPayment[]
  selectedMonth: string
  selectedYear: number
  cycleDay: number
  currency?: string
  hideSensitive: boolean
  onConfirmSubscription?: (noti: any, paidDate: string) => void
  onDiscardSubscription?: (noti: any) => void
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function getCycleRangeDates(year: number, monthIndex: number, cycleDay: number): { start: Date; end: Date } {
  if (cycleDay === 1) {
    const start = new Date(year, monthIndex - 1, 1)
    const end = new Date(year, monthIndex, 0)
    return { start, end }
  }
  const start = new Date(year, monthIndex - 1, cycleDay)
  const end = new Date(year, monthIndex, cycleDay - 1)
  return { start, end }
}

function getDaySuffix(d: number) {
  if (d >= 11 && d <= 13) return 'th'
  switch (d % 10) {
    case 1: return 'st'
    case 2: return 'nd'
    case 3: return 'rd'
    default: return 'th'
  }
}

export const BillTimeline: React.FC<BillTimelineProps> = ({
  activeRecurringPayments,
  selectedMonth,
  selectedYear,
  cycleDay,
  currency = 'USD',
  hideSensitive,
  onConfirmSubscription,
  onDiscardSubscription
}) => {
  const [selectedBill, setSelectedBill] = useState<ActiveRecurringPayment | null>(null)
  const [payDateInput, setPayDateInput] = useState('')

  // Determine current month index (0-11)
  const monthIndex = MONTH_NAMES.indexOf(selectedMonth) !== -1 ? MONTH_NAMES.indexOf(selectedMonth) : new Date().getMonth()
  const year = selectedYear > 0 ? selectedYear : new Date().getFullYear()

  // Cycle range dates
  const { start: cycleStart, end: cycleEnd } = getCycleRangeDates(year, monthIndex + 1, cycleDay)

  const startTime = cycleStart.getTime()
  const endTime = cycleEnd.getTime()
  const durationMs = endTime - startTime

  // Format date labels
  const startMonthStr = MONTH_NAMES[cycleStart.getMonth()]
  const endMonthStr = MONTH_NAMES[cycleEnd.getMonth()]
  const startLabel = `${startMonthStr} ${cycleStart.getDate()}${getDaySuffix(cycleStart.getDate())}`
  const endLabel = `${endMonthStr} ${cycleEnd.getDate()}${getDaySuffix(cycleEnd.getDate())}`

  const formatCurrency = (val: number) => {
    return formatCurrencyVal(val, currency)
  }

  const formatSensitive = (val: number) => {
    return (
      <span className={hideSensitive ? 'blur-xs select-none pointer-events-none' : ''}>
        {formatCurrency(val)}
      </span>
    )
  }

  // Map and sort active bills by their due date time
  const timelineBills = activeRecurringPayments
    .map(p => {
      const dueTime = new Date(p.dueDate).getTime()
      // Calculate relative position (0% to 100%)
      let percent = durationMs > 0 ? ((dueTime - startTime) / durationMs) * 100 : 0
      // Bound
      percent = Math.max(0, Math.min(100, percent))
      return {
        ...p,
        dueTime,
        percent
      }
    })
    .sort((a, b) => a.dueTime - b.dueTime)

  return (
    <div className="p-6 rounded-2xl bg-card border border-border/60 shadow-xs space-y-6">
      <div className="flex items-center justify-between border-b border-border/30 pb-3">
        <div className="flex items-center gap-2">
          <Calendar className="size-5 text-blue-500" />
          <h3 className="text-sm font-bold text-foreground">Subscriptions Billing Timeline</h3>
        </div>
        <div className="text-[10px] text-muted-foreground font-semibold bg-muted/50 px-2 py-1 rounded-lg">
          Cycle: {selectedMonth} {year}
        </div>
      </div>

      {/* Visual Timeline Section */}
      <div className="relative pt-12 pb-14 px-6 bg-muted/15 rounded-xl border border-border/20">
        
        {/* Cycle boundary labels */}
        <div className="absolute top-2 left-6 text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">
          Cycle Start ({startLabel})
        </div>
        <div className="absolute top-2 right-6 text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider text-right">
          Cycle End ({endLabel})
        </div>

        {/* The horizontal line */}
        <div className="relative h-1.5 bg-muted rounded-full">
          {/* Progress bar to show today's position */}
          {(() => {
            const todayTime = new Date().getTime()
            if (todayTime >= startTime && todayTime <= endTime) {
              const todayPct = ((todayTime - startTime) / durationMs) * 100
              return (
                <div 
                  className="absolute left-0 top-0 h-full bg-blue-500/30 rounded-full"
                  style={{ width: `${todayPct}%` }}
                />
              )
            }
            return null
          })()}

          {/* Render subscription nodes */}
          {timelineBills.map((bill, index) => {
            const isPaid = bill.status === 'Paid'
            const isDiscarded = bill.status === 'Discarded'
            const isTop = index % 2 === 0 // Alternate label positions up/down

            let dotColor = 'bg-amber-500 ring-amber-500/20'
            if (isPaid) dotColor = 'bg-green-500 ring-green-500/20'
            if (isDiscarded) dotColor = 'bg-slate-400 ring-slate-400/20'

            const formattedDueDay = new Date(bill.dueDate).getDate()

            return (
              <div
                key={bill.id}
                style={{ left: `${bill.percent}%` }}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 group z-10"
              >
                {/* Node trigger dot */}
                <button
                  onClick={() => {
                    setSelectedBill(bill)
                    setPayDateInput(bill.dueDate)
                  }}
                  className={`size-3.5 rounded-full border border-card ${dotColor} hover:scale-125 focus:scale-125 focus:ring-4 active:scale-95 transition duration-150 shadow-md cursor-pointer`}
                  title={`${bill.name} - Due: ${bill.dueDate}`}
                />

                {/* Alternating Labels */}
                <div 
                  className={`absolute left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none select-none ${
                    isTop ? 'bottom-full mb-2.5' : 'top-full mt-2.5'
                  }`}
                >
                  {/* Small line connector */}
                  <div className={`w-[1px] h-2.5 bg-border/80 ${isTop ? 'order-last' : 'order-first'}`} />
                  
                  {/* Info Badge */}
                  <span className={`px-2 py-0.75 rounded-md text-[9px] font-bold text-foreground border border-border bg-card whitespace-nowrap shadow-xs flex items-center gap-1 ${
                    isDiscarded ? 'line-through opacity-60 text-muted-foreground' : ''
                  }`}>
                    <span>{bill.name}</span>
                    <span className="text-muted-foreground font-semibold">({formattedDueDay})</span>
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {timelineBills.length === 0 && (
        <div className="text-xs text-muted-foreground text-center py-6">
          No active subscriptions scheduled for this cycle.
        </div>
      )}

      {/* Bill Detail / Quick Action Modal Overlay */}
      {selectedBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-card border border-border/80 rounded-2xl shadow-2xl p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div className="flex items-center gap-2">
                <span className={`p-1.5 rounded-lg ${
                  selectedBill.status === 'Paid' 
                    ? 'bg-green-500/10 text-green-500' 
                    : selectedBill.status === 'Discarded' 
                      ? 'bg-slate-500/10 text-slate-400' 
                      : 'bg-amber-500/10 text-amber-500'
                }`}>
                  {selectedBill.status === 'Paid' ? (
                    <CheckCircle2 className="size-4" />
                  ) : selectedBill.status === 'Discarded' ? (
                    <Ban className="size-4" />
                  ) : (
                    <AlertCircle className="size-4" />
                  )}
                </span>
                <h3 className="text-sm font-bold text-foreground">{selectedBill.name}</h3>
              </div>
              <button
                onClick={() => setSelectedBill(null)}
                className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="text-xs space-y-3 font-semibold text-foreground">
              <div className="grid grid-cols-2 gap-3.5 bg-muted/30 p-3 rounded-xl">
                <div>
                  <span className="text-[9px] text-muted-foreground block font-normal uppercase tracking-wider mb-0.5">Amount Due</span>
                  <span className="text-base font-extrabold text-foreground">{formatSensitive(Math.abs(selectedBill.amount))}</span>
                </div>
                <div>
                  <span className="text-[9px] text-muted-foreground block font-normal uppercase tracking-wider mb-0.5">Status</span>
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold mt-1 ${
                    selectedBill.status === 'Paid' 
                      ? 'bg-green-500/10 text-green-500' 
                      : selectedBill.status === 'Discarded' 
                        ? 'bg-slate-500/10 text-slate-400 line-through' 
                        : 'bg-amber-500/10 text-amber-500'
                  }`}>{selectedBill.status}</span>
                </div>
                <div>
                  <span className="text-[9px] text-muted-foreground block font-normal uppercase tracking-wider mb-0.5">Due Date</span>
                  <span className="text-xs text-foreground font-bold">{selectedBill.dueDate}</span>
                </div>
                <div>
                  <span className="text-[9px] text-muted-foreground block font-normal uppercase tracking-wider mb-0.5">Main Category</span>
                  <span className="text-xs text-foreground font-bold">{selectedBill.ledgerCategory} / {selectedBill.category}</span>
                </div>
              </div>

              {selectedBill.status === 'Paid' && selectedBill.paidDate && (
                <div className="p-3 bg-green-500/5 border border-green-500/10 rounded-xl text-[10px] text-green-500 font-normal">
                  Paid on: <span className="font-bold">{selectedBill.paidDate}</span>
                </div>
              )}

              {/* Action Form inside details modal */}
              {selectedBill.status === 'Pending' && (
                <div className="space-y-3.5 pt-2 border-t border-border/20">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Payment Confirmation Date</label>
                    <input
                      type="date"
                      value={payDateInput}
                      onChange={e => setPayDateInput(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex gap-2 justify-end pt-1">
                    {onDiscardSubscription && (
                      <button
                        onClick={() => {
                          onDiscardSubscription({
                            id: selectedBill.id,
                            recurringPaymentId: selectedBill.recurringPaymentId,
                            name: selectedBill.name,
                            amount: selectedBill.amount,
                            category: selectedBill.category,
                            ledgerCategory: selectedBill.ledgerCategory,
                            billingDate: selectedBill.dueDate
                          })
                          setSelectedBill(null)
                        }}
                        className="px-3.5 py-2 bg-slate-500/10 hover:bg-slate-500/20 text-slate-400 font-bold text-xs rounded-xl transition duration-150 cursor-pointer"
                        title="Mark this month's bill as discarded"
                      >
                        Discard Month
                      </button>
                    )}
                    
                    {onConfirmSubscription && (
                      <button
                        onClick={() => {
                          onConfirmSubscription({
                            id: selectedBill.id,
                            recurringPaymentId: selectedBill.recurringPaymentId,
                            name: selectedBill.name,
                            amount: selectedBill.amount,
                            category: selectedBill.category,
                            ledgerCategory: selectedBill.ledgerCategory,
                            billingDate: selectedBill.dueDate
                          }, payDateInput)
                          setSelectedBill(null)
                        }}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition duration-150 cursor-pointer shadow-md shadow-blue-600/10"
                      >
                        Confirm Paid
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
