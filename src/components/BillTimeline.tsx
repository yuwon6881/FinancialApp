import React, { useState } from 'react'
import type { ActiveRecurringPayment } from '../types'
import { Calendar, CheckCircle2, AlertCircle, X, Ban, List } from 'lucide-react'
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

interface TimelineNode {
  dueDate: string
  percent: number
  bills: ActiveRecurringPayment[]
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
  const [selectedNode, setSelectedNode] = useState<TimelineNode | null>(null)
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

  // Group bills by due date to prevent overlapping nodes on the timeline
  const uniqueDatesMap: { [dateStr: string]: ActiveRecurringPayment[] } = {}
  activeRecurringPayments.forEach(p => {
    if (!uniqueDatesMap[p.dueDate]) {
      uniqueDatesMap[p.dueDate] = []
    }
    uniqueDatesMap[p.dueDate].push(p)
  })

  // Map groups to timeline nodes and sort chronologically
  const rawNodes = Object.entries(uniqueDatesMap)
    .map(([dueDate, bills]) => {
      const dueTime = new Date(dueDate).getTime()
      let percent = durationMs > 0 ? ((dueTime - startTime) / durationMs) * 100 : 0
      percent = Math.max(0, Math.min(100, percent))
      return {
        dueDate,
        percent,
        bills
      }
    })
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())

  // Dynamic vertical staggering leader offsets to prevent label collision
  let lastTopPct = -100
  let lastBottomPct = -100

  const timelineNodes = rawNodes.map((node, idx) => {
    const isTop = idx % 2 === 0
    let level: 'short' | 'long' = 'short'

    if (isTop) {
      if (node.percent - lastTopPct < 15) {
        level = 'long'
        lastTopPct = node.percent + 15
      } else {
        lastTopPct = node.percent
      }
    } else {
      if (node.percent - lastBottomPct < 15) {
        level = 'long'
        lastBottomPct = node.percent + 15
      } else {
        lastBottomPct = node.percent
      }
    }

    return {
      ...node,
      isTop,
      level
    }
  })

  const handleNodeClick = (node: any) => {
    if (node.bills.length === 1) {
      setSelectedBill(node.bills[0])
      setPayDateInput(node.bills[0].dueDate)
    } else {
      setSelectedNode(node)
    }
  }

  return (
    <div className="p-6 rounded-2xl bg-card border border-border/60 shadow-xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border/30 pb-3 gap-2">
        <div>
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Calendar className="size-5 text-blue-500" />
            <span>Subscriptions Billing Timeline</span>
          </h3>
          <p className="text-[10px] text-muted-foreground mt-0.5 font-semibold">
            Cycle Range: {startLabel} – {endLabel}
          </p>
        </div>
        <div className="text-[10px] text-muted-foreground font-semibold bg-muted/50 px-2 py-1 rounded-lg whitespace-nowrap shrink-0 self-start sm:self-center">
          Cycle: {selectedMonth} {year}
        </div>
      </div>

      {/* Mobile: compact tappable vertical list (horizontal timeline is too cramped on small screens) */}
      {timelineNodes.length > 0 && (
        <div className="sm:hidden space-y-2">
          {timelineNodes.map((node) => {
            const allPaid = node.bills.every(b => b.status === 'Paid')
            const anyPending = node.bills.some(b => b.status === 'Pending')
            const allDiscarded = node.bills.every(b => b.status === 'Discarded')

            let dotColor = 'bg-amber-500'
            if (allPaid) dotColor = 'bg-green-500'
            else if (allDiscarded) dotColor = 'bg-slate-400'
            else if (!anyPending) dotColor = 'bg-green-500'

            const d = new Date(node.dueDate)
            const dateLabel = `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}${getDaySuffix(d.getDate())}`
            const nameLabel = node.bills.length === 1
              ? node.bills[0].name
              : node.bills.length === 2
                ? `${node.bills[0].name} & ${node.bills[1].name}`
                : `${node.bills.length} bills`
            const total = node.bills.reduce((s, b) => s + Math.abs(b.amount), 0)
            const statusLabel = anyPending ? 'Pending' : allDiscarded ? 'Discarded' : 'Paid'
            const statusStyle = statusLabel === 'Paid'
              ? 'text-green-500 bg-green-500/10'
              : statusLabel === 'Discarded'
                ? 'text-slate-400 bg-slate-500/10'
                : 'text-amber-500 bg-amber-500/10'

            return (
              <button
                key={node.dueDate}
                onClick={() => handleNodeClick(node)}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-card hover:bg-muted/30 active:scale-[0.99] transition text-left cursor-pointer"
              >
                <span className={`size-2.5 rounded-full shrink-0 ${dotColor}`} />
                <div className="flex flex-col items-center justify-center shrink-0 w-10">
                  <span className="text-[9px] text-muted-foreground font-bold uppercase leading-none">{MONTH_NAMES[d.getMonth()]}</span>
                  <span className="text-lg font-black text-foreground leading-tight">{d.getDate()}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className={`text-xs font-bold text-foreground truncate ${allDiscarded ? 'line-through opacity-60' : ''}`}>{nameLabel}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Due {dateLabel}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-extrabold text-foreground">{formatSensitive(total)}</div>
                  <span className={`inline-block mt-0.5 text-[8px] font-bold px-1.5 py-0.5 rounded ${statusStyle}`}>{statusLabel}</span>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Visual Timeline Section — horizontal graph (tablet and up) */}
      <div className="hidden sm:block p-6 bg-muted/10 rounded-2xl border border-border/40 select-none">

        {/* The horizontal line container */}
        <div className="relative pt-12 pb-16 px-3.5">
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

            {/* Render grouped timeline nodes */}
            {timelineNodes.map((node) => {
              // Determine status based on all bills in the node
              const allPaid = node.bills.every(b => b.status === 'Paid')
              const anyPending = node.bills.some(b => b.status === 'Pending')
              const allDiscarded = node.bills.every(b => b.status === 'Discarded')

              let dotColor = 'bg-amber-500 ring-amber-500/20' // Pending
              if (allPaid) {
                dotColor = 'bg-green-500 ring-green-500/20'
              } else if (allDiscarded) {
                dotColor = 'bg-slate-400 ring-slate-400/20'
              } else if (!anyPending) {
                // Mixed state, but none pending (e.g. Paid & Discarded)
                dotColor = 'bg-green-500 ring-green-500/20'
              }

              const formattedDueDay = new Date(node.dueDate).getDate()

              // Construct readable label for single or multiple bills
              let labelText = ''
              if (node.bills.length === 1) {
                labelText = node.bills[0].name
              } else if (node.bills.length === 2) {
                labelText = `${node.bills[0].name} & ${node.bills[1].name}`
              } else {
                labelText = `${node.bills.length} Bills`
              }

              // Dynamic label alignment to prevent clipping on the boundaries
              let alignClasses = 'left-1/2 -translate-x-1/2 items-center'
              if (node.percent < 3) {
                alignClasses = 'left-0 items-start'
              } else if (node.percent > 97) {
                alignClasses = 'left-auto right-0 items-end'
              }

              const connectorHeight = node.level === 'long' ? '36px' : '10px'

              return (
                <div
                  key={node.dueDate}
                  style={{ left: `${node.percent}%` }}
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 group z-10"
                >
                  {/* Node trigger dot — small visual, large touch target via padding/negative margin */}
                  <button
                    onClick={() => handleNodeClick(node)}
                    className="flex items-center justify-center p-2.5 -m-2.5 cursor-pointer group/dot focus:outline-none"
                    title={`${node.bills.length} item(s) due: ${node.dueDate}`}
                  >
                    <span className={`size-4 rounded-full border-2 border-card ${dotColor} group-hover/dot:scale-125 group-focus/dot:scale-125 group-active/dot:scale-95 transition duration-150 shadow-md flex items-center justify-center`}>
                      {node.bills.length > 1 && (
                        <span className="text-[8px] text-white font-extrabold leading-none">{node.bills.length}</span>
                      )}
                    </span>
                  </button>

                  {/* Alternating & Staggered Labels */}
                  <div 
                    className={`absolute flex flex-col pointer-events-none select-none ${alignClasses} ${
                      node.isTop ? 'bottom-full' : 'top-full'
                    }`}
                  >
                    {/* Small line connector */}
                    <div 
                      className={`w-[1px] bg-border/80 ${
                        node.isTop ? 'order-last' : 'order-first'
                      } ${
                        node.percent < 3 ? 'ml-1.5' : node.percent > 97 ? 'mr-1.5' : ''
                      }`}
                      style={{ height: connectorHeight }}
                    />
                    
                    {/* Info Badge */}
                    <span className={`px-2 py-0.75 rounded-md text-[9px] font-bold text-foreground border border-border bg-card whitespace-nowrap shadow-xs flex items-center gap-1 ${
                      allDiscarded ? 'line-through opacity-60 text-muted-foreground' : ''
                    }`}>
                      <span className="truncate max-w-[120px]">{labelText}</span>
                      <span className="text-muted-foreground font-semibold">({formattedDueDay})</span>
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {timelineNodes.length === 0 && (
        <div className="text-xs text-muted-foreground text-center py-6">
          No active subscriptions scheduled for this cycle.
        </div>
      )}

      {/* Multiple Bills Selector Modal */}
      {selectedNode && (
        <div
          onClick={() => setSelectedNode(null)}
          className="sheet-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="sheet-panel w-full max-w-sm bg-card border border-border/80 rounded-2xl shadow-2xl p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div className="flex items-center gap-2">
                <List className="size-4 text-blue-500" />
                <h3 className="text-sm font-bold text-foreground">Bills Due on {selectedNode.dueDate}</h3>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {selectedNode.bills.map(bill => {
                const isPaid = bill.status === 'Paid'
                const isDiscarded = bill.status === 'Discarded'
                
                let statusStyle = 'text-amber-500 bg-amber-500/10'
                if (isPaid) statusStyle = 'text-green-500 bg-green-500/10'
                if (isDiscarded) statusStyle = 'text-slate-400 bg-slate-500/10 line-through'

                return (
                  <button
                    key={bill.id}
                    onClick={() => {
                      setSelectedBill(bill)
                      setPayDateInput(bill.dueDate)
                      setSelectedNode(null)
                    }}
                    className="w-full p-3 rounded-xl border border-border/60 bg-muted/10 hover:bg-muted/30 transition flex items-center justify-between text-left cursor-pointer"
                  >
                    <div>
                      <div className="text-xs font-bold text-foreground">{bill.name}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{bill.ledgerCategory} / {bill.category}</div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1 font-semibold">
                      <span className="text-xs font-extrabold text-foreground">{formatSensitive(Math.abs(bill.amount))}</span>
                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${statusStyle}`}>{bill.status}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Bill Detail / Quick Action Modal Overlay */}
      {selectedBill && (
        <div
          onClick={() => setSelectedBill(null)}
          className="sheet-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="sheet-panel w-full max-w-sm bg-card border border-border/80 rounded-2xl shadow-2xl p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
          >
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
