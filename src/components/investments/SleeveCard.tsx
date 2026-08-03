import { ChevronDown } from 'lucide-react'
import { m, useReducedMotion } from 'framer-motion'
import type { InvestmentAllocationOverview, InvestmentAllocationStatus } from '../../types'
import type { SleeveConstituent } from '../../lib/investmentSleeveBreakdown'
import { allocationStatusLabel } from '../../lib/investmentAllocation'

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
      whileHover={reduceMotion ? undefined : { y: -4, scale: 1.01 }}
      className={`group/sleeve self-start rounded-xl border p-4 shadow-sm transition-[border-color,box-shadow] duration-300 hover:border-current/30 hover:shadow-md ${toneClass}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold">{sleeve.label}</span>
        <span className="rounded-full bg-background/60 px-2 py-0.5 text-[10px] font-bold transition-transform duration-300 group-hover/sleeve:scale-105">
          {allocationStatusLabel(sleeve.status)}
        </span>
      </div>
      {isPlannedBasket ? (
        <>
          <div className="mt-3 flex items-end gap-2">
            <strong className="text-2xl text-foreground">
              {sleeve.currentPercentage === undefined ? '—' : `${sleeve.currentPercentage.toFixed(1)}%`}
            </strong>
            <span className="pb-1 text-xs text-muted-foreground">of your {sleeve.targetPercentage}% aim</span>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {money(sleeve.value)}
            {sleeve.driftPercentagePoints !== undefined
              ? ` · ${sleeve.driftPercentagePoints > 0 ? 'above' : 'below'} your aim by ${Math.abs(sleeve.driftPercentagePoints).toFixed(1)}%`
              : ''}
          </p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-background/70">
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
        <p className="mt-3 text-[10px] text-muted-foreground">
          These are not part of your plan yet. Put each one in a basket and it will start counting towards your aim.
        </p>
      )}

      {constituents.length > 0 && (
        <details className="group/holdings mt-3 rounded-lg border border-current/15 bg-background/20">
          <summary className="flex cursor-pointer select-none items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-[10px] font-bold text-muted-foreground outline-none transition-colors hover:bg-background/30 focus-visible:ring-2 focus-visible:ring-ring/50">
            <span>See the {constituents.length} fund{constituents.length === 1 ? '' : 's'} in this basket</span>
            <ChevronDown className="size-3.5 transition-transform duration-200 group-open/holdings:rotate-180" />
          </summary>
          <ul className="space-y-2 border-t border-current/15 px-3 py-2.5">
            {constituents.map(holding => (
              <li key={`${holding.accountId}-${holding.instrumentId}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 text-[10px]">
                <span className="truncate font-bold text-foreground">{holding.symbol} · {holding.name}</span>
                <span className="text-right font-bold text-foreground">{money(holding.valueApp)}</span>
                <span className="text-muted-foreground">
                  {holding.shareOfSleeve === undefined ? 'Share unavailable' : `${holding.shareOfSleeve.toFixed(1)}% of this basket`}
                </span>
                <span className={`text-right font-semibold ${holding.unrealisedProfitLossApp === undefined ? '' : holding.unrealisedProfitLossApp >= 0 ? 'text-emerald-500' : 'text-orange-500'}`}>
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
