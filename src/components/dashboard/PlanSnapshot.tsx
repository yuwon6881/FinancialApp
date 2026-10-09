import type { ReactNode } from 'react'
import { BarChart3 } from 'lucide-react'
import type { CycleProgress } from '../../lib/cycle'
import type { EssentialsChallenge } from '../../lib/essentialsChallenge'
import { isOverBudgetTier, isUnrankedTier } from '../../lib/essentialsChallenge'
import { getCategoryChartColor } from '../../lib/categoryColors'
import type { ActiveRecurringPayment, TodayPlanInsights } from '../../types'
import { cn } from '../../lib/utils'
import { AmountText } from '../ui/AmountText'
import { Button } from '../ui/Button'
import { InteractiveCard } from '../ui/InteractiveCard'
import { Meter } from '../ui/Meter'
import { ProgressRing } from '../ui/ProgressRing'
import { SegmentedMeter } from '../ui/SegmentedMeter'

interface PlanSnapshotProps {
  currency: string
  hideSensitive: boolean
  cycle: CycleProgress
  challenge: EssentialsChallenge
  essentials: { projectedRemaining: number; projectedPct: number }
  stability: { projectedPct: number; projectedBalance: number }
  insights: TodayPlanInsights
  recurring: ActiveRecurringPayment[]
  /** The Essentials challenge chip, set in the section header. */
  scoreChip: ReactNode
  onOpenLedger?: (options: { category: string; txType?: 'outflow'; showAllCycles?: boolean }) => void
  onOpenBills: () => void
  onOpenReports: () => void
}

/**
 * A tile is a row of a grouped list on a phone and a card of its own once the section is wide
 * enough for a grid -- the same markup, switched by the section's container width rather than the
 * viewport, so the snapshot lays out the same beside a sidebar as it does on a tablet.
 */
const TILE = cn(
  'flex h-full min-w-0 flex-col px-4 py-4',
  '@lg/plan:rounded-panel @lg/plan:border @lg/plan:border-border/70 @lg/plan:bg-card @lg/plan:p-5',
)

interface TileProps {
  label: string
  value: ReactNode
  hint?: ReactNode
  aside?: ReactNode
  footer?: ReactNode
  onClick?: () => void
  disabled?: boolean
}

function Tile({ label, value, hint, aside, footer, onClick, disabled }: TileProps) {
  const content = (
    <>
      <div className="flex min-w-0 items-start gap-3">
        <div className="min-w-0 flex-1">
          <span className="block text-label text-muted-foreground">{label}</span>
          <span className="mt-1 block truncate text-section text-foreground tabular-nums @lg/plan:text-title">{value}</span>
        </div>
        {aside}
      </div>
      {footer && <div className="mt-3">{footer}</div>}
      {hint && <span className="mt-1.5 block text-caption text-muted-foreground">{hint}</span>}
    </>
  )
  if (!onClick) return <div className={TILE}>{content}</div>
  return (
    <InteractiveCard
      surface="plain"
      onClick={onClick}
      disabled={disabled}
      className={cn(TILE, 'rounded-none hover:bg-surface-2/60 @lg/plan:hover:bg-card disabled:opacity-100')}
    >
      {content}
    </InteractiveCard>
  )
}

const perDay = <span className="ml-0.5 text-body font-medium text-muted-foreground">/day</span>

export function PlanSnapshot({
  currency,
  hideSensitive,
  cycle,
  challenge,
  essentials,
  stability,
  insights,
  recurring,
  scoreChip,
  onOpenLedger,
  onOpenBills,
  onOpenReports,
}: PlanSnapshotProps) {
  const money = (value: number) => <AmountText value={value} currency={currency} isMasked={hideSensitive} />
  const hasEndedCycle = cycle.phase === 'ended'
  const { spendDays, dailyAllowance, currentDailyPace, paceDifference } = challenge
  const runningHot = !hasEndedCycle && paceDifference > 0.05
  const projectedShort = insights.projectedEssentialsEndingBalance < 0
  const unranked = isUnrankedTier(challenge.tier)
  const paceColor = isOverBudgetTier(challenge.tier) || challenge.tier === 'off-track'
    ? 'var(--color-red-500)'
    : challenge.tier === 'near-limit'
      ? 'var(--color-amber-500)'
      : getCategoryChartColor('Essentials')

  const billTotal = recurring.filter(payment => payment.status !== 'Discarded').length
  const billsPaid = Math.max(0, billTotal - insights.unpaidRecurringCount)

  return (
    <section aria-labelledby="plan-snapshot-heading" className="@container/plan">
      <div className="mb-3 flex min-h-11 items-center justify-between gap-3">
        <h2 id="plan-snapshot-heading" className="text-section text-foreground">Plan snapshot</h2>
        {scoreChip}
      </div>

      <div
        className={cn(
          'overflow-hidden rounded-panel border border-border/70 bg-card divide-y divide-border/60',
          '@lg/plan:grid @lg/plan:grid-cols-2 @lg/plan:gap-3 @lg/plan:divide-y-0 @lg/plan:overflow-visible',
          '@lg/plan:rounded-none @lg/plan:border-0 @lg/plan:bg-transparent @3xl/plan:grid-cols-3',
        )}
      >
        <Tile
          label="Essentials remaining"
          value={money(essentials.projectedRemaining)}
          hint="After pending bills"
          aside={(
            <ProgressRing
              percent={essentials.projectedPct * 100}
              size={40}
              thickness={4}
              color={getCategoryChartColor('Essentials')}
              label="Share of Essentials money left"
              valueHidden={hideSensitive}
            />
          )}
          onClick={() => onOpenLedger?.({ category: 'Essentials' })}
        />

        <Tile
          label={hasEndedCycle ? 'Essentials left' : 'Daily spending room'}
          value={hasEndedCycle
            ? money(Math.max(0, essentials.projectedRemaining))
            : <>{money(dailyAllowance)}{perDay}</>}
          hint={hasEndedCycle
            ? 'This selected cycle has ended.'
            : `Based on ${spendDays} day${spendDays === 1 ? '' : 's'} of Essentials remaining.`}
        />

        <Tile
          label="Essentials spending pace"
          value={<>{money(currentDailyPace)}{perDay}</>}
          hint={(
            <span className={cn(runningHot && 'font-medium text-amber-700 dark:text-amber-300')}>
              {hasEndedCycle
                ? 'Non-recurring Essentials daily average.'
                : runningHot
                  ? dailyAllowance <= 0
                    ? 'No daily Essentials allowance remains.'
                    : `${Math.round(paceDifference * 100)}% faster than your remaining daily allowance.`
                  : 'Within your remaining daily allowance.'}
            </span>
          )}
          footer={!unranked && (
            <SegmentedMeter
              size="sm"
              segments={[{ value: Math.min(1, challenge.usedRatio), color: paceColor, label: 'Committed' }]}
              total={1}
              markerPercent={challenge.paceRatio * 100}
              markerLabel="Where the plan expects you today"
              label={`${Math.round(challenge.usedRatio * 100)}% of Essentials money committed with ${Math.round(challenge.paceRatio * 100)}% of the cycle gone`}
            />
          )}
          onClick={() => onOpenLedger?.({ category: 'Essentials', txType: 'outflow' })}
        />

        <Tile
          label={hasEndedCycle ? 'Cycle-end Essentials' : 'Projected cycle finish'}
          value={(
            <span className={cn(projectedShort && 'text-red-600 dark:text-red-400')}>
              {money(insights.projectedEssentialsEndingBalance)}
            </span>
          )}
          hint={hasEndedCycle ? 'Actual Essentials balance at close.' : 'After unpaid bills and the current pace.'}
          onClick={() => onOpenLedger?.({ category: 'Essentials' })}
        />

        <Tile
          label="Emergency fund progress"
          value={`${(stability.projectedPct * 100).toFixed(0)}%`}
          hint={<>{money(stability.projectedBalance)} saved</>}
          aside={(
            <ProgressRing
              percent={stability.projectedPct * 100}
              size={40}
              thickness={4}
              color={getCategoryChartColor('Stability')}
              label="Emergency fund progress"
            />
          )}
          onClick={() => onOpenLedger?.({ category: 'Stability', showAllCycles: true })}
        />

        <Tile
          label="Unpaid recurring bills"
          value={money(insights.unpaidRecurringTotal)}
          hint={insights.unpaidRecurringCount === 0
            ? 'No bills are awaiting payment.'
            : `${insights.unpaidRecurringCount} bill${insights.unpaidRecurringCount === 1 ? '' : 's'} pending.`}
          footer={billTotal > 0 && (
            <Meter
              size="sm"
              percent={(billsPaid / billTotal) * 100}
              color={getCategoryChartColor('Stability')}
              label={`${billsPaid} of ${billTotal} bills paid`}
            />
          )}
          onClick={onOpenBills}
          disabled={insights.unpaidRecurringCount === 0}
        />
      </div>

      <div className="mt-2 flex justify-end">
        <Button variant="tertiary" size="sm" onClick={onOpenReports}>
          <BarChart3 className="size-4" aria-hidden="true" /> View full reports
        </Button>
      </div>
    </section>
  )
}
