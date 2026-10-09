import { ChevronDown } from 'lucide-react'
import { m, useReducedMotion } from 'framer-motion'
import type { InvestmentAllocationOverview, InvestmentAllocationStatus } from '../../types'
import type { SleeveConstituent } from '../../lib/investmentSleeveBreakdown'
import { allocationStatusLabel } from '../../lib/investmentAllocation'
import { Badge } from '../ui/Badge'

/** A basket that is part of the plan, or the catch-all for funds not sorted into one. */
type SleeveSummary =
  | InvestmentAllocationOverview['sleeves'][number]
  | { label: string; status: InvestmentAllocationStatus }

export function SleeveCard({
  sleeve,
  constituents,
  masked,
  money,
  colorClass,
  toneClass,
  animationIndex,
}: {
  sleeve: SleeveSummary
  constituents: SleeveConstituent[]
  masked: boolean
  money: (value?: number) => string
  colorClass: string
  toneClass: string
  animationIndex: number
}) {
  const reduceMotion = useReducedMotion()
  const isPlannedBasket = 'targetPercentage' in sleeve

  return (
    <m.article
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: reduceMotion ? 0 : animationIndex * 0.07 }}
      className="group/sleeve self-start rounded-panel border border-border/70 bg-card p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 flex-1 truncate text-subsection text-foreground">{sleeve.label}</span>
        {/* The status keeps its colour on the chip only, so a row of baskets reads as data first. */}
        <Badge tone="neutral" className={`border-transparent ${toneClass}`}>
          {allocationStatusLabel(sleeve.status)}
        </Badge>
      </div>
      {isPlannedBasket ? (
        <>
          <div className="mt-3 flex items-end gap-2">
            <strong className="text-title text-foreground tabular-nums">
              {sleeve.currentPercentage === undefined ? '—' : `${sleeve.currentPercentage.toFixed(1)}%`}
            </strong>
            <span className="pb-1 text-label text-muted-foreground">of your {sleeve.targetPercentage}% aim</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {money(sleeve.value)}
            {sleeve.driftPercentagePoints !== undefined
              ? ` · ${sleeve.driftPercentagePoints > 0 ? 'above' : 'below'} your aim by ${Math.abs(sleeve.driftPercentagePoints).toFixed(1)}%`
              : ''}
          </p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-foreground/8">
            <m.div
              className={`h-full origin-left ${colorClass}`}
              initial={reduceMotion ? false : { scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.55, delay: reduceMotion ? 0 : 0.12 + animationIndex * 0.08, ease: 'easeOut' }}
              style={{ width: `${Math.min(100, sleeve.currentPercentage ?? 0)}%` }}
            />
          </div>
        </>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          Not in a basket yet.
        </p>
      )}

      {constituents.length > 0 && (
        <details className="group/holdings mt-3 rounded-control bg-surface-2/60">
          <summary className="flex cursor-pointer select-none items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-caption font-semibold text-muted-foreground outline-none transition-colors hover:bg-background/30 focus-visible:ring-2 focus-visible:ring-ring/50">
            <span className="min-w-0 break-words">See the {constituents.length} fund{constituents.length === 1 ? '' : 's'} in this basket</span>
            <ChevronDown className="size-3.5 shrink-0 transition-transform duration-200 group-open/holdings:rotate-180" />
          </summary>
          <ul className="space-y-2 border-t border-border/60 px-3 py-2.5">
            {constituents.map(holding => (
              <li key={`${holding.accountId}-${holding.instrumentId}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 text-xs">
                <span className="truncate font-semibold text-foreground">{holding.symbol} · {holding.name}</span>
                <span className="text-right font-semibold text-foreground">{money(holding.valueApp)}</span>
                <span className="text-muted-foreground">
                  {holding.shareOfSleeve === undefined ? 'Share unavailable' : `${holding.shareOfSleeve.toFixed(1)}% of this basket`}
                </span>
                <span className={`text-right font-semibold ${holding.unrealisedProfitLossApp === undefined ? '' : holding.unrealisedProfitLossApp >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
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
    </m.article>
  )
}
