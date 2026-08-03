import { AlertTriangle, ArrowRight, CheckCircle2, CircleHelp, Settings2 } from 'lucide-react'
import { m, useReducedMotion } from 'framer-motion'
import type { AppTab, InvestmentAllocationOverview, InvestmentAllocationStatus, InvestmentPortfolio } from '../../types'
import { Button } from '../ui/Button'
import { InfoHint } from '../ui/InfoHint'
import { formatCurrencyVal } from '../../lib/utils'
import { useMemo, useState } from 'react'
import { allocationStatusLabel, buildSleeveIndex, UNASSIGNED_SLEEVE_KEY } from '../../lib/investmentAllocation'
import { breakdownBySleeve } from '../../lib/investmentSleeveBreakdown'
import { SleeveCard } from './SleeveCard'

const tone: Record<InvestmentAllocationStatus, string> = {
  NotStarted: 'border-border/60 bg-muted/20 text-muted-foreground',
  Incomplete: 'border-amber-500/30 bg-amber-500/8 text-amber-600 dark:text-amber-300',
  OnTrack: 'border-emerald-500/25 bg-emerald-500/7 text-emerald-600 dark:text-emerald-300',
  Watch: 'border-amber-500/25 bg-amber-500/7 text-amber-600 dark:text-amber-300',
  Alert: 'border-orange-500/30 bg-orange-500/8 text-orange-600 dark:text-orange-300',
}

const colors = ['bg-blue-500', 'bg-amber-500', 'bg-emerald-500']

export function InvestmentPlanPanel({
  allocation,
  holdings,
  instruments,
  usdRate,
  masked,
  onNavigate,
}: {
  allocation: InvestmentAllocationOverview
  holdings: InvestmentPortfolio['holdings']
  instruments: InvestmentPortfolio['instruments']
  usdRate?: number
  masked: boolean
  onNavigate: (tab: AppTab) => void
}) {
  const [showUsd, setShowUsd] = useState(false)
  const reduceMotion = useReducedMotion()
  const isUsd = showUsd && usdRate !== undefined
  const rate = isUsd ? usdRate : 1
  const currency = isUsd ? 'USD' : allocation.appCurrency

  const money = (value?: number) => value === undefined
    ? 'Incomplete'
    : masked ? '••••' : formatCurrencyVal(isUsd ? value / rate : value, currency)
  const configure = () => {
    const next = new URL(window.location.href)
    next.searchParams.set('section', 'investment-plan')
    window.history.replaceState(window.history.state, '', next)
    onNavigate('settings')
  }
  const StatusIcon = allocation.status === 'OnTrack'
    ? CheckCircle2
    : allocation.status === 'Incomplete' || allocation.status === 'NotStarted' ? CircleHelp : AlertTriangle
  const actionableRecommendations = allocation.recommendations.filter(
    recommendation => recommendation.kind !== 'UseCash',
  )
  const showGuidance = allocation.status !== 'OnTrack' &&
    (allocation.incompleteReasons.length > 0 || actionableRecommendations.length > 0)
  const contributionPlan = allocation.contributionPlan
  // Grouped once here, not per card — every card needs a different slice of the
  // same single pass over the holdings.
  const constituentsBySleeve = useMemo(
    () => breakdownBySleeve(holdings, buildSleeveIndex(instruments)),
    [holdings, instruments],
  )
  const unassigned = constituentsBySleeve.get(UNASSIGNED_SLEEVE_KEY) ?? []

  return (
    <m.section
      aria-labelledby="investment-plan-heading"
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="app-panel group/plan rounded-2xl border border-border/60 bg-card/92 p-5 transition-[border-color,box-shadow] duration-300 hover:border-primary/25 hover:shadow-lg hover:shadow-primary/5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 rounded-xl border p-2 transition-transform duration-300 group-hover/plan:scale-105 ${tone[allocation.status]}`}>
            <StatusIcon className="size-4" />
          </div>
          <div>
            <h2 id="investment-plan-heading" className="flex items-center gap-1 text-base font-bold text-foreground">
              Three-fund investment plan
              <InfoHint
                label="the three-fund plan"
                align="left"
                text="You pick a target mix of three baskets. This card shows the mix you actually hold across all your brokers, and what to buy next to get back to target."
              />
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Across every brokerage account · {allocationStatusLabel(allocation.status)}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={configure} className="group/configure">
          <Settings2 className="size-4 transition-transform duration-300 group-hover/configure:rotate-45" /> Configure
        </Button>
      </div>

      <div className="mt-5 grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {allocation.sleeves.map((sleeve, index) => (
          <SleeveCard
            key={sleeve.sleeve}
            sleeve={sleeve}
            constituents={constituentsBySleeve.get(sleeve.sleeve) ?? []}
            masked={masked}
            money={money}
            colorClass={colors[index]}
            toneClass={tone[sleeve.status]}
            animationIndex={index}
          />
        ))}
        {unassigned.length > 0 && (
          <SleeveCard
            sleeve={{ label: 'Not sorted yet', status: 'Incomplete' }}
            constituents={unassigned}
            masked={masked}
            money={money}
            colorClass="bg-muted-foreground"
            toneClass={tone.Incomplete}
            animationIndex={allocation.sleeves.length}
          />
        )}
      </div>

      {contributionPlan && (
        <div className="mt-5 rounded-xl border border-border/50 bg-muted/20 p-4 transition-all duration-300 hover:border-primary/20 hover:bg-muted/30 hover:shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="flex items-center gap-1 text-xs font-bold text-foreground">
              Your next deposit, split three ways
              <InfoHint
                label="how your next deposit is split"
                align="left"
                text="Your routine Growth money, divided so the mix you hold keeps matching your target. On target, this is simply your target percentages. If a basket has drifted low, more of the deposit goes there so the mix corrects itself without you selling anything."
              />
            </h3>
            <span className="rounded-full border border-border/60 bg-background/60 px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
              {money(contributionPlan.amount)} to invest
            </span>
          </div>
          <ul className="mt-3 grid gap-2 sm:grid-cols-3">
            {contributionPlan.sleeves.map((sleeve, index) => (
              <li
                key={sleeve.sleeve}
                className="rounded-lg border border-border/50 bg-background/50 p-3 transition-colors duration-200 hover:border-primary/25"
              >
                <div className="flex items-center gap-2">
                  <span className={`size-2 shrink-0 rounded-full ${colors[index]}`} aria-hidden="true" />
                  <span className="min-w-0 truncate text-[11px] font-bold text-foreground">{sleeve.label}</span>
                </div>
                <strong className="mt-2 block text-lg text-foreground">{money(sleeve.amount)}</strong>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {sleeve.percentageOfContribution.toFixed(1)}% of this deposit · leaves you at {sleeve.projectedPercentage.toFixed(1)}%
                  {Math.abs(sleeve.projectedDriftPercentagePoints) >= 0.05
                    ? ` (${sleeve.projectedDriftPercentagePoints > 0 ? '+' : ''}${sleeve.projectedDriftPercentagePoints.toFixed(1)} off target)`
                    : ' (on target)'}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[10px] text-muted-foreground">
            {contributionPlan.basis} Buying in these proportions keeps your mix on target without selling anything.
            {contributionPlan.isEstimated ? ' Record a Growth deposit and this will follow your own rhythm instead.' : ''}
          </p>
        </div>
      )}

      <div className={`mt-5 grid gap-4 ${showGuidance ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]' : ''}`}>
        <div className="rounded-xl border border-border/50 bg-muted/20 p-4 transition-all duration-300 hover:border-primary/20 hover:bg-muted/30 hover:shadow-sm">
          <h3 className="flex items-center gap-1 text-xs font-bold text-foreground">
            What you hold vs your target
            <InfoHint
              label="what you hold versus your target"
              align="left"
              text="The top bar is the mix you hold today; the bottom bar is the mix you are aiming for. The closer they look, the better."
            />
          </h3>
          <div className="mt-3 space-y-3">
            <div>
              <div className="mb-1 flex justify-between text-[10px] text-muted-foreground"><span>Actual</span><span>100%</span></div>
              <div className="flex h-3 overflow-hidden rounded-full bg-muted">
                {allocation.sleeves.map((sleeve, index) => (
                  <m.div key={sleeve.sleeve} className={colors[index]} initial={reduceMotion ? false : { scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.5, delay: index * 0.06 }} style={{ width: `${sleeve.currentPercentage ?? 0}%`, transformOrigin: 'left' }} />
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1 flex justify-between text-[10px] text-muted-foreground"><span>Target</span><span>100%</span></div>
              <div className="flex h-3 overflow-hidden rounded-full bg-muted">
                {allocation.sleeves.map((sleeve, index) => (
                  <m.div key={sleeve.sleeve} className={`${colors[index]} opacity-80`} initial={reduceMotion ? false : { scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.5, delay: 0.12 + index * 0.06 }} style={{ width: `${sleeve.targetPercentage}%`, transformOrigin: 'left' }} />
                ))}
              </div>
            </div>
          </div>
          <p className="mt-3 text-[10px] text-muted-foreground">
            {allocation.freshness.asOf
              ? `Required market data checked ${new Date(allocation.freshness.asOf).toLocaleString()}.`
              : 'Market-data freshness is not available yet.'}
            {allocation.freshness.isStale ? ' A quiet refresh is due.' : ''}
          </p>
        </div>

        {showGuidance && <div className="rounded-xl border border-border/50 bg-muted/20 p-4 transition-all duration-300 hover:border-primary/20 hover:bg-muted/30 hover:shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-1 text-xs font-bold text-foreground">
              What to do next
              <InfoHint
                label="what to do next"
                align="left"
                text="Steps in order, cheapest first: add new money before selling anything."
              />
            </h3>
            {usdRate !== undefined && allocation.appCurrency !== 'USD' && (
              <div className="flex rounded-xl bg-muted/40 p-1">
                <Button variant="unstyled" type="button" onClick={() => setShowUsd(true)} aria-pressed={showUsd} className={`cursor-pointer rounded-lg px-2 py-1 text-[10px] font-bold transition-all duration-200 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring ${showUsd ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}>USD</Button>
                <Button variant="unstyled" type="button" onClick={() => setShowUsd(false)} aria-pressed={!showUsd} className={`cursor-pointer rounded-lg px-2 py-1 text-[10px] font-bold transition-all duration-200 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring ${!showUsd ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}>{allocation.appCurrency}</Button>
              </div>
            )}
          </div>
          {allocation.incompleteReasons.length > 0 ? (
            <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
              {allocation.incompleteReasons.map(reason => <li key={reason}>• {reason}</li>)}
            </ul>
          ) : actionableRecommendations.length > 0 ? (
            <ol className="mt-3 space-y-2">
              {actionableRecommendations.map((recommendation, index) => {
                const amountStr = money(recommendation.amount)
                const sleeve = recommendation.sleeve ? allocation.sleeves.find(s => s.sleeve === recommendation.sleeve)?.label : ''
                let customMessage = masked ? recommendation.message.replace(/[A-Z]{3} [\d,.]+/g, '••••') : recommendation.message
                switch(recommendation.kind) {
                  case 'TopUp': customMessage = `Use your usual completed-cycle Growth deposit of ${amountStr} before considering any sale.`; break
                  case 'Buy': customMessage = `Buy ${amountStr} of ${sleeve} with new money.`; break
                  case 'Sell': customMessage = `Only after investing new money, sell ${amountStr} of ${sleeve}.`; break
                  case 'TransferBuy': customMessage = `Reinvest ${amountStr} of sale proceeds into ${sleeve}.`; break
                }
                return (
                  <m.li
                    key={`${recommendation.kind}-${recommendation.sleeve ?? index}`}
                    initial={reduceMotion ? false : { opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.25, delay: reduceMotion ? 0 : index * 0.05 }}
                    className="group/guidance flex gap-2 rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition-colors duration-200 hover:bg-background/70 hover:text-foreground"
                  >
                    <span className="font-bold text-foreground transition-transform duration-200 group-hover/guidance:translate-x-0.5">{index + 1}.</span>
                    <span>{customMessage}</span>
                  </m.li>
                )
              })}
            </ol>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              {allocation.status === 'OnTrack' ? 'No rebalancing action is needed.' : 'Complete your holdings to begin allocation guidance.'}
            </p>
          )}
          {allocation.status === 'Incomplete' && (
            <Button variant="ghost" size="sm" onClick={configure} className="mt-3">
              Finish classification <ArrowRight className="size-4" />
            </Button>
          )}
        </div>}
      </div>
    </m.section>
  )
}
