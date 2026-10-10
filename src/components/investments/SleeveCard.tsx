import { ChevronDown } from 'lucide-react'
import type { InvestmentAllocationOverview, InvestmentAllocationStatus } from '../../types'
import type { SleeveConstituent } from '../../lib/investmentSleeveBreakdown'
import { allocationStatusLabel } from '../../lib/investmentAllocation'
import { Badge, type BadgeTone } from '../ui/Badge'
import { SegmentedMeter } from '../ui/SegmentedMeter'
import { cn } from '../../lib/utils'

/** A basket that is part of the plan, or the catch-all for funds not sorted into one. */
type SleeveSummary =
  | InvestmentAllocationOverview['sleeves'][number]
  | { label: string; status: InvestmentAllocationStatus }

const STATUS_TONES: Partial<Record<InvestmentAllocationStatus, BadgeTone>> = {
  Watch: 'warning',
  Alert: 'urgent',
}

/**
 * One basket of the plan as a list row: where it stands against its aim on one meter (the fill is
 * what you hold, the tick is the aim), the money in it on a quiet line, and the funds inside one
 * tap away. The status chip only appears when it says something the row does not -- a basket that
 * is drifting or off target. "Needs sorting" on every row repeated the plan's own status three times.
 */
export function SleeveCard({
  sleeve,
  constituents,
  masked,
  money,
  color,
}: {
  sleeve: SleeveSummary
  constituents: SleeveConstituent[]
  masked: boolean
  money: (value?: number) => string
  /** The basket's colour as a CSS value; shared with the planner and the target bars. */
  color: string
}) {
  const isPlannedBasket = 'targetPercentage' in sleeve
  const tone = STATUS_TONES[sleeve.status]
  const known = isPlannedBasket && sleeve.currentPercentage !== undefined

  return (
    <li className="min-w-0 px-5 py-3.5 sm:px-6">
      <div className="flex min-w-0 items-baseline justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
          <span className="truncate text-body font-medium text-foreground">{sleeve.label}</span>
        </span>
        {isPlannedBasket && (
          <span className="shrink-0 text-body font-semibold tabular-nums text-foreground">
            {known ? `${sleeve.currentPercentage!.toFixed(1)}%` : <span className="font-normal text-muted-foreground">—</span>}
            <span className="ml-1 text-caption font-normal text-muted-foreground">of {sleeve.targetPercentage}%</span>
          </span>
        )}
      </div>
      {isPlannedBasket ? (
        <>
          <SegmentedMeter
            size="sm"
            className="mt-2"
            total={100}
            segments={[{ value: Math.min(100, sleeve.currentPercentage ?? 0), color, label: sleeve.label }]}
            markerPercent={sleeve.targetPercentage}
            markerLabel={`Aim ${sleeve.targetPercentage}%`}
            label={known
              ? `${sleeve.label}: ${sleeve.currentPercentage!.toFixed(1)}% held against an aim of ${sleeve.targetPercentage}%`
              : `${sleeve.label}: aim ${sleeve.targetPercentage}%, current share unknown`}
          />
          <div className="mt-1.5 flex min-w-0 items-center justify-between gap-2">
            <p className="min-w-0 truncate text-caption text-muted-foreground">
              {known || (sleeve.value ?? 0) > 0 ? money(sleeve.value) : 'Waiting on prices'}
              {sleeve.driftPercentagePoints !== undefined
                ? ` · ${Math.abs(sleeve.driftPercentagePoints) < 0.05 ? 'on your aim' : `${Math.abs(sleeve.driftPercentagePoints).toFixed(1)}% ${sleeve.driftPercentagePoints > 0 ? 'above' : 'below'} your aim`}`
                : ''}
            </p>
            {tone && <Badge tone={tone}>{allocationStatusLabel(sleeve.status)}</Badge>}
          </div>
        </>
      ) : (
        <p className="mt-1 text-caption text-muted-foreground">Not in a basket yet.</p>
      )}

      {constituents.length > 0 && (
        <details className="group/holdings mt-1">
          <summary className="-mx-2 inline-flex min-h-11 cursor-pointer select-none items-center gap-1 rounded-lg px-2 text-caption font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 lg:min-h-8">
            <span>See the {constituents.length} fund{constituents.length === 1 ? '' : 's'} in this basket</span>
            <ChevronDown className="size-3.5 shrink-0 transition-transform duration-200 group-open/holdings:rotate-180" aria-hidden="true" />
          </summary>
          <ul className="mt-1 divide-y divide-border/50 rounded-control bg-surface-2/70 px-3">
            {constituents.map(holding => (
              <li key={`${holding.accountId}-${holding.instrumentId}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 py-2 text-caption">
                <span className="truncate font-medium text-foreground">{holding.symbol} · {holding.name}</span>
                <span className="text-right font-medium tabular-nums text-foreground">{money(holding.valueApp)}</span>
                <span className="text-muted-foreground">
                  {holding.shareOfSleeve === undefined ? 'Share unavailable' : `${holding.shareOfSleeve.toFixed(1)}% of this basket`}
                </span>
                <span className={cn(
                  'text-right tabular-nums',
                  masked || holding.unrealisedProfitLossApp === undefined
                    ? 'text-muted-foreground'
                    : holding.unrealisedProfitLossApp >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
                )}>
                  {masked
                    ? '••••'
                    : holding.unrealisedProfitLossApp === undefined
                      ? 'Gain unavailable'
                      : `${money(holding.unrealisedProfitLossApp)} on paper`}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  )
}
