import React from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Edit2,
  Minus,
  Plus,
  Repeat,
  Target,
  Trash2,
  TrendingUp,
} from 'lucide-react'
import type { SavingsGoal } from '../../types'
import type { GoalPace, GoalPaceStatus } from '../../lib/savingsGoals'
import { MONTH_NAMES } from '../../lib/cycle'
import { parseGoalDate } from '../../lib/savingsGoals'
import { Button } from '../ui/Button'
import { RowSyncStatus } from '../ui/RowSyncBadge'

interface SavingsGoalCardProps {
  goal: SavingsGoal
  pace: GoalPace
  status: GoalPaceStatus
  /** What this goal would receive from the free remainder if the cycle were funded right now. */
  projectedGrant: number
  currency: string
  formatSensitive: (value: number) => React.ReactNode
  hideSensitive: boolean
  isSyncing: boolean
  isDeleting: boolean
  onEdit: (goal: SavingsGoal) => void
  onDelete: (id: number) => void
  onComplete: (id: number) => void
  onTopUp: (goal: SavingsGoal) => void
  onRelease: (goal: SavingsGoal) => void
}

// Pace, not percent, is the headline. 3% of a six-year house fund is fine; 33% of a three-month
// car service is a problem — a percentage alone cannot tell those apart.
const STATUS_STYLES: Record<GoalPaceStatus, { label: string; chip: string; icon: typeof Target }> = {
  funded: { label: 'Fully funded', chip: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', icon: CheckCircle2 },
  onPace: { label: 'On pace', chip: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', icon: TrendingUp },
  behind: { label: 'Behind pace', chip: 'bg-amber-500/10 text-amber-500 border-amber-500/20', icon: AlertTriangle },
  overdue: { label: 'Overdue', chip: 'bg-red-500/10 text-red-500 border-red-500/20', icon: AlertTriangle },
}

const PRIORITY_CHIP: Record<string, string> = {
  High: 'bg-red-500/10 text-red-500 border-red-500/20',
  Medium: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  Low: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
}

function formatDeadline(targetDate: string): string {
  const date = parseGoalDate(targetDate)
  return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`
}

function describeHorizon(pace: GoalPace): string {
  if (pace.isFunded) return 'Ready'
  if (pace.cyclesRemaining <= 0) return 'Past due'
  if (pace.cyclesRemaining === 1) return 'Due this cycle'
  if (pace.cyclesRemaining < 12) return `${pace.cyclesRemaining} cycles left`
  const years = pace.cyclesRemaining / 12
  return `${years.toFixed(years < 10 ? 1 : 0)} years left`
}

export const SavingsGoalCard: React.FC<SavingsGoalCardProps> = ({
  goal,
  pace,
  status,
  projectedGrant,
  formatSensitive,
  hideSensitive,
  isSyncing,
  isDeleting,
  onEdit,
  onDelete,
  onComplete,
  onTopUp,
  onRelease,
}) => {
  const pct = goal.targetAmount > 0
    ? Math.max(0, Math.min(100, (goal.earmarkedAmount / goal.targetAmount) * 100))
    : 0
  const style = STATUS_STYLES[status]
  const StatusIcon = style.icon
  const isBusy = isSyncing || isDeleting || goal.isPendingSync === true
  const barColor = status === 'overdue'
    ? 'bg-red-500'
    : status === 'behind'
      ? 'bg-amber-500'
      : status === 'funded'
        ? 'bg-emerald-500'
        : 'bg-violet-500'

  return (
    <div
      className={`p-4 rounded-2xl bg-card border shadow-xs transition-all duration-300 ${
        status === 'overdue'
          ? 'border-red-500/30'
          : status === 'funded'
            ? 'border-emerald-500/30'
            : 'border-border/60'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5 flex-wrap">
            <span className="truncate">{goal.name}</span>
            {goal.isRecurring && (
              <span
                className="inline-flex items-center gap-0.5 text-[9px] font-bold text-muted-foreground"
                title={`Repeats every ${goal.recurrenceMonths} month(s)`}
              >
                <Repeat className="size-2.5" /> {goal.recurrenceMonths}mo
              </span>
            )}
            <RowSyncStatus isDeleting={isDeleting} isSyncing={isSyncing} isPending={goal.isPendingSync} entityLabel="goal" />
          </h4>
          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
            <span className={`inline-block text-[9px] px-1.5 py-0.5 rounded border font-semibold ${PRIORITY_CHIP[goal.priority] ?? PRIORITY_CHIP.Medium}`}>
              {goal.priority}
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
              <Clock className="size-2.5" />
              {formatDeadline(goal.targetDate)} · {describeHorizon(pace)}
            </span>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1 shrink-0 text-[9px] px-1.5 py-1 rounded border font-bold ${style.chip}`}>
          <StatusIcon className="size-2.5" />
          {style.label}
        </span>
      </div>

      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-lg font-extrabold text-foreground">{formatSensitive(goal.earmarkedAmount)}</span>
        <span className="text-[11px] font-semibold text-muted-foreground">
          of {formatSensitive(goal.targetAmount)}
        </span>
        <span className="ml-auto text-[11px] font-bold text-muted-foreground">{pct.toFixed(0)}%</span>
      </div>

      <div className="mt-1.5 w-full bg-muted rounded-full h-2 overflow-hidden">
        <div className={`h-full ${barColor} transition-all duration-500 rounded-full`} style={{ width: `${pct}%` }} />
      </div>

      {/* The pace line. This is the number that answers "am I actually going to make it". */}
      <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-muted/40 border border-border/30 px-3 py-2">
        <div className="min-w-0">
          <span className="block text-[9px] uppercase tracking-wider font-extrabold text-muted-foreground">
            {pace.isFunded ? 'Nothing more needed' : pace.isOverdue ? 'Still short' : 'Needs per cycle'}
          </span>
          <span className="block text-[11px] font-bold text-foreground">
            {pace.isFunded ? 'Ready to use' : formatSensitive(pace.requiredPerCycle)}
          </span>
        </div>
        {!pace.isFunded && (
          <div className="text-right shrink-0">
            <span className="block text-[9px] uppercase tracking-wider font-extrabold text-muted-foreground">
              Next funding
            </span>
            <span className={`block text-[11px] font-bold ${projectedGrant + 0.005 < pace.requiredPerCycle ? 'text-amber-500' : 'text-emerald-500'}`}>
              {formatSensitive(projectedGrant)}
            </span>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center gap-1.5 flex-wrap border-t border-border/30 pt-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onTopUp(goal)}
          disabled={isBusy || hideSensitive || pace.isFunded}
          title={pace.isFunded ? 'This goal already has everything it needs' : 'Move free rewards into this goal'}
        >
          <Plus className="size-3" /> Top up
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRelease(goal)}
          disabled={isBusy || hideSensitive || goal.earmarkedAmount <= 0}
          title="Release money back to your free rewards"
        >
          <Minus className="size-3" /> Release
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => onComplete(goal.id)}
          disabled={isBusy || hideSensitive}
          title={goal.isRecurring ? 'Mark this round done and roll the deadline forward' : 'Mark this goal done and release the money'}
          className="ml-auto"
        >
          <CheckCircle2 className="size-3" /> Done
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit(goal)}
          disabled={isBusy || hideSensitive}
          title={hideSensitive ? 'Unhide balances to edit' : 'Edit goal'}
        >
          <Edit2 className="size-3" />
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={() => onDelete(goal.id)}
          disabled={isBusy || hideSensitive}
          title={hideSensitive ? 'Unhide balances to delete' : 'Delete goal'}
        >
          <Trash2 className="size-3" />
        </Button>
      </div>
    </div>
  )
}
