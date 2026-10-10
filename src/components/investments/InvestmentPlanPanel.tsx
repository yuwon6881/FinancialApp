import { useMemo, useState } from 'react'
import { ArrowRight, Circle, Settings2 } from 'lucide-react'
import type { AppTab, InvestmentAllocationOverview, InvestmentAllocationStatus, InvestmentPortfolio } from '../../types'
import { Button } from '../ui/Button'
import { Badge, type BadgeTone } from '../ui/Badge'
import { InfoHint } from '../ui/InfoHint'
import { SegmentedMeter } from '../ui/SegmentedMeter'
import { cn, formatCurrencyVal } from '../../lib/utils'
import { allocationStatusLabel, buildSleeveIndex, UNASSIGNED_SLEEVE_KEY } from '../../lib/investmentAllocation'
import { breakdownBySleeve } from '../../lib/investmentSleeveBreakdown'
import { SleeveCard } from './SleeveCard'
import { InvestmentMovementPlanner } from './InvestmentMovementPlanner'
import { panelClass } from '../ui/panelStyles'
import type { AppNavigationOptions } from '../../lib/appLocation'

const STATUS_TONES: Record<InvestmentAllocationStatus, BadgeTone> = {
  NotStarted: 'neutral',
  Incomplete: 'warning',
  OnTrack: 'success',
  Watch: 'warning',
  Alert: 'urgent',
}

/** Fill classes for the planner, and the same three colours as CSS values for the meters. */
const colors = ['bg-primary', 'bg-amber-500', 'bg-emerald-500']
const sleeveColors = ['var(--primary)', 'var(--color-amber-500)', 'var(--color-emerald-500)']
const UNSORTED_COLOR = 'var(--muted-foreground)'
/** A checklist longer than this hides the rest behind "Show all": nine lines of setup was a wall. */
const CHECKLIST_PREVIEW = 3

export function InvestmentPlanPanel({
  allocation,
  holdings,
  instruments,
  fxRates = [],
  masked,
  onNavigate,
}: {
  allocation: InvestmentAllocationOverview
  holdings: InvestmentPortfolio['holdings']
  instruments: InvestmentPortfolio['instruments']
  fxRates?: InvestmentPortfolio['planFxRates']
  /** Retained for callers during the portfolio contract transition; native ETF rates are used. */
  reference?: { currency: string; rate: number }
  masked: boolean
  onNavigate: (tab: AppTab, options?: AppNavigationOptions) => void
}) {
  const [showAllSteps, setShowAllSteps] = useState(false)
  const currency = allocation.appCurrency

  const money = (value?: number) => value === undefined
    ? 'Incomplete'
    : masked ? '••••' : formatCurrencyVal(value, currency)
  const configure = () => {
    onNavigate('settings', { search: { section: 'investment-plan' } })
  }
  const showGuidance = allocation.incompleteReasons.length > 0
  const classificationIncomplete = allocation.status === 'Incomplete'
  // Grouped once here, not per row — every row needs a different slice of the
  // same single pass over the holdings.
  const constituentsBySleeve = useMemo(
    () => breakdownBySleeve(holdings, buildSleeveIndex(instruments)),
    [holdings, instruments],
  )
  const unassigned = constituentsBySleeve.get(UNASSIGNED_SLEEVE_KEY) ?? []
  const steps = showAllSteps ? allocation.incompleteReasons : allocation.incompleteReasons.slice(0, CHECKLIST_PREVIEW)
  const hiddenSteps = allocation.incompleteReasons.length - steps.length
  const actualKnown = allocation.sleeves.some(sleeve => sleeve.currentPercentage !== undefined)

  return (
    <section aria-labelledby="investment-plan-heading" className={cn(panelClass, '@container overflow-hidden')}>
      <div className="flex items-start justify-between gap-3 px-5 pt-5 sm:px-6">
        <div className="min-w-0">
          <h2 id="investment-plan-heading" className="flex items-center gap-1 text-section text-foreground">
            Three-fund investment plan
            <InfoHint
              label="the three-fund plan"
              align="left"
              text="See your target mix, current holdings, and what to buy next."
            />
          </h2>
          <Badge tone={STATUS_TONES[allocation.status]} className="mt-1">{allocationStatusLabel(allocation.status)}</Badge>
        </div>
        <Button variant="secondary" size="sm" onClick={configure} className="shrink-0 @max-xs:size-11 @max-xs:p-0">
          <Settings2 className="size-4" aria-hidden="true" /> <span className="@max-xs:sr-only">Configure</span>
        </Button>
      </div>

      <div className="mt-2 @4xl:grid @4xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] @4xl:gap-2">
        <ul aria-label="Plan baskets" className="divide-y divide-border/50">
          {allocation.sleeves.map((sleeve, index) => (
            <SleeveCard
              key={sleeve.sleeve}
              sleeve={sleeve}
              constituents={constituentsBySleeve.get(sleeve.sleeve) ?? []}
              masked={masked}
              money={money}
              color={sleeveColors[index] ?? UNSORTED_COLOR}
            />
          ))}
          {unassigned.length > 0 && (
            <SleeveCard
              sleeve={{ label: 'Not sorted yet', status: 'Incomplete' }}
              constituents={unassigned}
              masked={masked}
              money={money}
              color={UNSORTED_COLOR}
            />
          )}
        </ul>

        <div className="space-y-3 px-5 pb-5 pt-2 sm:px-6 @4xl:pl-0 @4xl:pt-3.5">
          <div className="rounded-control bg-surface-2/70 p-4">
            <h3 className="flex items-center gap-1 text-label font-medium text-foreground">
              What you hold vs your target
              <InfoHint
                label="what you hold versus your target"
                align="left"
                text="Top bar: current mix. Bottom bar: target mix."
              />
            </h3>
            <div className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2.5 text-caption text-muted-foreground">
              <span>Actual</span>
              {actualKnown
                ? <SegmentedMeter
                    size="md"
                    segments={allocation.sleeves.map((sleeve, index) => ({ value: sleeve.currentPercentage ?? 0, color: sleeveColors[index] ?? UNSORTED_COLOR, label: sleeve.label }))}
                    label={`Current mix: ${allocation.sleeves.map(sleeve => `${sleeve.label} ${sleeve.currentPercentage === undefined ? 'unknown' : `${sleeve.currentPercentage.toFixed(1)}%`}`).join(', ')}`}
                  />
                : <span>Waiting on prices</span>}
              <span>Target</span>
              <SegmentedMeter
                size="md"
                segments={allocation.sleeves.map((sleeve, index) => ({ value: sleeve.targetPercentage, color: sleeveColors[index] ?? UNSORTED_COLOR, label: sleeve.label }))}
                label={`Target mix: ${allocation.sleeves.map(sleeve => `${sleeve.label} ${sleeve.targetPercentage}%`).join(', ')}`}
              />
            </div>
            <p className="mt-3 text-caption text-muted-foreground">
              {allocation.freshness.asOf
                ? `Required market data checked ${new Date(allocation.freshness.asOf).toLocaleString()}.`
                : 'Market-data freshness is not available yet.'}
              {allocation.freshness.isStale ? ' A quiet refresh is due.' : ''}
            </p>
          </div>

          {showGuidance && <div className="rounded-control bg-surface-2/70 p-4">
            <h3 className="flex items-center gap-1 text-label font-medium text-foreground">
              {classificationIncomplete ? 'What to do next' : 'Why guidance is unavailable'}
              <InfoHint
                label="what to do next"
                align="left"
                text={classificationIncomplete
                  ? 'Complete setup so every holding joins the plan.'
                  : 'Missing exchange-rate data prevents a trustworthy cash-aware plan.'}
              />
            </h3>
            <ul className="mt-2 space-y-1.5">
              {steps.map(reason => (
                <li key={reason} className="flex items-start gap-2 text-caption text-muted-foreground">
                  <Circle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0">{reason}</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              {(hiddenSteps > 0 || showAllSteps) && allocation.incompleteReasons.length > CHECKLIST_PREVIEW ? (
                <Button variant="tertiary" size="sm" className="-ml-3.5 text-muted-foreground" aria-expanded={showAllSteps} onClick={() => setShowAllSteps(value => !value)}>
                  {showAllSteps ? 'Show fewer' : `Show ${hiddenSteps} more`}
                </Button>
              ) : <span />}
              {classificationIncomplete && (
                <Button variant="secondary" size="sm" onClick={configure}>
                  Finish classification <ArrowRight className="size-4" aria-hidden="true" />
                </Button>
              )}
            </div>
          </div>}
        </div>
      </div>

      <InvestmentMovementPlanner allocation={allocation} holdings={holdings} instruments={instruments} fxRates={fxRates} masked={masked} money={money} colors={colors} />
    </section>
  )
}
