import { useState } from 'react'
import { AlertTriangle, ShieldCheck } from 'lucide-react'
import type { ForecastCycle, ForecastLine, ForecastSkippedBill } from '../../types'
import { FORECAST_BUCKETS } from '../../types'
import { formatForecastDate, formatForecastRange } from '../../lib/forecastScenario'
import { AmountText } from '../ui/AmountText'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { DetailDisclosure } from '../ui/DetailDisclosure'
import { Panel } from '../ui/Panel'

/** Show split income as one total and keep each scheduled payment or expense visible. */
function toTimelineLines(lines: readonly ForecastLine[]): ForecastLine[] {
  const result: ForecastLine[] = []
  const income = new Map<string, ForecastLine>()
  for (const line of lines) {
    if (line.kind !== 'Scenario' || line.amount <= 0) {
      result.push(line)
      continue
    }
    const key = JSON.stringify([line.date, line.label])
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

function ForecastCycleCard({ cycle, currency, masked, targetReachedOn, skippedBills, selectedSkippedBills, onToggleBill }: {
  cycle: ForecastCycle
  currency: string
  masked: boolean
  targetReachedOn: string | null
  skippedBills: ForecastSkippedBill[]
  selectedSkippedBills: string[]
  onToggleBill: (billKey: string) => void
}) {
  const [open, setOpen] = useState(false)
  const lines = masked ? [] : [
    ...toTimelineLines(cycle.lines),
    ...skippedBills.map(bill => ({ ...bill, kind: 'Bill' as const })),
  ].sort((left, right) => left.date.localeCompare(right.date))
  const isMilestone = targetReachedOn !== null && targetReachedOn >= cycle.start && targetReachedOn <= cycle.end

  return (
    <Panel as="li" className="@container min-w-0 space-y-3 p-3.5 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-subsection text-foreground">{cycle.label}</h3>
          <p className="text-caption text-muted-foreground">{formatForecastRange(cycle.start, cycle.end)}</p>
        </div>
        {!masked && isMilestone && (
          <Badge tone="success"><ShieldCheck className="size-3" aria-hidden="true" /> Stability target reached</Badge>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 @xl:grid-cols-4">
        {FORECAST_BUCKETS.map(bucket => (
          <div key={bucket} className="min-w-0">
            <dt className="text-caption text-muted-foreground">{bucket}</dt>
            <dd className="text-subsection">
              <AmountText value={cycle.closing[bucket]} currency={currency} isMasked={masked} />
            </dd>
            {!masked && cycle.shortBuckets.includes(bucket) && (
              <dd className="flex items-center gap-1 text-caption text-destructive">
                <AlertTriangle className="size-3 shrink-0" aria-hidden="true" /> Shortfall
              </dd>
            )}
          </div>
        ))}
      </dl>

      {!masked && (lines.length === 0
        ? <p className="text-caption text-muted-foreground">No activity projected.</p>
        : (
          <DetailDisclosure label={`Activity · ${lines.length}`} open={open} onOpenChange={setOpen}
            aside={skippedBills.length > 0 && <Badge>{skippedBills.length} skipped</Badge>}
            className="border-t border-border [&>summary]:min-h-11 lg:[&>summary]:min-h-9" bodyClassName="pt-0">
            <ul className="divide-y divide-border/60">
              {lines.map((line, index) => {
                const billKey = line.kind === 'Bill' ? line.sourceId : null
                const skipped = billKey !== null && selectedSkippedBills.includes(billKey)
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
                      <Button type="button" variant="tertiary" size="sm" onClick={() => onToggleBill(billKey)}
                        aria-label={`${skipped ? 'Include again:' : 'Skip'} ${line.label} on ${line.date} in this forecast`}>
                        {skipped ? 'Include again' : 'Skip'}
                      </Button>
                    )}
                  </li>
                )
              })}
            </ul>
          </DetailDisclosure>
        ))}
    </Panel>
  )
}

export function ForecastTimeline({
  cycles, currency, masked, targetReachedOn, skippedBills, selectedSkippedBills, onToggleBill,
}: {
  cycles: ForecastCycle[]
  currency: string
  masked: boolean
  targetReachedOn: string | null
  skippedBills: ForecastSkippedBill[]
  selectedSkippedBills: string[]
  onToggleBill: (billKey: string) => void
}) {
  return (
    <div className="@container">
      <ol aria-label="Forecast by cycle" className="grid items-start gap-3 @min-[48rem]:grid-cols-2">
        {cycles.map(cycle => (
          <ForecastCycleCard key={cycle.start} cycle={cycle} currency={currency} masked={masked}
            targetReachedOn={targetReachedOn} selectedSkippedBills={selectedSkippedBills} onToggleBill={onToggleBill}
            skippedBills={skippedBills.filter(bill => bill.date >= cycle.start && bill.date <= cycle.end)} />
        ))}
      </ol>
    </div>
  )
}
