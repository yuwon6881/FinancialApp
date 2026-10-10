import type { ReactNode } from 'react'
import { ArrowDownLeft, ArrowUpRight, ChevronRight } from 'lucide-react'
import type { DashboardData } from '../../types'
import type { NavigateToLedgerOptions } from '../dashboard/types'
import { cn } from '../../lib/utils'
import { AmountText } from '../ui/AmountText'
import { Button } from '../ui/Button'
import { InteractiveCard } from '../ui/InteractiveCard'
import { SegmentedMeter } from '../ui/SegmentedMeter'
import { panelClass } from '../ui/panelStyles'

interface CycleFlowStats {
  monthlyIncome: number
  monthlyInflow: number
  monthlyExpenses: number
  activeRecurringTotal: number
}

interface CycleReportHeroProps {
  stats: CycleFlowStats
  insights?: NonNullable<DashboardData['cycleSummaryInsights']>
  currency: string
  /** Sensitive mode: every figure in the hero is a passive report figure. */
  isMasked: boolean
  formatSensitive: (value: number) => ReactNode
  onNavigateToLedger?: (options: NavigateToLedgerOptions) => void
  /** Present only when the biggest expense resolves to a transaction the ledger can highlight. */
  onSelectLargestExpense?: () => void
}

const SPENT_COLOR = 'color-mix(in srgb, var(--foreground) 62%, transparent)'
const KEPT_COLOR = 'var(--color-emerald-500)'

/**
 * The cycle report's opening line: what came in, what went out, and what that left. The net is
 * the one hero figure; inflow and outflow sit beside it as the two ways into the ledger, and the
 * glance facts run underneath as a single hairline-divided strip instead of four nested boxes.
 */
export function CycleReportHero({
  stats,
  insights,
  currency,
  isMasked,
  formatSensitive,
  onNavigateToLedger,
  onSelectLargestExpense,
}: CycleReportHeroProps) {
  const inflow = stats.monthlyInflow
  const outflow = stats.monthlyExpenses
  const net = inflow - outflow
  const spentShare = inflow > 0 ? Math.round(Math.min(outflow / inflow, 1) * 100) : null
  const caption = isMasked
    ? null
    : inflow <= 0
      ? outflow > 0 ? 'Nothing has come in yet this cycle.' : 'No money has moved yet this cycle.'
      : net >= 0
        ? `Kept ${100 - (spentShare ?? 0)}% of what came in.`
        : <>Spent {formatSensitive(-net)} more than came in.</>

  return (
    <section
      id="report-section-overview"
      aria-labelledby="cycle-report-heading"
      className={cn(panelClass, '@container overflow-hidden')}
    >
      <div className="flex flex-col gap-5 p-5 sm:p-6 @3xl:flex-row @3xl:items-end @3xl:justify-between @3xl:gap-10">
        <div className="min-w-0 @3xl:max-w-md @3xl:flex-1">
          <h2 id="cycle-report-heading" className="text-label text-muted-foreground">Net this cycle</h2>
          <div data-testid="cycle-net" className="mt-1 min-w-0">
            <AmountText
              value={net}
              currency={currency}
              isMasked={isMasked}
              signDisplay="always"
              tone="positive"
              className="text-display text-foreground @xs:text-hero"
            />
          </div>
          <SegmentedMeter
            className="mt-4"
            size="sm"
            total={Math.max(inflow, outflow)}
            label={isMasked || spentShare === null ? 'Outflow against inflow this cycle' : `${spentShare}% of this cycle's inflow went out`}
            segments={[
              { label: 'Went out', value: outflow, color: SPENT_COLOR },
              { label: 'Kept', value: Math.max(0, net), color: KEPT_COLOR },
            ]}
          />
          {caption && <p className="mt-2 text-caption text-muted-foreground">{caption}</p>}
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-2 @xs:grid-cols-2 @3xl:w-[26rem] @3xl:shrink-0">
          <FlowTile
            label="Inflow"
            icon={<ArrowDownLeft className="size-3.5" aria-hidden="true" />}
            amount={<AmountText value={inflow} currency={currency} isMasked={isMasked} tone="positive" className="text-section text-foreground @3xl:text-title" />}
            detail={<>Income {formatSensitive(stats.monthlyIncome)}</>}
            onClick={() => onNavigateToLedger?.({ txType: 'inflow' })}
          />
          <FlowTile
            label="Outflow"
            icon={<ArrowUpRight className="size-3.5" aria-hidden="true" />}
            amount={<AmountText value={outflow} currency={currency} isMasked={isMasked} className="text-section text-foreground @3xl:text-title" />}
            detail={<span title="Active bills, monthly equivalent">Bills {formatSensitive(stats.activeRecurringTotal)}/mo</span>}
            onClick={() => onNavigateToLedger?.({ txType: 'outflow' })}
          />
        </div>
      </div>

      {insights && (
        <dl
          aria-label="This cycle at a glance"
          className="grid grid-cols-2 gap-px border-t border-border/60 bg-border/60 @xl:grid-cols-4"
        >
          <GlanceStat label="Transactions" value={insights.transactionCount} />
          <GlanceStat label="No-spend days" value={insights.noSpendDays} />
          <GlanceStat
            label="Average per day"
            value={insights.avgDailySpend == null ? 'Unavailable' : formatSensitive(insights.avgDailySpend)}
          />
          <div className="group relative min-w-0 bg-card px-4 py-3.5 transition-colors has-[>button:hover]:bg-surface-2 @sm:px-5 sm:px-6">
            {onSelectLargestExpense && (
              // The cell stays the same <div> its neighbours are, so <dt>/<dd> remain legal children
              // of the list; the action is a full-bleed overlay. Square corners: the panel clips it.
              <Button
                variant="tertiary"
                onClick={onSelectLargestExpense}
                aria-label={`View biggest expense: ${insights.largestExpenseDescription || 'transaction'} in Ledger`}
                className="absolute inset-0 z-0 size-full min-h-0 rounded-none p-0 hover:bg-transparent focus-visible:-outline-offset-2 lg:min-h-0"
              />
            )}
            <div className="pointer-events-none relative flex min-w-0 items-start gap-1">
              <div className="min-w-0 flex-1">
                <dt className="truncate text-caption text-muted-foreground">Biggest expense</dt>
                <dd className="mt-0.5 min-w-0">
                  <span className="block truncate text-subsection text-foreground tabular-nums">
                    {insights.largestExpenseAmount == null ? 'None' : formatSensitive(Math.abs(insights.largestExpenseAmount))}
                  </span>
                  {insights.largestExpenseDescription && (
                    <span className="mt-0.5 block truncate text-caption text-muted-foreground" title={insights.largestExpenseDescription}>
                      {insights.largestExpenseDescription}
                    </span>
                  )}
                </dd>
              </div>
              {onSelectLargestExpense && (
                <ChevronRight className="-mr-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              )}
            </div>
          </div>
        </dl>
      )}
    </section>
  )
}

function FlowTile({
  label,
  icon,
  amount,
  detail,
  onClick,
}: {
  label: string
  icon: ReactNode
  amount: ReactNode
  detail: ReactNode
  onClick: () => void
}) {
  return (
    <InteractiveCard
      surface="plain"
      onClick={onClick}
      className="group min-w-0 rounded-control bg-surface-2/70 px-3.5 py-3 hover:bg-surface-2 sm:px-4"
    >
      <span className="flex items-center justify-between gap-2 text-label text-muted-foreground">
        <span className="flex min-w-0 items-center gap-1.5">
          {icon}
          <span className="truncate">{label}</span>
        </span>
        <ChevronRight className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </span>
      <span className="mt-1 block min-w-0 truncate">{amount}</span>
      <span className="mt-0.5 block truncate text-caption text-muted-foreground tabular-nums">{detail}</span>
    </InteractiveCard>
  )
}

function GlanceStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 bg-card px-4 py-3.5 @sm:px-5 sm:px-6">
      <dt className="truncate text-caption text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate text-subsection text-foreground tabular-nums">{value}</dd>
    </div>
  )
}
