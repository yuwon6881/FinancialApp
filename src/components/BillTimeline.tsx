import React, { useState } from 'react'
import type { ActiveRecurringPayment, RecurringPayment, Transaction } from '../types'
import { Calendar, CheckCircle2, AlertCircle, Ban, List, ChevronDown, ChevronUp } from 'lucide-react'
import { formatCurrencyVal } from '../lib/utils'
import { getCategoryBadgeClass, getCategoryDotClass } from '../lib/categoryColors'
import { ordinalSuffix } from '../lib/cycleLabels'
import { BILL_TIMELINE_MONTHS, buildBillTimelineModel, type BillTimelineNode } from '../lib/billTimeline'
import { BottomSheet } from './ui/BottomSheet'
import { Card } from './ui/Card'
import { SensitiveMask } from './ui/SensitiveAmount'
import { Button } from './ui/Button'

interface BillTimelineProps {
  activeRecurringPayments: ActiveRecurringPayment[]
  allPayments?: RecurringPayment[]
  transactions?: Transaction[]
  selectedMonth: string
  selectedYear: number
  cycleDay: number
  currency?: string
  hideSensitive: boolean
  cycleOffset?: number
  title?: string
}

export const BillTimeline: React.FC<BillTimelineProps> = ({
  activeRecurringPayments,
  allPayments,
  transactions = [],
  selectedMonth,
  selectedYear,
  cycleDay,
  currency = 'USD',
  hideSensitive,
  cycleOffset = 0,
  title
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [selectedBill, setSelectedBill] = useState<ActiveRecurringPayment | null>(null)
  const [selectedNode, setSelectedNode] = useState<BillTimelineNode | null>(null)

  const {
    startTime,
    endTime,
    durationMs,
    startLabel,
    endLabel,
    processedPayments,
    cycleTotal,
    timelineNodes,
  } = React.useMemo(() => buildBillTimelineModel({
    activeRecurringPayments,
    allPayments,
    transactions,
    selectedMonth,
    selectedYear,
    cycleDay,
    cycleOffset,
  }), [activeRecurringPayments, allPayments, transactions, selectedMonth, selectedYear, cycleDay, cycleOffset])

  const displayTitle = title || (cycleOffset === 1 ? 'Upcoming Next Cycle Subscriptions' : 'Subscriptions Billing Timeline')
  const formatCurrency = (value: number) => formatCurrencyVal(value, currency)
  const formatSensitive = (value: number) =>
    hideSensitive ? <SensitiveMask /> : <span>{formatCurrency(value)}</span>

  const handleNodeClick = (node: BillTimelineNode) => {
    if (node.bills.length === 1) {
      setSelectedBill(node.bills[0])
    } else {
      setSelectedNode(node)
    }
  }

  if (!isExpanded) {
    return (
      <Card
        className="relative p-4 flex items-center justify-between hover:bg-muted/30 transition duration-200 select-none flex-wrap gap-2"
      >
        <Button
          variant="unstyled"
          type="button"
          aria-label={`Expand ${displayTitle}`}
          aria-expanded="false"
          onClick={() => setIsExpanded(true)}
          className="absolute inset-0 z-10 rounded-2xl cursor-pointer focus-visible:outline-offset-2"
        >
          <span className="sr-only">Expand {displayTitle}</span>
        </Button>
        <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-foreground flex-wrap">
          <Calendar className="size-4 text-blue-500 shrink-0" />
          <span>{displayTitle}</span>
          <span className="text-[10px] text-muted-foreground bg-muted/70 px-2 py-0.5 rounded-md font-semibold shrink-0">
            {processedPayments.length} bills
          </span>
          <span className="text-[10px] font-extrabold text-blue-500 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md shrink-0">
            Cycle Total: {formatSensitive(cycleTotal)}
          </span>
          <ChevronDown className="size-4 text-muted-foreground shrink-0" />
        </div>
        <div className="text-[10px] text-muted-foreground font-semibold bg-muted/50 px-2.5 py-1 rounded-lg whitespace-nowrap shrink-0 hidden sm:block">
          {startLabel} – {endLabel}
        </div>
      </Card>
    )
  }

  return (
    <Card className="space-y-6 animate-in fade-in zoom-in-98 duration-150">
      <div
        className="relative flex items-center justify-between border-b border-border/30 pb-3 gap-2 hover:bg-muted/20 -mx-3 -mt-2 p-3 rounded-xl transition duration-150 select-none"
      >
        <Button
          variant="unstyled"
          type="button"
          aria-label={`Collapse ${displayTitle}`}
          aria-expanded="true"
          onClick={() => setIsExpanded(false)}
          className="absolute inset-0 z-10 rounded-xl cursor-pointer"
        >
          <span className="sr-only">Collapse {displayTitle}</span>
        </Button>
        <div>
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Calendar className="size-5 text-blue-500" />
            <span>{displayTitle}</span>
          </h3>
          <div className="text-xs text-muted-foreground mt-2 font-semibold flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-blue-500 inline-block" />
              Cycle Range: {startLabel} – {endLabel}
            </span>
            <span>•</span>
            <span className="text-xs font-extrabold text-blue-500 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md">
              Cycle Total: {formatSensitive(cycleTotal)} ({processedPayments.length} bills)
            </span>
          </div>
        </div>
        <div className="p-1.5 text-muted-foreground rounded-lg flex items-center gap-1 text-xs font-semibold shrink-0">
          <span className="text-[10px] hidden sm:inline">Collapse</span>
          <ChevronUp className="size-4" />
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
            const dateLabel = `${BILL_TIMELINE_MONTHS[d.getMonth()]} ${d.getDate()}${ordinalSuffix(d.getDate())}`
            const nameLabel = node.bills.length === 1
              ? node.bills[0].name
              : node.bills.length === 2
                ? `${node.bills[0].name} & ${node.bills[1].name}`
                : `${node.bills.length} bills`
            const total = node.bills.reduce((s, b) => s + (b.amount == null ? 0 : Math.abs(b.amount)), 0)
            const statusLabel = anyPending ? 'Pending' : allDiscarded ? 'Discarded' : 'Paid'
            const statusStyle = statusLabel === 'Paid'
              ? 'text-green-500 bg-green-500/10'
              : statusLabel === 'Discarded'
                ? 'text-slate-400 bg-slate-500/10'
                : 'text-amber-500 bg-amber-500/10'

            return (
              <Button variant="unstyled"
                key={node.dueDate}
                type="button"
                onClick={() => handleNodeClick(node)}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-card hover:bg-muted/30 active:scale-[0.99] transition text-left cursor-pointer"
              >
                <span className={`size-2.5 rounded-full shrink-0 ${dotColor}`} />
                <div className="flex flex-col items-center justify-center shrink-0 w-10">
                  <span className="text-[9px] text-muted-foreground font-bold uppercase leading-none">{BILL_TIMELINE_MONTHS[d.getMonth()]}</span>
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
              </Button>
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
              const labelText = node.bills.length === 1
                ? node.bills[0].name
                : node.bills.length === 2
                  ? `${node.bills[0].name} & ${node.bills[1].name}`
                  : `${node.bills.length} Bills`

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
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 group z-10 hover:z-50 focus-within:z-50"
                >
                  {/* Node trigger dot — small visual, large touch target via padding/negative margin */}
                  <Button variant="unstyled"
                    type="button"
                    onClick={() => handleNodeClick(node)}
                    aria-label={`${node.bills.length} item${node.bills.length === 1 ? '' : 's'} due on ${node.dueDate}`}
                    className="-m-3.5 flex size-11 items-center justify-center cursor-pointer group/dot"
                    title={`${node.bills.length} item(s) due: ${node.dueDate}`}
                  >
                    <span className={`size-4 rounded-full border-2 border-card ${dotColor} group-hover/dot:scale-125 group-focus/dot:scale-125 group-active/dot:scale-95 transition duration-150 shadow-md flex items-center justify-center`}>
                      {/* The dot fills are bright gold/green tints in dark mode, so the
                          count reads in the surface colour rather than white. */}
                      {node.bills.length > 1 && (
                        <span className="text-[8px] text-on-vivid font-extrabold leading-none">{node.bills.length}</span>
                      )}
                    </span>
                  </Button>

                  {/* Alternating & Staggered Labels */}
                  <div 
                    className={`absolute flex flex-col ${alignClasses} ${
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
                    
                    {/* Info Badge - clickable directly */}
                    <Button variant="unstyled"
                      type="button"
                      onClick={() => handleNodeClick(node)}
                      className={`min-h-8 px-2 py-0.75 rounded-md text-[9px] font-bold text-foreground border border-border bg-card whitespace-nowrap shadow-xs flex items-center gap-1 hover:bg-muted/80 cursor-pointer pointer-events-auto transition ${
                        allDiscarded ? 'line-through opacity-60 text-muted-foreground' : ''
                      }`}
                    >
                      <span className="truncate max-w-[120px]">{labelText}</span>
                      <span className="text-muted-foreground font-semibold">({formattedDueDay})</span>
                    </Button>
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
        <BottomSheet
          isOpen={!!selectedNode}
          onClose={() => setSelectedNode(null)}
          maxWidthClassName="max-w-sm"
          title={
            <div className="flex items-center gap-2">
              <List className="size-4 text-blue-500" />
              <span className="text-sm font-bold">Bills Due on {selectedNode.dueDate}</span>
            </div>
          }
        >
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {selectedNode.bills.map(bill => {
              const isPaid = bill.status === 'Paid'
              const isDiscarded = bill.status === 'Discarded'
              
              let statusStyle = 'text-amber-500 bg-amber-500/10'
              if (isPaid) statusStyle = 'text-green-500 bg-green-500/10'
              if (isDiscarded) statusStyle = 'text-slate-400 bg-slate-500/10 line-through'

              return (
                <Button variant="unstyled"
                  key={bill.id}
                  type="button"
                  onClick={() => {
                    setSelectedBill(bill)
                    setSelectedNode(null)
                  }}
                  className="w-full p-3 rounded-xl border border-border/60 bg-muted/10 hover:bg-muted/30 transition flex items-center justify-between text-left cursor-pointer"
                >
                  <div>
                    <div className="text-xs font-bold text-foreground">{bill.name}</div>
                    <div className="flex flex-wrap items-center gap-1 mt-1">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border font-semibold text-[9px] ${getCategoryBadgeClass(bill.ledgerCategory)}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${getCategoryDotClass(bill.ledgerCategory)}`} />
                        {bill.ledgerCategory}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border font-semibold text-[9px] ${getCategoryBadgeClass(bill.category)}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${getCategoryDotClass(bill.category)}`} />
                        {bill.category}
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1 font-semibold">
                    <span className="text-xs font-extrabold text-foreground">{bill.amount == null ? 'Unavailable' : formatSensitive(Math.abs(bill.amount))}</span>
                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${statusStyle}`}>{bill.status}</span>
                  </div>
                </Button>
              )
            })}
          </div>
        </BottomSheet>
      )}

      {/* Bill Detail Read-Only Modal Overlay */}
      {selectedBill && (
        <BottomSheet
          isOpen={!!selectedBill}
          onClose={() => setSelectedBill(null)}
          maxWidthClassName="max-w-sm"
          title={
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
              <span className="text-sm font-bold">{selectedBill.name}</span>
            </div>
          }
        >
          <div className="text-xs space-y-3 font-semibold text-foreground">
            <div className="grid grid-cols-2 gap-3.5 bg-muted/30 p-3.5 rounded-xl border border-border/40">
              <div className="flex flex-col justify-between">
                <span className="text-[9px] text-muted-foreground block font-normal uppercase tracking-wider mb-1">Amount</span>
                <div className="flex items-center min-h-[22px]">
                  <span className="text-base font-extrabold text-foreground leading-none">{selectedBill.amount == null ? 'Unavailable' : formatSensitive(Math.abs(selectedBill.amount))}</span>
                </div>
              </div>
              <div className="flex flex-col justify-between">
                <span className="text-[9px] text-muted-foreground block font-normal uppercase tracking-wider mb-1">Status</span>
                <div className="flex items-center min-h-[22px]">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold leading-none ${
                    selectedBill.status === 'Paid' 
                      ? 'bg-green-500/10 text-green-500' 
                      : selectedBill.status === 'Discarded' 
                        ? 'bg-slate-500/10 text-slate-400 line-through' 
                        : 'bg-amber-500/10 text-amber-500'
                  }`}>{selectedBill.status}</span>
                </div>
              </div>
              <div className="flex flex-col justify-between pt-2.5 border-t border-border/30">
                <span className="text-[9px] text-muted-foreground block font-normal uppercase tracking-wider mb-1">Due Date</span>
                <div className="flex items-center min-h-[22px]">
                  <span className="text-xs font-semibold text-foreground leading-none">{selectedBill.dueDate}</span>
                </div>
              </div>
              <div className="flex flex-col justify-between pt-2.5 border-t border-border/30">
                <span className="text-[9px] text-muted-foreground block font-normal uppercase tracking-wider mb-1">Categories</span>
                <div className="flex flex-wrap items-center gap-1 min-h-[22px]">
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-semibold leading-none ${getCategoryBadgeClass(selectedBill.ledgerCategory)}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${getCategoryDotClass(selectedBill.ledgerCategory)}`} />
                    {selectedBill.ledgerCategory}
                  </span>
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-semibold leading-none ${getCategoryBadgeClass(selectedBill.category)}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${getCategoryDotClass(selectedBill.category)}`} />
                    {selectedBill.category}
                  </span>
                </div>
              </div>
            </div>

            {selectedBill.paidDate && (
              <div className="bg-green-500/10 border border-green-500/20 p-2.5 rounded-xl text-green-600 dark:text-green-400 text-xs flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider">Paid On</span>
                <span className="font-extrabold">{selectedBill.paidDate}</span>
              </div>
            )}

            <div className="pt-2">
              <Button variant="secondary"
                onClick={() => setSelectedBill(null)}
                className="min-h-11 w-full rounded-xl"
              >
                Close
              </Button>
            </div>
          </div>
        </BottomSheet>
      )}
    </Card>
  )
}
