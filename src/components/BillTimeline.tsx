import React, { useState } from 'react'
import type { ActiveRecurringPayment, RecurringPayment, Transaction } from '../types'
import { Calendar, CheckCircle2, AlertCircle, Ban, List, ChevronDown, ChevronUp } from 'lucide-react'
import { formatCurrencyVal } from '../lib/utils'
import { getCategoryBadgeClass, getCategoryDotClass } from '../lib/categoryColors'
import { ordinalSuffix } from '../lib/cycleLabels'
import { getOccurrenceStatusLabel } from './recurring/formatters'
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
  const [highlightedNodeDate, setHighlightedNodeDate] = useState<string | null>(null)
  const timelineId = React.useId().replace(/:/g, '')

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
  const denseTimeline = timelineNodes.length > 12
  const cycleDays = Math.max(1, Math.ceil(durationMs / 86_400_000) + 1)
  const denseTimelineMinWidth = denseTimeline ? Math.max(760, cycleDays * 36) : undefined
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
            const allPaid = node.bills.every(b => b.status === 'Paid' || b.status === 'SettledByLoanPayoff')
            const anyPartiallyPaid = node.bills.some(b => b.status === 'PartiallyPaid')
            const anyPending = node.bills.some(b => b.status === 'Pending')
            const allDiscarded = node.bills.every(b => b.status === 'Discarded')

            let dotColor = 'bg-amber-500'
            if (allPaid) dotColor = 'bg-emerald-500'
            else if (anyPartiallyPaid) dotColor = 'bg-blue-500'
            else if (allDiscarded) dotColor = 'bg-slate-400'
            else if (!anyPending) dotColor = 'bg-emerald-500'

            const d = new Date(node.dueDate)
            const dateLabel = `${BILL_TIMELINE_MONTHS[d.getMonth()]} ${d.getDate()}${ordinalSuffix(d.getDate())}`
            const nameLabel = node.bills.length === 1
              ? node.bills[0].name
              : node.bills.length === 2
                ? `${node.bills[0].name} & ${node.bills[1].name}`
                : `${node.bills.length} bills`
            const total = node.bills.reduce((s, b) => s + (b.amount == null ? 0 : Math.abs(b.amount)), 0)
            const statusLabel = anyPartiallyPaid
              ? 'Part paid'
              : anyPending
                ? 'Pending'
                : allDiscarded
                  ? 'Discarded'
                  : 'Paid'
            const statusStyle = statusLabel === 'Paid'
              ? 'text-emerald-500 bg-emerald-500/10'
              : statusLabel === 'Part paid'
                ? 'text-blue-500 bg-blue-500/10'
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

      {/* Tablet and desktop: the graph carries timing only. Names and amounts live in the key
          below, so bills one day apart never paint labels on top of each other. */}
      {timelineNodes.length > 0 && (
        <div className="hidden space-y-4 rounded-2xl border border-border/40 bg-muted/10 p-5 select-none sm:block">
          <div className="overflow-x-auto pb-2">
            <div className="relative px-3 pt-7 pb-3" style={{ minWidth: denseTimelineMinWidth }}>
              <span className="absolute left-3 top-0 text-[10px] font-bold text-muted-foreground">{startLabel}</span>
              <span className="absolute right-3 top-0 text-[10px] font-bold text-muted-foreground">{endLabel}</span>
              <div className="relative h-1.5 rounded-full bg-muted">
              {(() => {
                const todayTime = new Date().getTime()
                if (todayTime < startTime || todayTime > endTime) return null
                const todayPct = ((todayTime - startTime) / durationMs) * 100
                return <div className="absolute left-0 top-0 h-full rounded-full bg-blue-500/30" style={{ width: `${todayPct}%` }} />
              })()}
              {timelineNodes.map(node => {
                const allPaid = node.bills.every(b => b.status === 'Paid' || b.status === 'SettledByLoanPayoff')
                const anyPartiallyPaid = node.bills.some(b => b.status === 'PartiallyPaid')
                const anyPending = node.bills.some(b => b.status === 'Pending')
                const allDiscarded = node.bills.every(b => b.status === 'Discarded')
                const dotColor = allPaid || !anyPending && !anyPartiallyPaid && !allDiscarded
                  ? 'bg-emerald-500 ring-emerald-500/20'
                  : anyPartiallyPaid
                    ? 'bg-blue-500 ring-blue-500/20'
                    : allDiscarded
                      ? 'bg-slate-400 ring-slate-400/20'
                      : 'bg-amber-500 ring-amber-500/20'
                const labelText = node.bills.length === 1 ? node.bills[0].name : `${node.bills.length} bills`
                const isHighlighted = highlightedNodeDate === node.dueDate
                return (
                  <Button
                    variant="unstyled"
                    key={node.dueDate}
                    type="button"
                    onClick={() => handleNodeClick(node)}
                    onMouseEnter={() => setHighlightedNodeDate(node.dueDate)}
                    onMouseLeave={() => setHighlightedNodeDate(null)}
                    onFocus={() => setHighlightedNodeDate(node.dueDate)}
                    onBlur={() => setHighlightedNodeDate(null)}
                    aria-label={`View subscriptions due on ${node.dueDate}`}
                    aria-describedby={`${timelineId}-description-${node.dueDate}`}
                    title={`${node.dueDate}: ${labelText}`}
                    style={{ left: `${node.percent}%` }}
                    className={`absolute top-1/2 z-10 flex size-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full p-0 ring-4 transition-[transform,opacity,box-shadow] hover:scale-125 focus-visible:scale-125 ${dotColor} ${
                      isHighlighted ? 'scale-125 shadow-lg' : highlightedNodeDate ? 'opacity-45' : ''
                    }`}
                  >
                    {node.bills.length > 1 && <span className="text-[8px] font-black leading-none text-on-vivid">{node.bills.length}</span>}
                  </Button>
                )
              })}
              </div>
            </div>
          </div>

          <p className="text-[10px] font-medium text-muted-foreground">
            Hover or focus a dot to find its matching bill below. Select either one for details.
            {denseTimeline ? ` The ${timelineNodes.length} dates stay readable in a horizontally scrollable timeline and a compact list.` : ''}
          </p>

          <div className={`grid gap-2 md:grid-cols-2 xl:grid-cols-3 ${denseTimeline ? 'max-h-72 overflow-y-auto pr-1' : ''}`}>
            {timelineNodes.map(node => {
              const date = new Date(node.dueDate)
              const nameLabel = node.bills.length === 1
                ? node.bills[0].name
                : node.bills.length === 2
                  ? `${node.bills[0].name} & ${node.bills[1].name}`
                  : `${node.bills.length} bills`
              const total = node.bills.reduce((sum, bill) => sum + (bill.amount == null ? 0 : Math.abs(bill.amount)), 0)
              const allPaid = node.bills.every(bill => bill.status === 'Paid' || bill.status === 'SettledByLoanPayoff')
              const anyPartiallyPaid = node.bills.some(bill => bill.status === 'PartiallyPaid')
              const allDiscarded = node.bills.every(bill => bill.status === 'Discarded')
              const dotColor = allPaid ? 'bg-emerald-500' : anyPartiallyPaid ? 'bg-blue-500' : allDiscarded ? 'bg-slate-400' : 'bg-amber-500'
              const isHighlighted = highlightedNodeDate === node.dueDate
              return (
                <Button
                  variant="unstyled"
                  key={`key-${node.dueDate}`}
                  type="button"
                  onClick={() => handleNodeClick(node)}
                  onMouseEnter={() => setHighlightedNodeDate(node.dueDate)}
                  onMouseLeave={() => setHighlightedNodeDate(null)}
                  onFocus={() => setHighlightedNodeDate(node.dueDate)}
                  onBlur={() => setHighlightedNodeDate(null)}
                  id={`${timelineId}-description-${node.dueDate}`}
                  data-highlighted={isHighlighted || undefined}
                  className={`flex min-w-0 items-center gap-2.5 rounded-xl border bg-card/60 p-2.5 text-left transition-[background-color,border-color,box-shadow,opacity] hover:bg-muted/35 ${
                    isHighlighted
                      ? 'border-accent/60 bg-accent/10 shadow-sm'
                      : highlightedNodeDate ? 'border-border/35 opacity-55' : 'border-border/45'
                  }`}
                >
                  <span className={`size-2.5 shrink-0 rounded-full ${dotColor}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-bold text-foreground">{nameLabel}</span>
                    <span className="block text-[10px] text-muted-foreground">{BILL_TIMELINE_MONTHS[date.getMonth()]} {date.getDate()}</span>
                  </span>
                  <span className="shrink-0 text-xs font-extrabold text-foreground">{formatSensitive(total)}</span>
                </Button>
              )
            })}
          </div>
        </div>
      )}

      {/* Multiple Bills Selection Bottom Sheet */}
      {selectedNode && (
        <BottomSheet
          isOpen={!!selectedNode}
          onClose={() => setSelectedNode(null)}
          maxWidthClassName="max-w-md"
          title={
            <div className="flex items-center gap-2">
              <List className="size-4 text-blue-500" />
              <span>Subscriptions on {selectedNode.dueDate}</span>
            </div>
          }
        >
          <div className="space-y-2 mt-2">
            {selectedNode.bills.map((bill) => {
              const statusStyle = bill.status === 'Paid' || bill.status === 'SettledByLoanPayoff'
                ? 'text-emerald-500 bg-emerald-500/10'
                : bill.status === 'PartiallyPaid'
                  ? 'text-blue-500 bg-blue-500/10'
                  : bill.status === 'Discarded'
                    ? 'text-slate-400 bg-slate-500/10'
                    : 'text-amber-500 bg-amber-500/10'

              return (
                <Button variant="unstyled"
                  key={bill.id}
                  type="button"
                  onClick={() => {
                    setSelectedNode(null)
                    setSelectedBill(bill)
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/40 transition text-left cursor-pointer"
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
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${statusStyle}`}>
                      {getOccurrenceStatusLabel(bill.status)}
                    </span>
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
                selectedBill.status === 'Paid' || selectedBill.status === 'SettledByLoanPayoff'
                  ? 'bg-emerald-500/10 text-emerald-500'
                  : selectedBill.status === 'PartiallyPaid'
                    ? 'bg-blue-500/10 text-blue-500'
                    : selectedBill.status === 'Discarded'
                      ? 'bg-slate-500/10 text-slate-400'
                      : 'bg-amber-500/10 text-amber-500'
              }`}>
                {selectedBill.status === 'Paid' || selectedBill.status === 'SettledByLoanPayoff' ? (
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
                    selectedBill.status === 'Paid' || selectedBill.status === 'SettledByLoanPayoff'
                      ? 'bg-emerald-500/10 text-emerald-500'
                      : selectedBill.status === 'PartiallyPaid'
                        ? 'bg-blue-500/10 text-blue-500'
                        : selectedBill.status === 'Discarded'
                          ? 'bg-slate-500/10 text-slate-400 line-through'
                          : 'bg-amber-500/10 text-amber-500'
                  }`}>
                    {selectedBill.status === 'PartiallyPaid'
                      ? 'Part paid'
                      : selectedBill.status === 'SettledByLoanPayoff'
                        ? 'Paid off'
                        : selectedBill.status}
                  </span>
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

            {selectedBill.status === 'PartiallyPaid' && (
              <div className="grid grid-cols-2 gap-2 bg-blue-500/10 border border-blue-500/20 p-2.5 rounded-xl text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Paid so far</span>
                  <span className="font-extrabold text-foreground">{formatSensitive(selectedBill.paidAmount ?? 0)}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Still to pay</span>
                  <span className="font-extrabold text-blue-600 dark:text-blue-400">{formatSensitive(selectedBill.remainingAmount ?? 0)}</span>
                </div>
              </div>
            )}

            {selectedBill.paidDate && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs flex items-center justify-between">
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
