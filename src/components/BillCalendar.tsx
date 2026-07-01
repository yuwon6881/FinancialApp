import React, { useState } from 'react'
import type { ActiveRecurringPayment } from '../types'
import { Calendar, CheckCircle2, AlertCircle, X, Ban } from 'lucide-react'
import { formatCurrencyVal } from '../lib/utils'

interface BillCalendarProps {
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
const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export const BillCalendar: React.FC<BillCalendarProps> = ({
  activeRecurringPayments,
  selectedMonth,
  selectedYear,
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

  // Generate calendar grid
  const firstDay = new Date(year, monthIndex, 1).getDay()
  const totalDays = new Date(year, monthIndex + 1, 0).getDate()
  const prevTotalDays = new Date(year, monthIndex, 0).getDate()

  const gridCells: { day: number; dateStr: string; isCurrentMonth: boolean }[] = []

  // Prev month cells
  for (let i = firstDay - 1; i >= 0; i--) {
    const prevDay = prevTotalDays - i
    const prevMonthIdx = monthIndex === 0 ? 11 : monthIndex - 1
    const prevMonthYear = monthIndex === 0 ? year - 1 : year
    const dStr = `${prevMonthYear}-${String(prevMonthIdx + 1).padStart(2, '0')}-${String(prevDay).padStart(2, '0')}`
    gridCells.push({ day: prevDay, dateStr: dStr, isCurrentMonth: false })
  }

  // Current month cells
  for (let i = 1; i <= totalDays; i++) {
    const dStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
    gridCells.push({ day: i, dateStr: dStr, isCurrentMonth: true })
  }

  // Next month cells (pad to complete rows of 7)
  const totalCells = Math.ceil(gridCells.length / 7) * 7
  const nextMonthCellsNeeded = totalCells - gridCells.length
  for (let i = 1; i <= nextMonthCellsNeeded; i++) {
    const nextMonthIdx = monthIndex === 11 ? 0 : monthIndex + 1
    const nextMonthYear = monthIndex === 11 ? year + 1 : year
    const dStr = `${nextMonthYear}-${String(nextMonthIdx + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
    gridCells.push({ day: i, dateStr: dStr, isCurrentMonth: false })
  }

  // Helper to format currency values safely
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

  // Group recurring bills by date string
  const getBillsForDate = (dateStr: string) => {
    return activeRecurringPayments.filter(p => p.dueDate === dateStr)
  }

  return (
    <div className="p-5 rounded-2xl bg-card border border-border/60 shadow-xs space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="size-5 text-blue-500" />
          <h3 className="text-sm font-bold text-foreground">Visual Bill Calendar</h3>
        </div>
        <div className="text-[10px] text-muted-foreground font-semibold bg-muted/50 px-2 py-1 rounded-lg">
          Cycle Month: {selectedMonth} {year}
        </div>
      </div>

      {/* Grid week headers */}
      <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider pb-1 border-b border-border/30">
        {DAYS_OF_WEEK.map(d => (
          <div key={d} className="py-1">{d}</div>
        ))}
      </div>

      {/* Grid Days */}
      <div className="grid grid-cols-7 gap-1.5">
        {gridCells.map((cell, idx) => {
          const bills = getBillsForDate(cell.dateStr)
          const isToday = new Date().toDateString() === new Date(cell.dateStr).toDateString()

          return (
            <div
              key={idx}
              className={`min-h-[70px] sm:min-h-[85px] p-1.5 rounded-xl border flex flex-col justify-between transition-all duration-150 ${
                cell.isCurrentMonth
                  ? isToday
                    ? 'border-blue-500 bg-blue-500/[0.02] shadow-xs'
                    : 'border-border/60 bg-card'
                  : 'border-border/30 bg-muted/10 opacity-50'
              }`}
            >
              <div className="flex justify-between items-start">
                <span className={`text-[10px] font-bold ${
                  cell.isCurrentMonth 
                    ? isToday 
                      ? 'text-blue-500 font-extrabold size-4 flex items-center justify-center rounded-full bg-blue-500/10'
                      : 'text-foreground' 
                    : 'text-muted-foreground'
                }`}>
                  {cell.day}
                </span>
                {bills.length > 0 && (
                  <span className="text-[8px] font-extrabold text-blue-500 bg-blue-500/10 px-1 rounded-sm">
                    {bills.length} Bill{bills.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {/* Bills Container for this cell */}
              <div className="space-y-1 mt-1 flex-1 flex flex-col justify-end">
                {bills.slice(0, 2).map(bill => {
                  const isPaid = bill.status === 'Paid'
                  const isDiscarded = bill.status === 'Discarded'
                  
                  let badgeStyle = 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                  if (isPaid) badgeStyle = 'bg-green-500/10 text-green-500 border border-green-500/20'
                  if (isDiscarded) badgeStyle = 'bg-slate-500/10 text-slate-400 border border-slate-500/10 line-through opacity-60'

                  return (
                    <button
                      key={bill.id}
                      onClick={() => {
                        setSelectedBill(bill)
                        setPayDateInput(bill.dueDate)
                      }}
                      className={`w-full text-[8px] font-extrabold py-0.5 px-1 rounded-md text-left truncate cursor-pointer transition select-none flex items-center gap-0.5 ${badgeStyle}`}
                    >
                      <span className="truncate flex-1">{bill.name}</span>
                      <span className="shrink-0">{hideSensitive ? '***' : formatCurrency(Math.abs(bill.amount))}</span>
                    </button>
                  )
                })}
                {bills.length > 2 && (
                  <div className="text-[7px] text-muted-foreground font-bold text-center">
                    +{bills.length - 2} more
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

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
                        : 'bg-amber-500/10 text-amber-500 animate-pulse'
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
