import React from 'react'
import { CheckCircle2, Edit2, Minus, Plus, Repeat, Trash2 } from 'lucide-react'
import type { SavingsGoal } from '../../types'
import type { GoalPace, GoalPaceStatus } from '../../lib/savingsGoals'
import { MONTH_NAMES } from '../../lib/cycle'
import { parseGoalDate } from '../../lib/savingsGoals'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { RowSyncStatus } from '../ui/RowSyncBadge'

interface SavingsGoalCardProps {
  goal: SavingsGoal
  pace: GoalPace
  status: GoalPaceStatus
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

// Pace, not percent, is the signal. 3% of a six-year house fund is fine; 33% of a three-month car
// service is a problem — a percentage alone cannot tell those apart.
const STATUS: Record<GoalPaceStatus, { label: string; dot: string; text: string; bar: string }> = {
  funded: { label: 'Ready', dot: 'bg-emerald-500', text: 'text-emerald-500', bar: 'bg-emerald-500' },
  onPace: { label: 'On pace', dot: 'bg-emerald-500', text: 'text-emerald-500', bar: 'bg-violet-500' },
  needsFunding: { label: 'Needs funding', dot: 'bg-amber-500', text: 'text-amber-500', bar: 'bg-violet-500' },
  overdue: { label: 'Overdue', dot: 'bg-destructive', text: 'text-destructive', bar: 'bg-destructive' },
}

function formatDeadline(targetDate: string): string {
  const date = parseGoalDate(targetDate)
  return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`
}

function describeHorizon(pace: GoalPace): string {
  if (pace.isFunded) return 'fully funded'
  if (pace.cyclesRemaining <= 0) return 'past due'
  if (pace.cyclesRemaining === 1) return 'due this cycle'
  if (pace.cyclesRemaining < 12) return `${pace.cyclesRemaining} cycles left`
  const years = pace.cyclesRemaining / 12
  return `${years.toFixed(years < 10 ? 1 : 0)} years left`
}

export const SavingsGoalCard: React.FC<SavingsGoalCardProps> = ({
  goal,
  pace,
  status,
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
  const style = STATUS[status]
  const isBusy = isSyncing || isDeleting || goal.isPendingSync === true

  return (
    <Card
      className={`snap-start shrink-0 w-[22rem] flex flex-col gap-3 p-4 transition-colors duration-300 ${
        status === 'overdue' ? 'border-destructive/40' : 'border-border/60'
      }`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`size-1.5 rounded-full shrink-0 ${style.dot}`} aria-hidden />
          <h4 className="text-sm font-bold text-foreground truncate">{goal.name}</h4>
          {goal.isRecurring && (
            <Repeat
              className="size-3 text-muted-foreground shrink-0"
              aria-label={`Repeats every ${goal.recurrenceMonths} months`}
            />
          )}
          <RowSyncStatus isDeleting={isDeleting} isSyncing={isSyncing} isPending={goal.isPendingSync} entityLabel="goal" />
        </div>
        <p className="mt-0.5 text-[10px] font-semibold text-muted-foreground">
          {formatDeadline(goal.targetDate)} · {describeHorizon(pace)}
        </p>
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-lg font-extrabold text-foreground">{formatSensitive(goal.earmarkedAmount)}</span>
          <span className="text-[11px] font-semibold text-muted-foreground">
            of {formatSensitive(goal.targetAmount)}
          </span>
        </div>
        <div className="mt-1.5 w-full bg-muted rounded-full h-1.5 overflow-hidden">
          <div className={`h-full ${style.bar} transition-all duration-500 rounded-full`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* One line, not a stat grid: either this cycle still owes something or it does not. */}
      <p className={`text-[11px] font-bold ${style.text}`}>
        {pace.isFunded
          ? 'Ready to use'
          : pace.outstandingThisCycle > 0
            ? <>Set aside {formatSensitive(pace.outstandingThisCycle)} this cycle</>
            : <>Done for this cycle · {formatSensitive(pace.requiredPerCycle)}/cycle</>}
      </p>

      <div className="mt-auto flex items-center gap-1 border-t border-border/30 pt-3">
        <div className="flex items-center gap-px rounded-lg overflow-hidden shrink-0 shadow-xs ring-1 ring-border/50">
          <Button
            variant="secondary"
            size="icon"
            className="rounded-none border-none shadow-none hover:shadow-none"
            onClick={() => onTopUp(goal)}
            disabled={isBusy || hideSensitive || pace.isFunded}
            aria-label={`Add money to ${goal.name}`}
            title={pace.isFunded ? 'This goal already has everything it needs' : 'Move free rewards into this goal'}
          >
            <Plus className="size-3.5" />
          </Button>
          <div className="w-px h-5 bg-border/40" aria-hidden />
          <Button
            variant="secondary"
            size="icon"
            className="rounded-none border-none shadow-none hover:shadow-none"
            onClick={() => onRelease(goal)}
            disabled={isBusy || hideSensitive || goal.earmarkedAmount <= 0}
            aria-label={`Release money from ${goal.name}`}
            title="Release money back to your free rewards"
          >
            <Minus className="size-3.5" />
          </Button>
        </div>
        <Button
          variant="successGhost"
          size="icon"
          onClick={() => onComplete(goal.id)}
          disabled={isBusy || hideSensitive || goal.earmarkedAmount <= 0}
          aria-label={goal.isRecurring ? `Complete this cycle for ${goal.name}` : `Mark ${goal.name} done`}
          title={goal.earmarkedAmount <= 0
            ? 'Set aside some rewards before marking this commitment done'
            : goal.isRecurring
              ? 'Spend the saved amount and roll the deadline forward'
              : 'Spend the saved amount and mark this commitment done'}
        >
          <CheckCircle2 className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={() => onEdit(goal)}
          disabled={isBusy || hideSensitive}
          aria-label={`Edit ${goal.name}`}
          title={hideSensitive ? 'Unhide balances to edit' : 'Edit goal'}
        >
          <Edit2 className="size-3.5 shrink-0" /> Edit
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={() => onDelete(goal.id)}
          disabled={isBusy || hideSensitive}
          aria-label={`Delete ${goal.name}`}
          title={hideSensitive ? 'Unhide balances to delete' : 'Delete goal'}
        >
          <Trash2 className="size-3.5 shrink-0" /> Delete
        </Button>
      </div>
    </Card>
  )
}
