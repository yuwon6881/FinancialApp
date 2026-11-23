import { useState } from 'react'
import { AlertTriangle, ShieldCheck } from 'lucide-react'
import type { ForecastCycle, ForecastLine } from '../../types'
import { FORECAST_BUCKETS } from '../../types'
import { AmountText } from '../ui/AmountText'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { DetailDisclosure } from '../ui/DetailDisclosure'
import { panelClass } from '../ui/panelStyles'
import { cn } from '../../lib/utils'

interface TimelineLine {
  key: string
  date: string
  label: string
  detail: string
  amount: number
  billKey: string | null
}

/**
 * Income is applied as one line per bucket it was split into; the timeline shows it once, as the
 * user entered it, and every outflow on its own line.
 */
function toTimelineLines(lines: readonly ForecastLine[]): TimelineLine[] {
  const result = new Map<string, TimelineLine>()
  for (const line of lines) {
    const isIncomeShare = line.kind !== 'Bill' && line.amount > 0
    const key = isIncomeShare
      ? `${line.date}|${line.label}|in`
      : `${line.date}|${line.label}|${line.bucket}|${line.sourceId ?? ''}`
    const existing = result.get(key)
    if (existing) {
      existing.amount = Math.round((existing.amount + line.amount) * 100) / 100
      continue
    }
    result.set(key, {
      key,
      date: line.date,
      label: line.label,
      detail: isIncomeShare ? 'Money in, split across buckets' : line.kind === 'Bill' ? `Bill from ${line.bucket}` : `From ${line.bucket}`,
      amount: line.amount,
      billKey: line.kind === 'Bill' ? line.sourceId : null,
    })
  }
  return [...result.values()]
}

interface CycleCardProps {
  cycle: ForecastCycle
  currency: string
  masked: boolean
  onSkipBill: (billKey: string) => void
}

function ForecastCycleCard({ cycle, currency, masked, onSkipBill }: CycleCardProps) {
  const [open, setOpen] = useState(false)
  const lines = toTimelineLines(cycle.lines)

  return (
    <li className={cn(panelClass, 'min-w-0 space-y-3 p-4')}>
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-label text-foreground">{cycle.label}</h3>
          <p className="text-caption text-muted-foreground">{cycle.start} to {cycle.end}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          {cycle.shortBuckets.length > 0 && (
            <Badge tone="danger"><AlertTriangle className="size-3" aria-hidden="true" /> Short in {cycle.shortBuckets.join(', ')}</Badge>
          )}
          {cycle.stabilityTargetReached && (
            <Badge tone="success"><ShieldCheck className="size-3" aria-hidden="true" /> Stability target met</Badge>
          )}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
        {FORECAST_BUCKETS.map(bucket => {
          const change = Math.round((cycle.closing[bucket] - cycle.opening[bucket]) * 100) / 100
          return (
            <div key={bucket} className="min-w-0">
              <dt className="text-caption text-muted-foreground">{bucket} at end</dt>
              <dd className={cn('text-body font-semibold', cycle.shortBuckets.includes(bucket) && 'text-destructive')}>
                <AmountText value={cycle.closing[bucket]} currency={currency} isMasked={masked} />
                {!masked && change !== 0 && (
                  <span className="ml-1.5 text-caption font-normal text-muted-foreground">
                    <AmountText value={change} currency={currency} signDisplay="always" />
                  </span>
                )}
              </dd>
            </div>
          )
        })}
      </dl>

      {lines.length === 0 ? (
        <p className="text-caption text-muted-foreground">Nothing scheduled in this period.</p>
      ) : (
        <DetailDisclosure label={`${lines.length} ${lines.length === 1 ? 'movement' : 'movements'}`} open={open} onOpenChange={setOpen}>
          <ul className="divide-y divide-border/60">
            {lines.map(line => (
              <li key={line.key} className="flex min-w-0 items-center justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate text-body text-foreground">{line.label}</span>
                  <span className="text-caption text-muted-foreground">{line.date} · {line.detail}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <AmountText value={line.amount} currency={currency} isMasked={masked} signDisplay="always"
                    tone={line.amount > 0 ? 'positive' : 'neutral'} className="text-body" />
                  {line.billKey && (
                    <Button type="button" variant="tertiary" size="sm" onClick={() => onSkipBill(line.billKey!)}
                      aria-label={`Skip ${line.label} on ${line.date} in this forecast`}>
                      Skip
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </DetailDisclosure>
      )}
    </li>
  )
}

export function ForecastTimeline({ cycles, currency, masked, onSkipBill }: {
  cycles: ForecastCycle[]
  currency: string
  masked: boolean
  onSkipBill: (billKey: string) => void
}) {
  return (
    <ol aria-label="Forecast by cycle" className="grid gap-3 lg:grid-cols-2">
      {cycles.map(cycle => (
        <ForecastCycleCard key={cycle.start} cycle={cycle} currency={currency} masked={masked} onSkipBill={onSkipBill} />
      ))}
    </ol>
  )
}
