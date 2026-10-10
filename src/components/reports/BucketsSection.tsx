import { useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight, TrendingUp, Wallet } from 'lucide-react'
import type { AppTab, CategorySummary, SavingsGoal } from '../../types'
import type { NavigateToLedgerOptions } from '../dashboard/types'
import { getCategoryChartColor } from '../../lib/categoryColors'
import { getRewardsAvailability } from '../../lib/freeRewards'
import { cn, SENSITIVE_AMOUNT_MASK } from '../../lib/utils'
import { AmountText } from '../ui/AmountText'
import { Button } from '../ui/Button'
import { CategoryIcon } from '../ui/CategoryIcon'
import { SectionHeader } from '../ui/SectionHeader'
import { SegmentedMeter } from '../ui/SegmentedMeter'
import { panelClass } from '../ui/panelStyles'
import { BucketAccountsSheet } from './BucketAccountsSheet'

interface GrowthMetric { target: number; currentPct: number; pending: number; safePct: number; atRiskPct: number }
interface EssentialsMetric { totalAvailable: number; currentPct: number; pending: number; projectedPct: number; atRiskPct: number }
interface StabilityMetric { hasTarget: boolean; currentPct: number; pending: number; projectedPct: number; atRiskPct: number }

export interface BucketsSectionProps {
  categories: CategorySummary[]
  isCurrentCycle: boolean
  cycleLabel: string
  pendingDeductionsByCategory: Record<string, number>
  savingsGoals?: SavingsGoal[]
  currency: string
  /** Sensitive mode or the balance toggle: either hides the rolling balances. */
  amountsMasked: boolean
  formatCurrency: (value: number) => string
  /** Plan figures follow sensitive mode only, as the plan metrics always have. */
  formatSensitive: (value: number) => ReactNode
  growthMetric: GrowthMetric
  essentialsMetric: EssentialsMetric
  stabilityMetric: StabilityMetric
  growthAlloc: number
  targetStabilityFund: number
  onNavigateToAccounts?: (targetIdOrBucket?: string | null) => void
  onNavigateToLedger?: (options: NavigateToLedgerOptions) => void
  onNavigate?: (tab: AppTab) => void
}

const PENDING_COLOR = 'var(--color-amber-500)'
const pct = (value: number) => `${(value * 100).toFixed(1)}%`

interface PlanMeter {
  label: string
  /** Current share, 0-1. */
  current: number
  /** Share after pending bills, 0-1; shown only while something is pending. */
  projected?: number
  fill: number
  atRisk: number
}

/**
 * The four buckets as one object: each bucket's rolling balance is the figure, its plan measure is
 * the bar, and the ledger behind the balance -- income added, carried over, the net change and
 * whatever is still pending -- is quiet detail. Phones list the buckets and open a row for its
 * detail; from a medium container the detail is always shown, two or four columns across.
 */
export function BucketsSection({
  categories,
  isCurrentCycle,
  cycleLabel,
  pendingDeductionsByCategory,
  savingsGoals = [],
  currency,
  amountsMasked,
  formatCurrency,
  formatSensitive,
  growthMetric,
  essentialsMetric,
  stabilityMetric,
  growthAlloc,
  targetStabilityFund,
  onNavigateToAccounts,
  onNavigateToLedger,
  onNavigate,
}: BucketsSectionProps) {
  const [openBuckets, setOpenBuckets] = useState<ReadonlySet<string>>(() => new Set())
  const [accountsBucket, setAccountsBucket] = useState<CategorySummary | null>(null)
  const amount = (value: number) => amountsMasked ? SENSITIVE_AMOUNT_MASK : formatCurrency(value)

  const toggle = (name: string) => setOpenBuckets(current => {
    const next = new Set(current)
    if (next.has(name)) next.delete(name)
    else next.add(name)
    return next
  })

  const planMeter = (bucket: CategorySummary): PlanMeter | null => {
    if (bucket.name === 'Essentials') {
      return { label: 'Remaining', current: essentialsMetric.currentPct, projected: essentialsMetric.pending > 0 ? essentialsMetric.projectedPct : undefined, fill: essentialsMetric.projectedPct, atRisk: essentialsMetric.pending > 0 ? essentialsMetric.atRiskPct : 0 }
    }
    if (bucket.name === 'Growth') {
      return { label: 'Plan achieved', current: growthMetric.currentPct, projected: growthMetric.pending > 0 ? growthMetric.safePct : undefined, fill: growthMetric.safePct, atRisk: growthMetric.pending > 0 ? growthMetric.atRiskPct : 0 }
    }
    if (bucket.name === 'Stability' && stabilityMetric.hasTarget) {
      return { label: 'Fund cap reached', current: stabilityMetric.currentPct, projected: stabilityMetric.pending > 0 ? stabilityMetric.projectedPct : undefined, fill: stabilityMetric.projectedPct, atRisk: stabilityMetric.pending > 0 ? stabilityMetric.atRiskPct : 0 }
    }
    return null
  }

  return (
    <section id="report-section-buckets" aria-labelledby="report-buckets-heading" className="@container space-y-3">
      <SectionHeader
        titleId="report-buckets-heading"
        title="Buckets"
        description="Rolling balances: this cycle's income plus what carried over."
      />
      <ul className={cn(panelClass, 'grid gap-px overflow-hidden bg-border/60 p-0 @xl:grid-cols-2 @4xl:grid-cols-4')}>
        {categories.map(bucket => {
          const key = bucket.name.toLowerCase()
          const pending = pendingDeductionsByCategory[bucket.name] ?? 0
          const rewards = isCurrentCycle && bucket.name === 'Rewards'
            ? getRewardsAvailability(bucket.remaining, savingsGoals, pending)
            : null
          const accountCount = bucket.accounts?.length ?? 0
          const open = openBuckets.has(bucket.name)
          const detailsId = `bucket-details-${key}`
          const color = getCategoryChartColor(bucket.name)
          const plan = planMeter(bucket)
          const freeShare = rewards && bucket.remaining > 0 ? Math.min(1, rewards.freeToSpend / bucket.remaining) : null
          const projected = bucket.remaining - pending

          return (
            <li key={bucket.name} data-testid={`bucket-${key}`} className="flex min-w-0 flex-col bg-card">
              <div className="relative px-4 py-3.5 transition-colors has-[>button:hover]:bg-surface-2/60 @xl:px-5 @xl:pb-4 @xl:pt-5">
                <Button
                  variant="tertiary"
                  onClick={() => toggle(bucket.name)}
                  aria-expanded={open}
                  aria-controls={detailsId}
                  aria-label={`${bucket.name} details`}
                  className="absolute inset-0 z-0 size-full min-h-0 rounded-none p-0 hover:bg-transparent focus-visible:-outline-offset-2 @xl:hidden"
                />
                <div className="pointer-events-none relative">
                  <div className="flex flex-wrap items-center gap-x-3">
                    <CategoryIcon category={bucket.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-body font-medium text-foreground">{bucket.name}</h3>
                      <p className="truncate text-caption text-muted-foreground tabular-nums">{(bucket.allocation * 100).toFixed(0)}% of income</p>
                    </div>
                    <div className="shrink-0 text-right @xl:order-last @xl:mt-3 @xl:basis-full @xl:text-left">
                      <span className="sr-only">Remaining balance </span>
                      <AmountText
                        value={bucket.remaining}
                        currency={currency}
                        isMasked={amountsMasked}
                        className={cn('text-subsection @xl:text-title', bucket.remaining < 0 ? 'text-red-600 dark:text-red-400' : 'text-foreground')}
                      />
                    </div>
                    <ChevronDown
                      aria-hidden="true"
                      className={cn('size-4 shrink-0 text-muted-foreground transition-transform duration-200 @xl:hidden', open && 'rotate-180')}
                    />
                  </div>

                  {plan ? (
                    <div className="mt-3">
                      <SegmentedMeter
                        size="sm"
                        total={1}
                        label={`${bucket.name} ${plan.label.toLowerCase()}: ${pct(plan.current)}${plan.projected !== undefined ? `, ${pct(plan.projected)} after pending bills` : ''}`}
                        segments={[
                          { label: plan.label, value: plan.fill, color },
                          { label: 'Pending', value: plan.atRisk, color: PENDING_COLOR },
                        ]}
                      />
                      <p className="mt-1.5 flex items-baseline justify-between gap-2 text-caption">
                        <span className="text-muted-foreground">{plan.label}</span>
                        <span className="tabular-nums text-foreground">
                          {pct(plan.current)}
                          {plan.projected !== undefined && <span className="ml-1 text-amber-700 dark:text-amber-300">→ {pct(plan.projected)}</span>}
                        </span>
                      </p>
                    </div>
                  ) : freeShare !== null ? (
                    <div className="mt-3">
                      <SegmentedMeter
                        size="sm"
                        total={1}
                        label={`${bucket.name}: ${Math.round(freeShare * 100)}% free to spend`}
                        segments={[{ label: 'Free to spend', value: freeShare, color }]}
                      />
                      <p className="mt-1.5 flex items-baseline justify-between gap-2 text-caption">
                        <span className="text-muted-foreground">Free share</span>
                        <span className="tabular-nums text-foreground">{Math.round(freeShare * 100)}%</span>
                      </p>
                    </div>
                  ) : bucket.name === 'Stability' ? (
                    <p className="mt-3 text-caption text-muted-foreground">No Stability limit is set.</p>
                  ) : null}
                </div>
              </div>

              <div id={detailsId} className={cn('flex-1 flex-col px-4 pb-4 @xl:flex @xl:px-5 @xl:pb-5', open ? 'flex' : 'hidden')}>
                <dl className="space-y-2 rounded-control bg-surface-2/70 p-3 @xl:rounded-none @xl:border-t @xl:border-border/60 @xl:bg-transparent @xl:px-0 @xl:pb-0 @xl:pt-3">
                  <DetailRow label="Income added" value={amount(bucket.incomeAllocated ?? bucket.target)} />
                  <DetailRow label="Carried over" value={amount(bucket.budget)} />
                  <DetailRow
                    label="Net change"
                    value={amountsMasked ? SENSITIVE_AMOUNT_MASK : `${bucket.netChange > 0 ? '+' : ''}${formatCurrency(bucket.netChange)}`}
                    className={bucket.netChange > 0 && !amountsMasked ? 'text-emerald-600 dark:text-emerald-400' : undefined}
                  />
                  {rewards ? (
                    <>
                      <DetailRow label="Committed" value={amount(rewards.committed)} />
                      <DetailRow label="Free to spend" value={amount(rewards.freeToSpend)} />
                    </>
                  ) : pending > 0 && (
                    <>
                      <DetailRow label="Pending" value={`-${amount(pending)}`} className="text-amber-700 dark:text-amber-300" />
                      <DetailRow
                        label="Projected"
                        value={amount(projected)}
                        className={projected < 0 ? 'text-red-600 dark:text-red-400' : undefined}
                      />
                    </>
                  )}
                  {bucket.name === 'Essentials' && (
                    <DetailRow label="Available budget" value={formatSensitive(essentialsMetric.totalAvailable)} />
                  )}
                  {bucket.name === 'Growth' && (
                    <DetailRow
                      label={`Plan target · ${(growthAlloc * 100).toFixed(0)}% of income`}
                      value={formatSensitive(growthMetric.target)}
                    />
                  )}
                  {bucket.name === 'Stability' && (
                    <DetailRow label="Fund target" value={stabilityMetric.hasTarget ? formatSensitive(targetStabilityFund) : 'No limit set'} />
                  )}
                </dl>

                <div className="mt-3 flex flex-wrap items-center gap-1.5 @xl:mt-auto @xl:pt-4">
                  {accountCount > 0 && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setAccountsBucket(bucket)}
                      title={`View ${accountCount} ${accountCount === 1 ? 'account' : 'accounts'} in ${bucket.name}`}
                      aria-label={`View account breakdown for ${bucket.name}`}
                    >
                      <Wallet className="size-3.5" aria-hidden="true" />
                      {accountCount} {accountCount === 1 ? 'account' : 'accounts'}
                    </Button>
                  )}
                  {onNavigateToLedger && (
                    <Button
                      variant="tertiary"
                      size="sm"
                      onClick={() => onNavigateToLedger({
                        category: bucket.name,
                        showAllCycles: bucket.name === 'Growth' || bucket.name === 'Stability',
                      })}
                      aria-label={`View ${bucket.name} activity in Ledger`}
                      className="px-2.5"
                    >
                      Activity
                      <ChevronRight className="size-3.5" aria-hidden="true" />
                    </Button>
                  )}
                  {bucket.name === 'Growth' && onNavigate && (
                    <Button
                      variant="tertiary"
                      size="sm"
                      onClick={() => onNavigate('investments')}
                      aria-label="View Growth Investments"
                      className="px-2.5"
                    >
                      <TrendingUp className="size-3.5" aria-hidden="true" />
                      Investments
                    </Button>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      <BucketAccountsSheet
        bucket={accountsBucket}
        onClose={() => setAccountsBucket(null)}
        isCurrentCycle={isCurrentCycle}
        cycleLabel={cycleLabel}
        amountsMasked={amountsMasked}
        formatCurrency={formatCurrency}
        onNavigateToAccounts={onNavigateToAccounts}
      />
    </section>
  )
}

function DetailRow({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3 text-caption">
      <dt className="min-w-0 truncate text-muted-foreground">{label}</dt>
      <dd className={cn('shrink-0 font-medium tabular-nums text-foreground', className)}>{value}</dd>
    </div>
  )
}
