import { AlertTriangle, ArrowRight, CheckCircle2, CircleHelp, Settings2 } from 'lucide-react'
import { m, useReducedMotion } from 'framer-motion'
import type { AppTab, InvestmentAllocationOverview, InvestmentAllocationStatus, InvestmentPortfolio } from '../../types'
import { Button } from '../ui/Button'
import { InfoHint } from '../ui/InfoHint'
import { formatCurrencyVal } from '../../lib/utils'
import { useMemo } from 'react'
import { allocationStatusLabel, buildSleeveIndex, UNASSIGNED_SLEEVE_KEY } from '../../lib/investmentAllocation'
import { breakdownBySleeve } from '../../lib/investmentSleeveBreakdown'
import { SleeveCard } from './SleeveCard'
import { DepositGuide } from './DepositGuide'
import { WithdrawalGuide } from './WithdrawalGuide'

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
  masked,
  onNavigate,
}: {
  allocation: InvestmentAllocationOverview
  holdings: InvestmentPortfolio['holdings']
  instruments: InvestmentPortfolio['instruments']
  /** The optional second currency this plan can also be read in. Absent means no toggle. */
  reference?: { currency: string; rate: number }
  masked: boolean
  onNavigate: (tab: AppTab) => void
}) {
  const reduceMotion = useReducedMotion()
  const currency = allocation.appCurrency

  const money = (value?: number) => value === undefined
    ? 'Incomplete'
    : masked ? '••••' : formatCurrencyVal(value, currency)
  const configure = () => {
    const next = new URL(window.location.href)
    next.searchParams.set('section', 'investment-plan')
    window.history.replaceState(window.history.state, '', next)
    onNavigate('settings')
  }
  const StatusIcon = allocation.status === 'OnTrack'
    ? CheckCircle2
    : allocation.status === 'Incomplete' || allocation.status === 'NotStarted' ? CircleHelp : AlertTriangle
  const showGuidance = allocation.incompleteReasons.length > 0
  const classificationIncomplete = allocation.status === 'Incomplete'
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
                text="See your target mix, current holdings, and what to buy next."
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
        <DepositGuide
          allocation={allocation}
          money={money}
          colors={colors}
        />
      )}

      {/* Only offered once the plan can actually be valued: an unpriced or unsorted
          portfolio cannot say which basket is overweight, so it cannot answer this. */}
      {(allocation.status === 'OnTrack' || allocation.status === 'Watch' || allocation.status === 'Alert') && (
        <WithdrawalGuide
          allocation={allocation}
          constituentsBySleeve={constituentsBySleeve}
          money={money}
          colors={colors}
        />
      )}

      <div className={`mt-5 grid gap-4 ${showGuidance ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]' : ''}`}>
        <div className="rounded-xl border border-border/50 bg-muted/20 p-4 transition-all duration-300 hover:border-primary/20 hover:bg-muted/30 hover:shadow-sm">
          <h3 className="flex items-center gap-1 text-xs font-bold text-foreground">
            What you hold vs your target
            <InfoHint
              label="what you hold versus your target"
              align="left"
              text="Top bar: current mix. Bottom bar: target mix."
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
              {classificationIncomplete ? 'What to do next' : 'Why guidance is unavailable'}
              <InfoHint
                label="what to do next"
                align="left"
                text={classificationIncomplete
                  ? 'Complete setup so every holding joins the plan.'
                  : 'Missing exchange-rate data prevents a trustworthy cash-aware plan.'}
              />
            </h3>
          </div>
          <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
            {allocation.incompleteReasons.map(reason => <li key={reason}>• {reason}</li>)}
          </ul>
          {classificationIncomplete && (
            <div className="mt-3 flex justify-end">
              <Button variant="ghost" size="sm" onClick={configure}>
                Finish classification <ArrowRight className="size-4" />
              </Button>
            </div>
          )}
        </div>}
      </div>
    </m.section>
  )
}
