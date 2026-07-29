import React from 'react'
import { AlertTriangle, Sparkles, Target, Wallet } from 'lucide-react'
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
  /** Null when the current cycle has already been funded, so the action can be hidden. */
  onFundCycle: (() => void) | null
  onViewRewardsHistory?: () => void
}

/**
 * One stacked bar over one balance.
 *
 * This replaces the old three-stat ribbon because the split *is* the explanation: commitments and
 * rewards are not two pots, they are two claims on the same Rewards money. Showing them as
 * separate totals is what let the old page report a laptop and a watch as simultaneously
 * affordable out of a balance that could only cover one.
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
  const { rewardsBalance, totalEarmarked, unassigned, requiredPerCycleTotal, paceShortfall } = summary

  // Percentages drive only the bar widths. A zero or negative balance collapses to an empty track
  // rather than dividing by zero.
  const committedPct = rewardsBalance > 0 ? Math.min(100, (totalEarmarked / rewardsBalance) * 100) : 0
  const freePct = rewardsBalance > 0 ? Math.max(0, 100 - committedPct) : 0
  const hasCommitments = summary.activeGoals.length > 0

  return (
    <Card className="p-5 space-y-4">
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
        <div className="flex items-center gap-2">
          {onViewRewardsHistory && (
            <Button variant="ghost" size="sm" onClick={onViewRewardsHistory}>
              <Wallet className="size-3" /> History
            </Button>
          )}
          {onFundCycle && (
            <Button
              variant="primary"
              size="sm"
              onClick={onFundCycle}
              disabled={hideSensitive || isOffline}
              title={
                isOffline
                  ? 'Funding needs a connection — it splits your real rewards balance'
                  : hideSensitive
                    ? 'Unhide balances to fund your goals'
                    : 'Set aside this cycle’s share for each goal'
              }
            >
              <Sparkles className="size-3" /> Fund this cycle
            </Button>
          )}
        </div>
      </div>

      {/* The stacked track. Committed sits left so the free remainder always reads as "what's
          left over", which is how the money actually behaves. */}
      <div
        className="w-full h-3 rounded-full bg-muted overflow-hidden flex"
        role="img"
        aria-label={
          hasCommitments
            ? `Rewards pool: ${committedPct.toFixed(0)}% committed to goals, ${freePct.toFixed(0)}% free to spend`
            : 'Rewards pool: nothing committed to goals yet'
        }
      >
        <div
          className="h-full bg-violet-500 transition-all duration-500"
          style={{ width: `${committedPct}%` }}
        />
        <div
          className="h-full bg-blue-500 transition-all duration-500"
          style={{ width: `${freePct}%` }}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-start gap-2">
          <span className="mt-1 size-2 rounded-full bg-violet-500 shrink-0" />
          <div className="min-w-0">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Committed
            </span>
            <span className="block text-sm font-extrabold text-foreground">{formatSensitive(totalEarmarked)}</span>
            <span className="block text-[10px] font-medium text-muted-foreground">
              {hasCommitments
                ? `${summary.activeGoals.length} ${summary.activeGoals.length === 1 ? 'goal' : 'goals'}`
                : 'No goals yet'}
            </span>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <span className="mt-1 size-2 rounded-full bg-blue-500 shrink-0" />
          <div className="min-w-0">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Free to spend
            </span>
            <span className="block text-sm font-extrabold text-foreground">{formatSensitive(unassigned)}</span>
            <span className="block text-[10px] font-medium text-muted-foreground">Claimable on rewards</span>
          </div>
        </div>
      </div>

      {/* The one number that turns a list of goals into a plan: whether the Rewards budget can
          actually keep every deadline. Silently under-funding instead would defeat the point. */}
      {paceShortfall > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
          <AlertTriangle className="size-3.5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-[11px] font-semibold text-foreground">
            Your goals need {formatSensitive(requiredPerCycleTotal)} a cycle — that’s{' '}
            {formatSensitive(paceShortfall)} more than your rewards budget.
            <span className="block mt-0.5 font-medium text-muted-foreground">
              Push a deadline out, lower a target, or raise your rewards allocation in Settings.
            </span>
          </div>
        </div>
      )}

      {paceShortfall === 0 && hasCommitments && (
        <div className="flex items-center gap-2 text-[11px] font-semibold text-emerald-500">
          <Target className="size-3.5 shrink-0" />
          On pace for every goal at {formatSensitive(requiredPerCycleTotal)} a cycle.
        </div>
      )}
    </Card>
  )
}
