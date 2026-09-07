import React from 'react'
import { AlertTriangle, CheckCircle2, History, Loader2 } from 'lucide-react'
import { CommitmentIcon } from '../semanticIcons'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { DetailDisclosure } from '../ui/DetailDisclosure'
import { OverflowMenu } from '../ui/OverflowMenu'
import { useDetailDisclosure } from '../../lib/useDetailDisclosure'
import type { GoalPoolSummary } from '../../lib/savingsGoals'
import type { SavingsGoalFundingBucket } from '../../types'
import { getCategoryChartColor } from '../../lib/categoryColors'

interface RewardsPoolBarProps {
  summary: GoalPoolSummary
  activeView?: 'commitments' | 'rewards'
  /** The existing bucket budget for this cycle — what its commitments are paced against. */
  bucket?: SavingsGoalFundingBucket
  expectedInflow: number
  formatSensitive: (value: number) => React.ReactNode
  hideSensitive: boolean
  isOffline: boolean
  isFunding?: boolean
  onFundCycle: () => void
  onViewRewardsHistory?: () => void
}

/**
 * One stacked bar over one balance.
 *
 * The split *is* the explanation: commitments and spending are not two pots, they are two claims on
 * the same bucket money. Showing them as separate totals is what let the old page report a laptop
 * and a watch as simultaneously affordable out of a balance that could only cover one.
 */
export const RewardsPoolBar: React.FC<RewardsPoolBarProps> = ({
  summary,
  activeView = 'commitments',
  bucket: bucketProp = 'Rewards',
  expectedInflow,
  formatSensitive,
  hideSensitive,
  isOffline,
  isFunding = false,
  onFundCycle,
  onViewRewardsHistory,
}) => {
  const bucket = summary.fundingBucket ?? bucketProp
  const bucketLabel = bucket === 'Essentials' ? 'Essentials' : 'Rewards'
  const committedColor = getCategoryChartColor(bucket)
  const freeColor = bucket === 'Rewards' ? 'var(--color-amber-500)' : 'var(--color-emerald-500)'
  const {
    rewardsBalance: bucketBalance,
    totalEarmarked,
    unassigned,
    requiredPerCycleTotal,
    fundedThisCycleTotal,
    outstandingThisCycleTotal,
    paceShortfall,
  } = summary

  // Percentages drive only the bar widths; a zero or negative balance collapses to an empty track.
  const committedPct = bucketBalance > 0 ? Math.min(100, (totalEarmarked / bucketBalance) * 100) : 0
  const hasGoals = summary.activeGoals.length > 0

  // Earmarks are bookkeeping on money that already exists, but nothing stops the bucket balance
  // from falling under them afterwards — an expense, a correction, or a budget adjustment. The
  // free remainder floors at zero, so without saying this the page reports "Free to spend 0" and
  // goal cards that still claim money the pool no longer holds, with nothing connecting the two.
  const overCommitted = Math.round((totalEarmarked - bucketBalance) * 100) / 100

  // The per-cycle figures live in the detail tail now. They used to sit in an always-open inset
  // here *and* on every commitment card, alongside the Committed legend tile — three renderings of
  // the same number, which with a single commitment was most of the screen.
  const cycleTarget = Math.max(requiredPerCycleTotal, fundedThisCycleTotal)
  const cyclePct = cycleTarget > 0 ? Math.min(100, (fundedThisCycleTotal / cycleTarget) * 100) : 0
  const cycleDone = outstandingThisCycleTotal <= 0
  const detail = useDetailDisclosure()

  // Shown while anything is still unfinished, so it does not vanish the moment a cycle is paced --
  // but a paced cycle reports as a quiet pill rather than a disabled primary button: a filled button
  // is the loudest thing on the card, and pointing it at a no-op teaches the eye to ignore it.
  const showFundAction = hasGoals && summary.hasUnfinishedGoals
  const canFund = unassigned > 0
  // What the tap will actually move. The waterfall grants min(outstanding, free), so labelling the
  // button with the outstanding figure promised money the pool did not have and moved less.
  const fundableNow = Math.min(outstandingThisCycleTotal, unassigned)
  const fundTitle = isOffline
    ? `Funding needs a connection — it checks your real ${bucketLabel} balance`
    : hideSensitive
      ? 'Unhide balances to fund your commitments'
      : unassigned <= 0
        ? `No free ${bucketLabel.toLowerCase()} money left to set aside`
        : 'Set aside what your commitments still need this cycle'

  return (
    <Card className="space-y-3 p-3 sm:space-y-4 sm:p-5">
      <div className="grid gap-3 sm:flex sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0">
          <span className="text-eyebrow uppercase text-muted-foreground block">
            {bucketLabel} pool
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black text-foreground">{formatSensitive(bucketBalance)}</span>
            {expectedInflow > 0 && (
              <span className="text-xs font-semibold text-muted-foreground">
                +{formatSensitive(expectedInflow)}/cycle
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 sm:flex-wrap">
          {showFundAction && !cycleDone && (
            <Button
              size="sm"
              onClick={onFundCycle}
              disabled={hideSensitive || isOffline || !canFund || isFunding}
              aria-busy={isFunding}
              title={fundTitle}
            >
              {isFunding ? <Loader2 className="size-3 animate-spin" /> : <CommitmentIcon className="size-3" aria-hidden />}
              {isFunding ? 'Setting aside…' : <>Set aside {formatSensitive(fundableNow)}</>}
            </Button>
          )}
          {onViewRewardsHistory && (
            <OverflowMenu
              entityLabel={`your ${bucketLabel.toLowerCase()} pool`}
              items={[{ label: 'View history', icon: History, onSelect: onViewRewardsHistory }]}
            />
          )}
        </div>
      </div>

      {/* The selected view leads the bar, matching the tab order above. Both claims use a full,
          distinct Ayu color so the split never depends on a low-contrast opacity difference. */}
      <div
        className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={hasGoals
          ? `${committedPct.toFixed(0)}% of your ${bucketLabel.toLowerCase()} money is set aside for commitments`
          : `No ${bucketLabel.toLowerCase()} money set aside for commitments yet`}
      >
        {(activeView === 'commitments'
          ? [
              { key: 'committed', width: committedPct, color: committedColor },
              { key: 'free', width: 100 - committedPct, color: freeColor },
            ]
          : [
              { key: 'free', width: 100 - committedPct, color: freeColor },
              { key: 'committed', width: committedPct, color: committedColor },
            ]
        ).map(segment => (
          <div
            key={segment.key}
            data-pool-segment={segment.key}
            className="h-full transition-[width] duration-500"
            style={{ width: `${segment.width}%`, backgroundColor: segment.color }}
          />
        ))}
      </div>

      {/* One status line, worst news first: an over-commitment or an unreachable pace matters more
          than this cycle's bookkeeping, so it takes the line rather than sitting below it. */}
      {overCommitted > 0 ? (
        <p className="flex items-start gap-2 text-xs font-bold text-destructive">
          <AlertTriangle className="size-3.5 shrink-0 mt-px" aria-hidden />
          <span>Commitments claim {formatSensitive(overCommitted)} more than your {bucketLabel.toLowerCase()} holds</span>
        </p>
      ) : paceShortfall > 0 ? (
        <p className="flex items-start gap-2 text-xs font-bold text-amber-500">
          <AlertTriangle className="size-3.5 shrink-0 mt-px" aria-hidden />
          <span>
            Commitments need {formatSensitive(requiredPerCycleTotal)} a cycle —{' '}
            {formatSensitive(paceShortfall)} over budget
          </span>
        </p>
      ) : !hasGoals ? (
        <p className="text-xs font-semibold text-muted-foreground">No commitments yet</p>
      ) : cycleDone ? (
        <p className="flex items-center gap-1.5 text-xs font-bold text-emerald-500">
          <CheckCircle2 className="size-3.5 shrink-0" aria-hidden /> Funded this cycle
        </p>
      ) : (
        <p className="text-xs font-bold text-muted-foreground">
          <span className="text-amber-500">{formatSensitive(outstandingThisCycleTotal)}</span>
          {' '}still to set aside across {summary.activeGoals.length}{' '}
          {summary.activeGoals.length === 1 ? 'commitment' : 'commitments'}
        </p>
      )}

      <DetailDisclosure
        label="Details"
        open={detail.isOpen}
        onOpenChange={detail.setOpen}
        expandedFrom="lg"
        bodyClassName="space-y-3"
      >
        {/* The one place the Committed figure is spelled out. Keeping it here and nowhere else is
            what stops the pool, the legend and the commitment card from all repeating it. */}
        <div className="grid max-w-2xl grid-cols-2 gap-3 text-xs font-semibold">
          {(activeView === 'commitments'
            ? [
                { key: 'committed', label: 'Committed', amount: totalEarmarked, color: committedColor },
                { key: 'free', label: 'Free to spend', amount: unassigned, color: freeColor },
              ]
            : [
                { key: 'free', label: 'Free to spend', amount: unassigned, color: freeColor },
                { key: 'committed', label: 'Committed', amount: totalEarmarked, color: committedColor },
              ]
          ).map(item => (
            <span key={item.key} className="flex min-w-0 items-center gap-1.5 rounded-lg border border-border/60 bg-muted/35 px-2.5 py-2">
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} aria-hidden />
              <span className="min-w-0 truncate text-muted-foreground">{item.label}</span>
              <span className="ml-auto shrink-0 font-extrabold text-foreground">{formatSensitive(item.amount)}</span>
            </span>
          ))}
        </div>

        {/* A figure and a share, not another track. The pool's split bar above is the headline;
            this cycle's pacing is a footnote, and drawing it as a second bar here -- with a third
            on every commitment card below -- was what made the page read as a stack of bars. */}
        {cycleTarget > 0 && (
          <p className="max-w-2xl text-center text-xs font-semibold text-muted-foreground">
            This cycle:{' '}
            <span className={`font-extrabold ${cycleDone ? 'text-emerald-500' : 'text-foreground'}`}>
              {formatSensitive(fundedThisCycleTotal)}
            </span>
            {' '}of {formatSensitive(requiredPerCycleTotal)} set aside
            {' '}<span className="font-bold tabular-nums text-foreground">· {cyclePct.toFixed(0)}%</span>
          </p>
        )}

        {overCommitted > 0 && (
          <p className="text-xs font-semibold text-destructive">
            {bucket === 'Rewards'
              ? <>Something has been spent from Rewards since it was set aside — release money from a commitment, or let this cycle's rewards money refill the pool.</>
              : <>Something has been spent from {bucketLabel} since it was set aside — release money from a commitment, or let this cycle's {bucketLabel.toLowerCase()} money refill the pool.</>}
          </p>
        )}

        {paceShortfall > 0 && (
          <p className="text-xs font-semibold text-amber-500">
            Extend a deadline, lower a target, or raise your {bucketLabel} share.
          </p>
        )}
      </DetailDisclosure>
    </Card>
  )
}
