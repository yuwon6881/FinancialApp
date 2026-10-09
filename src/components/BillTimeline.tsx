import React, { useState } from 'react'
import type { ActiveRecurringPayment, RecurringPayment, Transaction } from '../types'
import { billTimelineStatus } from '../lib/billTimelineStatus'
import { Calendar, ChevronDown, ChevronUp } from 'lucide-react'
import { formatCurrencyVal } from '../lib/utils'
import { ordinalSuffix } from '../lib/cycleLabels'
import { BILL_TIMELINE_MONTHS, buildBillTimelineModel, getBillTimelineAmount, parseBillTimelineDate, type BillTimelineNode } from '../lib/billTimeline'
import { Card } from './ui/Card'
import { SensitiveMask } from './ui/SensitiveAmount'
import { Button } from './ui/Button'
import { BillTimelineModals } from './recurring/BillTimelineModals'

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
  const descriptionRefs = React.useRef(new Map<string, HTMLButtonElement>())
  const timelineId = React.useId().replace(/:/g, '')

  React.useEffect(() => {
    setSelectedBill(null)
    setSelectedNode(null)
    setHighlightedNodeDate(null)
  }, [selectedMonth, selectedYear])

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
  const formatTimelineAmount = (value: number | null) =>
    value == null ? <span>Unavailable</span> : formatSensitive(value)

  const highlightNode = (dueDate: string | null, revealDescription = false) => {
    setHighlightedNodeDate(dueDate)
    if (dueDate && revealDescription && denseTimeline) {
      descriptionRefs.current.get(dueDate)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }
  }

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
        className="relative flex flex-wrap items-center justify-between gap-2 p-4 transition duration-200 select-none hover:bg-surface-2/60"
      >
        <Button
          variant="tertiary"
          type="button"
          aria-label={`Expand ${displayTitle}`}
          aria-expanded="false"
          onClick={() => setIsExpanded(true)}
          className="absolute inset-0 z-10 rounded-2xl cursor-pointer hover:bg-transparent focus-visible:outline-offset-2"
        >
          <span className="sr-only">Expand {displayTitle}</span>
        </Button>
        <div className="flex flex-wrap items-center gap-2 text-body font-medium text-foreground">
          <Calendar className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span>{displayTitle}</span>
          <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-caption font-medium text-muted-foreground">
            {processedPayments.length} bills
          </span>
          <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-caption font-semibold text-accent-ink tabular-nums">
            Cycle Total: {formatTimelineAmount(cycleTotal)}
          </span>
          <ChevronDown className="size-4 text-muted-foreground shrink-0" />
        </div>
        <div className="hidden shrink-0 whitespace-nowrap text-caption text-muted-foreground sm:block">
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
          variant="tertiary"
          type="button"
          aria-label={`Collapse ${displayTitle}`}
          aria-expanded="true"
          onClick={() => setIsExpanded(false)}
          className="absolute inset-0 z-10 rounded-xl cursor-pointer hover:bg-transparent"
        >
          <span className="sr-only">Collapse {displayTitle}</span>
        </Button>
        <div>
          <h3 className="text-subsection text-foreground flex items-center gap-2">
            <Calendar className="size-5 text-muted-foreground" aria-hidden="true" />
            <span>{displayTitle}</span>
          </h3>
          <div className="text-xs text-muted-foreground mt-2 font-semibold flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-1.5 rounded-full bg-primary" />
              Cycle Range: {startLabel} – {endLabel}
            </span>
            <span>•</span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-caption font-semibold text-accent-ink tabular-nums">
              Cycle Total: {formatTimelineAmount(cycleTotal)} ({processedPayments.length} bills)
            </span>
          </div>
        </div>
        <div className="p-1.5 text-muted-foreground rounded-lg flex items-center gap-1 text-xs font-semibold shrink-0">
          <span className="text-xs hidden sm:inline">Collapse</span>
          <ChevronUp className="size-4" />
        </div>
      </div>

      {timelineNodes.length > 0 && (
        <ul className="flex flex-nowrap items-center justify-between gap-x-3 text-xs font-medium whitespace-nowrap text-muted-foreground sm:justify-end sm:gap-x-4" aria-label="Timeline colour key">
          <li className="flex items-center gap-1.5"><span className="size-2.5 shrink-0 rounded-full bg-accent-ink ring-2 ring-accent-ink/20" aria-hidden="true" />Fully paid</li>
          <li className="flex items-center gap-1.5"><span className="size-2.5 shrink-0 rounded-full bg-accent-ink/60 ring-2 ring-accent-ink/15" aria-hidden="true" />Part paid</li>
          <li className="flex items-center gap-1.5"><span className="size-2.5 shrink-0 rounded-full bg-accent-ink/25 ring-2 ring-accent-ink/20" aria-hidden="true" />Pending</li>
        </ul>
      )}
      {/* Mobile: compact tappable vertical list */}
      {timelineNodes.length > 0 && (
        <div className="sm:hidden space-y-2">
          {timelineNodes.map((node) => {
            const allDiscarded = node.bills.every(b => b.status === 'Discarded')
            const { dot: dotColor, label: statusLabel, badge: statusStyle } = billTimelineStatus(node.bills)

            const d = parseBillTimelineDate(node.dueDate)
            const dateLabel = `${BILL_TIMELINE_MONTHS[d.getMonth()]} ${d.getDate()}${ordinalSuffix(d.getDate())}`
            const nameLabel = node.bills.length === 1
              ? node.bills[0].name
              : node.bills.length === 2
                ? `${node.bills[0].name} & ${node.bills[1].name}`
                : `${node.bills.length} bills`
            const amounts = node.bills.map(getBillTimelineAmount)
            const total = amounts.some(amount => amount == null)
              ? null
              : amounts.reduce<number>((sum, amount) => sum + (amount ?? 0), 0)
            return (
              <Button variant="tertiary"
                key={node.dueDate}
                type="button"
                onClick={() => handleNodeClick(node)}
                className="w-full justify-start gap-3 rounded-control bg-surface-2/50 p-3 text-left hover:bg-surface-2"
              >
                <span className={`size-2.5 rounded-full shrink-0 ${dotColor}`} />
                <div className="flex flex-col items-center justify-center shrink-0 w-10">
                  <span className="text-label font-medium leading-none text-muted-foreground">{BILL_TIMELINE_MONTHS[d.getMonth()]}</span>
                  <span className="text-lg font-semibold text-foreground leading-tight">{d.getDate()}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className={`text-caption font-semibold text-foreground truncate ${allDiscarded ? 'line-through opacity-60' : ''}`}>{nameLabel}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Due {dateLabel}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-semibold text-foreground">{formatTimelineAmount(total)}</div>
                  <span className={`inline-block mt-0.5 text-caption font-semibold px-1.5 py-0.5 rounded ${statusStyle}`}>{statusLabel}</span>
                </div>
              </Button>
            )
          })}
        </div>
      )}

      {/* Tablet and desktop: timeline */}
      {timelineNodes.length > 0 && (
        <div className="hidden space-y-4 rounded-control bg-surface-2/70 p-5 select-none sm:block">
          <div className="overflow-x-auto pb-2" data-testid="bill-timeline-scrollport">
            <div className="relative px-5 pt-7 pb-3" style={{ minWidth: denseTimelineMinWidth }}>
              <span className="absolute left-5 top-0 text-caption font-semibold text-muted-foreground">{startLabel}</span>
              <span className="absolute right-5 top-0 text-caption font-semibold text-muted-foreground">{endLabel}</span>
              <div className="relative h-1.5 rounded-full bg-muted">
              {(() => {
                const todayTime = new Date().getTime()
                if (todayTime < startTime || todayTime > endTime) return null
                const todayPct = ((todayTime - startTime) / durationMs) * 100
                return <div className="absolute left-0 top-0 h-full rounded-full bg-primary/30" style={{ width: `${todayPct}%` }} />
              })()}
              {timelineNodes.map(node => {
                const { dot: dotColor, label: statusLabel } = billTimelineStatus(node.bills)
                const labelText = node.bills.length === 1 ? node.bills[0].name : `${node.bills.length} bills`
                const isHighlighted = highlightedNodeDate === node.dueDate
                return (
                  <Button
                    variant="tertiary"
                    key={node.dueDate}
                    type="button"
                    onClick={() => handleNodeClick(node)}
                    onMouseEnter={() => highlightNode(node.dueDate, true)}
                    onMouseLeave={() => highlightNode(null)}
                    onFocus={() => highlightNode(node.dueDate, true)}
                    onBlur={() => highlightNode(null)}
                    aria-label={`View subscriptions due on ${node.dueDate}`}
                    aria-describedby={`${timelineId}-description-${node.dueDate}`}
                    title={`${node.dueDate}: ${labelText} · ${statusLabel}`}
                    style={{ left: `${node.percent}%` }}
                    className={`absolute top-1/2 z-10 flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full p-0 transition-opacity hover:bg-transparent ${
                      highlightedNodeDate && !isHighlighted ? 'opacity-45' : ''
                    }`}
                  >
                    <span className={`flex size-4 items-center justify-center rounded-full ring-4 transition-[transform,box-shadow] ${dotColor} ${
                      isHighlighted ? 'scale-125 shadow-(--app-shadow-overlay)' : ''
                    }`}>
                      {node.bills.length > 1 && <span className="text-xs font-semibold leading-none text-on-vivid">{node.bills.length}</span>}
                    </span>
                  </Button>
                )
              })}
              </div>
            </div>
          </div>


          <div className={`grid gap-2 md:grid-cols-2 xl:grid-cols-3 ${denseTimeline ? 'max-h-72 overflow-y-auto pr-1' : ''}`}>
            {timelineNodes.map(node => {
              const date = parseBillTimelineDate(node.dueDate)
              const nameLabel = node.bills.length === 1
                ? node.bills[0].name
                : node.bills.length === 2
                  ? `${node.bills[0].name} & ${node.bills[1].name}`
                  : `${node.bills.length} bills`
              const amounts = node.bills.map(getBillTimelineAmount)
              const total = amounts.some(amount => amount == null)
                ? null
                : amounts.reduce<number>((sum, amount) => sum + (amount ?? 0), 0)
              const { dot: dotColor, label: statusLabel } = billTimelineStatus(node.bills)
              const isHighlighted = highlightedNodeDate === node.dueDate
              return (
                <Button
                  variant="tertiary"
                  key={`key-${node.dueDate}`}
                  type="button"
                  ref={(element) => {
                    if (element) descriptionRefs.current.set(node.dueDate, element)
                    else descriptionRefs.current.delete(node.dueDate)
                  }}
                  onClick={() => handleNodeClick(node)}
                  onMouseEnter={() => highlightNode(node.dueDate)}
                  onMouseLeave={() => highlightNode(null)}
                  onFocus={() => highlightNode(node.dueDate)}
                  onBlur={() => highlightNode(null)}
                  id={`${timelineId}-description-${node.dueDate}`}
                  data-highlighted={isHighlighted || undefined}
                  className={`flex min-w-0 items-center gap-2.5 rounded-xl border bg-card/60 p-2.5 justify-start text-left transition-[background-color,border-color,box-shadow,opacity] hover:bg-muted/35 ${
                    isHighlighted
                      ? 'border-accent/60 bg-accent/10 hover:bg-accent/10 shadow-sm'
                      : highlightedNodeDate ? 'border-border/35 opacity-55' : 'border-border/45'
                  }`}
                >
                  <span className={`size-2.5 shrink-0 rounded-full ${dotColor}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-caption font-semibold text-foreground">{nameLabel}</span>
                    <span className="block text-xs text-muted-foreground">{BILL_TIMELINE_MONTHS[date.getMonth()]} {date.getDate()} · {statusLabel}</span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-foreground">{formatTimelineAmount(total)}</span>
                </Button>
              )
            })}
          </div>
        </div>
      )}

      <BillTimelineModals
        selectedNode={selectedNode}
        setSelectedNode={setSelectedNode}
        selectedBill={selectedBill}
        setSelectedBill={setSelectedBill}
        formatTimelineAmount={formatTimelineAmount}
        formatSensitive={formatSensitive}
      />
    </Card>
  )
}
