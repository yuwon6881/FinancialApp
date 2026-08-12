import React from 'react'
import { AlertTriangle, CalendarClock, CheckCircle2, Coins, History, Loader2 } from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import type { GoalPoolSummary } from '../../lib/savingsGoals'
import type { SavingsGoalFundingBucket } from '../../types'
import { getCategoryChartColor } from '../../lib/categoryColors'

interface RewardsPoolBarProps {
  summary: GoalPoolSummary
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
  const bucketColor = getCategoryChartColor(bucket)
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

  // This cycle's share, as its own meter. The pool bar above answers "how is the balance divided";
  // this answers "has this cycle's contribution actually been made" — two different questions that
  // a single line of text underneath was conflating.
  //
  // With a single commitment the panel is pure duplication: every figure in it is already on that
  // goal's own card a short scroll below, down to the wording, so the page said the same thing twice
  // and buried the difference between "the pool" and "this goal" in the repetition. It earns its
  // space only once it is summing more than one commitment.
  const cycleTarget = Math.max(requiredPerCycleTotal, fundedThisCycleTotal)
  const cyclePct = cycleTarget > 0 ? Math.min(100, (fundedThisCycleTotal / cycleTarget) * 100) : 0
  const cycleDone = outstandingThisCycleTotal <= 0
  const showCyclePanel = summary.activeGoals.length > 1 && cycleTarget > 0

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
      ? 'Unhide balances to fund your goals'
      : unassigned <= 0
        ? `No free ${bucketLabel.toLowerCase()} money left to set aside`
        : 'Set aside what your goals still need this cycle'

  return (
    <Card className="space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
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
        <div className="flex flex-wrap items-center justify-end gap-2">
          {onViewRewardsHistory && (
            <Button variant="ghost" size="sm" onClick={onViewRewardsHistory}>
              <History className="size-3" /> History
            </Button>
          )}
          {showFundAction && (cycleDone && !isFunding ? (
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-bold text-emerald-500">
              <CheckCircle2 className="size-3.5 shrink-0" aria-hidden /> Funded this cycle
            </span>
          ) : (
            <Button
              size="sm"
              onClick={onFundCycle}
              disabled={hideSensitive || isOffline || !canFund || isFunding}
              aria-busy={isFunding}
              title={fundTitle}
            >
              {isFunding ? <Loader2 className="size-3 animate-spin" /> : <Coins className="size-3" />}
              {isFunding ? 'Setting aside…' : <>Set aside {formatSensitive(fundableNow)}</>}
            </Button>
          ))}
        </div>
      </div>

      {/* The stacked track. Committed sits left so the free remainder reads as "what's left over",
          which is how the money actually behaves. */}
      <div
        className="w-full h-2.5 rounded-full bg-muted overflow-hidden"
        role="img"
        aria-label={hasGoals
          ? `${committedPct.toFixed(0)}% of your ${bucketLabel.toLowerCase()} money is committed to goals`
          : `No ${bucketLabel.toLowerCase()} money committed to goals yet`}
      >
        <div className="h-full transition-all duration-500" style={{ width: `${committedPct}%`, backgroundColor: bucketColor }} />
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs font-semibold">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ backgroundColor: bucketColor }} aria-hidden />
          <span className="text-muted-foreground">Committed</span>
          <span className="text-foreground font-extrabold">{formatSensitive(totalEarmarked)}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full ring-1" style={{ backgroundColor: bucketColor, opacity: 0.3 }} aria-hidden />
          <span className="text-muted-foreground">Free to spend</span>
          <span className="text-foreground font-extrabold">{formatSensitive(unassigned)}</span>
        </span>
      </div>

      {/* This cycle's share gets its own inset panel rather than a caption, so "the balance is
          split like this" and "this cycle is/isn't paid up" stop competing for the same line. */}
      {showCyclePanel && (
        <div className="rounded-xl border border-border/50 bg-muted/25 p-3 space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {cycleDone
                ? <CheckCircle2 className="size-3 text-emerald-500" aria-hidden />
                : <CalendarClock className="size-3" style={{ color: bucketColor }} aria-hidden />}
              This cycle
            </span>
            <span className="text-xs font-semibold text-muted-foreground">
              <span className={`font-extrabold ${cycleDone ? 'text-emerald-500' : 'text-foreground'}`}>
                {formatSensitive(fundedThisCycleTotal)}
              </span>
              {' '}of {formatSensitive(requiredPerCycleTotal)} set aside
            </span>
          </div>

          <div
            className="w-full h-1.5 rounded-full bg-muted overflow-hidden"
            role="img"
            aria-label={cycleDone
              ? "Every commitment has its share for this cycle"
              : `${cyclePct.toFixed(0)}% of this cycle's commitments set aside`}
          >
            <div
              className={`h-full rounded-full transition-all duration-500 ${cycleDone ? 'bg-emerald-500' : ''}`}
              style={{ width: `${cyclePct}%`, ...(cycleDone ? {} : { backgroundColor: bucketColor }) }}
            />
          </div>

          <p className={`text-xs font-bold ${cycleDone ? 'text-emerald-500' : 'text-muted-foreground'}`}>
            {cycleDone
              ? 'Every commitment has its share for this cycle.'
              : <>
                  <span className="text-amber-500">{formatSensitive(outstandingThisCycleTotal)}</span>
                  {' '}still to set aside across {summary.activeGoals.length}{' '}
                  {summary.activeGoals.length === 1 ? 'commitment' : 'commitments'}
                </>}
          </p>
        </div>
      )}

      {overCommitted > 0 && (
        <p className="flex items-start gap-2 text-xs font-semibold text-destructive">
          <AlertTriangle className="size-3.5 shrink-0 mt-px" />
          <span>
            {bucket === 'Rewards'
              ? <>Your commitments claim {formatSensitive(overCommitted)} more than your rewards hold. Something has been spent from Rewards since it was set aside — release money from a commitment, or let this cycle's rewards money refill the pool.</>
              : <>Your commitments claim {formatSensitive(overCommitted)} more than your {bucketLabel.toLowerCase()} pool holds. Something has been spent from {bucketLabel} since it was set aside — release money from a commitment, or let this cycle's {bucketLabel.toLowerCase()} money refill the pool.</>}
          </span>
        </p>
      )}

      {/* The budget-level warning still wins over the panel above, because an unreachable deadline
          matters more than this cycle's bookkeeping. */}
      {paceShortfall > 0 ? (
        <p className="flex items-start gap-2 text-xs font-semibold text-amber-500">
          <AlertTriangle className="size-3.5 shrink-0 mt-px" />
          <span>
            Your goals need {formatSensitive(summary.requiredPerCycleTotal)} a cycle —{' '}
            {formatSensitive(paceShortfall)} above your {bucketLabel.toLowerCase()} budget. Extend a deadline, lower a
            target, or raise your {bucketLabel} share.
          </span>
        </p>
      ) : null}
    </Card>
  )
}
