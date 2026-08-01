import React from 'react'
import { AlertTriangle, Coins, History } from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import type { GoalPoolSummary } from '../../lib/savingsGoals'

interface RewardsPoolBarProps {
  summary: GoalPoolSummary
  /** The Rewards budget for this cycle — what the commitments are paced against. */
  expectedInflow: number
  formatSensitive: (value: number) => React.ReactNode
  hideSensitive: boolean
  isOffline: boolean
  onFundCycle: () => void
  onViewRewardsHistory?: () => void
}

/**
 * One stacked bar over one balance.
 *
 * The split *is* the explanation: commitments and rewards are not two pots, they are two claims on
 * the same Rewards money. Showing them as separate totals is what let the old page report a laptop
 * and a watch as simultaneously affordable out of a balance that could only cover one.
 */
export const RewardsPoolBar: React.FC<RewardsPoolBarProps> = ({
  summary,
  expectedInflow,
  formatSensitive,
  hideSensitive,
  isOffline,
  onFundCycle,
  onViewRewardsHistory,
}) => {
  const { rewardsBalance, totalEarmarked, unassigned, outstandingThisCycleTotal, paceShortfall } = summary

  // Percentages drive only the bar widths; a zero or negative balance collapses to an empty track.
  const committedPct = rewardsBalance > 0 ? Math.min(100, (totalEarmarked / rewardsBalance) * 100) : 0
  const hasGoals = summary.activeGoals.length > 0

  // Shown while anything is still unfinished, so it does not vanish the moment a cycle is paced --
  // but disabled when there is genuinely nothing to do, with the reason in the tooltip.
  const showFundAction = hasGoals && summary.hasUnfinishedGoals
  const canFund = outstandingThisCycleTotal > 0 && unassigned > 0
  const fundTitle = isOffline
    ? 'Funding needs a connection — it splits your real rewards balance'
    : hideSensitive
      ? 'Unhide balances to fund your goals'
      : outstandingThisCycleTotal <= 0
        ? 'Every goal already has its share for this cycle'
        : unassigned <= 0
          ? 'No free rewards left to set aside'
          : 'Set aside what your goals still need this cycle'

  return (
    <Card className="space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
            Rewards pool
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black text-foreground">{formatSensitive(rewardsBalance)}</span>
            {expectedInflow > 0 && (
              <span className="text-[11px] font-semibold text-muted-foreground">
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
          {showFundAction && (
            <Button
              size="sm"
              onClick={onFundCycle}
              disabled={hideSensitive || isOffline || !canFund}
              title={fundTitle}
            >
              <Coins className="size-3" />
              {outstandingThisCycleTotal > 0
                ? <>Set aside {formatSensitive(outstandingThisCycleTotal)}</>
                : 'Funded this cycle'}
            </Button>
          )}
        </div>
      </div>

      {/* The stacked track. Committed sits left so the free remainder reads as "what's left over",
          which is how the money actually behaves. */}
      <div
        className="w-full h-2.5 rounded-full bg-blue-500/25 overflow-hidden"
        role="img"
        aria-label={hasGoals
          ? `${committedPct.toFixed(0)}% of your rewards is committed to goals`
          : 'No rewards committed to goals yet'}
      >
        <div className="h-full bg-violet-500 transition-all duration-500" style={{ width: `${committedPct}%` }} />
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px] font-semibold">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-violet-500" aria-hidden />
          <span className="text-muted-foreground">Committed</span>
          <span className="text-foreground font-extrabold">{formatSensitive(totalEarmarked)}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-blue-500" aria-hidden />
          <span className="text-muted-foreground">Free to spend</span>
          <span className="text-foreground font-extrabold">{formatSensitive(unassigned)}</span>
        </span>
      </div>

      {/* One status line, not a stack of banners. The budget-level warning wins when present,
          because an unreachable deadline matters more than this cycle's bookkeeping. */}
      {paceShortfall > 0 ? (
        <p className="flex items-start gap-2 text-[11px] font-semibold text-amber-500">
          <AlertTriangle className="size-3.5 shrink-0 mt-px" />
          <span>
            Your goals need {formatSensitive(summary.requiredPerCycleTotal)} a cycle —{' '}
            {formatSensitive(paceShortfall)} more than your rewards budget. Push a deadline out, lower a
            target, or raise your rewards allocation.
          </span>
        </p>
      ) : hasGoals && outstandingThisCycleTotal <= 0 ? (
        <p className="text-[11px] font-semibold text-emerald-500">
          Every goal has its share for this cycle.
        </p>
      ) : null}
    </Card>
  )
}
