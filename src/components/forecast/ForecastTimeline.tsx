import { useMemo, useState } from 'react'
import { AlertTriangle, ChevronRight, ShieldCheck, SlidersHorizontal, X } from 'lucide-react'
import type { ForecastCycle, ForecastLine, ForecastSkippedBill } from '../../types'
import { FORECAST_BUCKETS } from '../../types'
import { formatForecastDate, formatForecastRange } from '../../lib/forecastScenario'
import { AmountText } from '../ui/AmountText'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { BottomSheet } from '../ui/BottomSheet'
import { IconButton } from '../ui/IconButton'
import { Panel } from '../ui/Panel'

/** Show split income as one total and keep each scheduled payment or expense visible. */
function toTimelineLines(lines: readonly ForecastLine[]): ForecastLine[] {
  // Income split by the allocation settings arrives as one positive line per bucket under the
  // same name and date. Only those are combined; money moved or added into a single bucket keeps
  // its bucket, so a move reads as "out of Rewards" and "into Essentials".
  const keyOf = (line: ForecastLine) => JSON.stringify([line.date, line.label])
  const isIncomePart = (line: ForecastLine) => line.kind === 'Scenario' && line.amount > 0
  const parts = new Map<string, number>()
  for (const line of lines) if (isIncomePart(line)) parts.set(keyOf(line), (parts.get(keyOf(line)) ?? 0) + 1)
  const result: ForecastLine[] = []
  const income = new Map<string, ForecastLine>()
  for (const line of lines) {
    const key = keyOf(line)
    if (!isIncomePart(line) || (parts.get(key) ?? 0) < 2) {
      result.push(line)
      continue
    }
    const existing = income.get(key)
    if (existing) {
      existing.amount = Math.round((existing.amount + line.amount) * 100) / 100
    } else {
      const total = { ...line, bucket: null }
      income.set(key, total)
      result.push(total)
    }
  }
  return result
}

function ForecastCycleCard({ cycle, currency, masked, targetReachedOn, lines, selectedSkippedBills, onToggleBill, onAdjust }: {
  cycle: ForecastCycle
  currency: string
  masked: boolean
  targetReachedOn: string | null
  lines: ForecastLine[]
  selectedSkippedBills: ReadonlySet<string>
  onToggleBill: (billKey: string) => void
  onAdjust?: () => void
}) {
  const [open, setOpen] = useState(false)
  const closeActivity = () => setOpen(false)
  const skippedCount = lines.filter(line =>
    line.kind === 'Bill' && line.sourceId !== null && selectedSkippedBills.has(line.sourceId)).length
  const range = formatForecastRange(cycle.start, cycle.end)
  const isMilestone = targetReachedOn !== null && targetReachedOn >= cycle.start && targetReachedOn <= cycle.end

  return (
    <Panel as="li" className="@container flex min-w-0 flex-col gap-3 p-3.5 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-subsection text-foreground">{cycle.label}</h3>
          <p className="text-caption text-muted-foreground">{range}</p>
        </div>
        {!masked && (isMilestone || onAdjust) && (
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            {isMilestone && <Badge tone="success"><ShieldCheck className="size-3" aria-hidden="true" /> Stability target reached</Badge>}
            {onAdjust && (
              <Button variant="tertiary" size="sm" onClick={onAdjust} aria-label={`Adjust ${cycle.label}`} className="-my-1">
                <SlidersHorizontal className="size-4" aria-hidden="true" /> Adjust
              </Button>
            )}
          </div>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 @xl:grid-cols-4">
        {FORECAST_BUCKETS.map(bucket => (
          <div key={bucket} className="min-w-0">
            <dt className="flex items-center gap-1 text-caption text-muted-foreground">
              {bucket}
              {!masked && cycle.shortBuckets.includes(bucket) && (
                <span className="text-destructive" title="Shortfall">
                  <AlertTriangle className="size-3" aria-hidden="true" />
                  <span className="sr-only">Shortfall</span>
                </span>
              )}
            </dt>
            <dd className="text-subsection">
              <AmountText value={cycle.closing[bucket]} currency={currency} isMasked={masked} />
            </dd>
          </div>
        ))}
      </dl>

      {!masked && (
        <div className="mt-auto border-t border-border pt-1">
          {lines.length === 0 ? (
            <p className="flex min-h-11 items-center px-2 text-caption text-muted-foreground lg:min-h-9">No activity projected.</p>
          ) : (
            <Button variant="tertiary" size="sm" aria-haspopup="dialog" onClick={() => setOpen(true)}
              className="w-full justify-start rounded-control px-2 text-muted-foreground active:scale-100">
              <span className="mr-auto">
                Activity · {lines.length}<span className="sr-only"> for {cycle.label}</span>
              </span>
              {skippedCount > 0 && <Badge>{skippedCount} skipped</Badge>}
              <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
            </Button>
          )}
        </div>
      )}
      {!masked && open && (
        <BottomSheet isOpen title="Cycle activity" description={range} onClose={closeActivity} maxWidthClassName="max-w-xl"
          headerActions={(
            <IconButton label="Close cycle activity" onClick={closeActivity}>
              <X className="size-4" aria-hidden="true" />
            </IconButton>
          )}>
          {lines.length === 0 ? (
            <p className="text-body text-muted-foreground">No activity projected.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {lines.map((line, index) => {
                const billKey = line.kind === 'Bill' ? line.sourceId : null
                const skipped = billKey !== null && selectedSkippedBills.has(billKey)
                return (
                  <li key={billKey ?? index} className="flex min-w-0 flex-wrap items-center justify-end gap-x-2 gap-y-1 py-1.5">
                    <span className="mr-auto min-w-0 flex-[1_1_7rem]">
                      <span className="block wrap-anywhere text-body text-foreground">{line.label}</span>
                      <span className="block text-caption text-muted-foreground">
                        {formatForecastDate(line.date)} · {line.bucket ?? 'Split across buckets'}{skipped && ' · Skipped'}
                      </span>
                    </span>
                    <AmountText value={line.amount} currency={currency} signDisplay="always"
                      tone={skipped ? 'muted' : line.amount > 0 ? 'positive' : 'neutral'} className="text-body" />
                    {billKey && (
                      <Button type="button" variant="tertiary" size="sm" className="min-w-28" onClick={() => onToggleBill(billKey)}
                        aria-label={`${skipped ? 'Include again:' : 'Skip'} ${line.label} on ${line.date} in this forecast`}>
                        {skipped ? 'Include again' : 'Skip'}
                      </Button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </BottomSheet>
      )}
    </Panel>
  )
}

export function ForecastTimeline({
  cycles, currency, masked, targetReachedOn, skippedBills, selectedSkippedBills, onToggleBill, onAdjustCycle,
}: {
  cycles: ForecastCycle[]
  currency: string
  masked: boolean
  targetReachedOn: string | null
  skippedBills: ForecastSkippedBill[]
  selectedSkippedBills: string[]
  onToggleBill: (billKey: string) => void
  /** Opens a what-if limited to one cycle's dates; omitted while no more what-ifs fit. */
  onAdjustCycle?: (cycle: ForecastCycle) => void
}) {
  const linesByCycle = useMemo(() => cycles.map(cycle => {
    if (masked) return []
    const lines = toTimelineLines(cycle.lines)
    for (const bill of skippedBills) {
      if (bill.date >= cycle.start && bill.date <= cycle.end) lines.push({ ...bill, kind: 'Bill' })
    }
    // Included and skipped bills arrive in separate arrays. Order ties by identity so
    // moving a bill between those arrays preserves its position and keyboard focus.
    return lines.sort((left, right) =>
      left.date.localeCompare(right.date) ||
      right.kind.localeCompare(left.kind) ||
      left.label.localeCompare(right.label) ||
      (left.sourceId ?? '').localeCompare(right.sourceId ?? ''))
  }), [cycles, masked, skippedBills])
  const skippedKeys = new Set(selectedSkippedBills)

  return (
    <div className="@container">
      <ol aria-label="Forecast by cycle" className="grid auto-rows-fr gap-3 @min-[48rem]:grid-cols-2">
        {cycles.map((cycle, index) => (
          <ForecastCycleCard key={cycle.start} cycle={cycle} currency={currency} masked={masked}
            targetReachedOn={targetReachedOn} selectedSkippedBills={skippedKeys} onToggleBill={onToggleBill}
            lines={linesByCycle[index]} onAdjust={onAdjustCycle && (() => onAdjustCycle(cycle))} />
        ))}
      </ol>
    </div>
  )
}
