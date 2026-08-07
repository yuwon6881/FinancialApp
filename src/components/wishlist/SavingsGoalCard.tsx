import React from 'react'
import { CalendarClock, CheckCircle2, Edit2, Minus, MoreHorizontal, Plus, Repeat, Trash2, X } from 'lucide-react'
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
  /**
   * Set when the card is the only thing in its row and so is rendered outside the rail. The peek-cut
   * `80vw` is a scroll affordance, and with nothing to scroll to it reads as a clipped card instead.
   */
  fullWidth?: boolean
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
  fullWidth = false,
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
  // Overfunding a goal by hand fills the meter rather than overflowing it.
  const cycleTarget = Math.max(pace.requiredPerCycle, pace.fundedThisCycle)
  const cyclePct = cycleTarget > 0 ? Math.min(100, (pace.fundedThisCycle / cycleTarget) * 100) : 100
  const cycleDone = pace.outstandingThisCycle <= 0
  const isBusy = isSyncing || isDeleting || goal.isPendingSync === true
  const [showManage, setShowManage] = React.useState(false)
  // Collapse if the row starts syncing or deleting underneath the open panel: leaving Edit and Delete
  // showing on a row that is on its way out invites a tap at the one moment it cannot be honoured.
  React.useEffect(() => {
    if (isBusy) setShowManage(false)
  }, [isBusy])

  return (
    <Card
      className={`flex flex-col gap-3 p-4 transition-colors duration-300 ${
        fullWidth ? 'w-full lg:max-w-xl' : 'snap-start shrink-0 w-[80vw] sm:w-[22rem]'
      } ${status === 'overdue' ? 'border-destructive/40' : 'border-border/60'}`}
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
          <span className="text-xs font-semibold text-muted-foreground">
            of {formatSensitive(goal.targetAmount)}
          </span>
        </div>
        <div className="mt-1.5 w-full bg-muted rounded-full h-1.5 overflow-hidden">
          <div className={`h-full ${style.bar} transition-all duration-500 rounded-full`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* This cycle's share as its own inset meter. The bar above tracks the whole target, which is
          a different (and much slower-moving) question than "is this cycle paid up" — a single line
          of text under the target bar left the two indistinguishable. */}
      {pace.isFunded ? (
        <p className="flex items-center gap-1.5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-500">
          <CheckCircle2 className="size-3.5 shrink-0" aria-hidden /> Ready to use
        </p>
      ) : (
        <div className="rounded-xl border border-border/50 bg-muted/25 p-2.5 space-y-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {cycleDone
                ? <CheckCircle2 className="size-3 text-emerald-500" aria-hidden />
                : <CalendarClock className="size-3 text-violet-500" aria-hidden />}
              This cycle
            </span>
            <span className="text-[10px] font-semibold text-muted-foreground">
              <span className={`font-extrabold ${cycleDone ? 'text-emerald-500' : 'text-foreground'}`}>
                {formatSensitive(pace.fundedThisCycle)}
              </span>
              {' '}of {formatSensitive(pace.requiredPerCycle)}
            </span>
          </div>

          <div
            className="w-full h-1 rounded-full bg-muted overflow-hidden"
            role="img"
            aria-label={cycleDone
              ? "This cycle's share is set aside"
              : `${cyclePct.toFixed(0)}% of this cycle's share set aside`}
          >
            <div
              className={`h-full rounded-full transition-all duration-500 ${cycleDone ? 'bg-emerald-500' : style.bar}`}
              style={{ width: `${cyclePct}%` }}
            />
          </div>

          <p className={`text-xs font-bold ${cycleDone ? 'text-emerald-500' : style.text}`}>
            {cycleDone
              ? 'Done for this cycle'
              : <>{formatSensitive(pace.outstandingThisCycle)} still to set aside</>}
          </p>
        </div>
      )}

      {/* Management *replaces* the money actions rather than joining them. Adding a sixth control to
          a row that already held five at the rail's 80vw is what squeezed the tick and pushed the
          close button past the card edge — and nobody needs the top-up buttons while deciding whether
          to delete. Every child is `shrink-0`: only the +/- pair had it, which is why the others were
          the ones that visibly compressed. */}
      <div className="mt-auto flex items-center gap-1 border-t border-border/30 pt-3">
        {showManage ? (
          /* Edit and Delete share the row rather than huddling at the left edge with dead space
             beside them. `flex-1` on a pair of actions with a trailing icon is the same shape the
             sheet footers already use, so the panel reads as part of the system instead of a row
             that lost its other buttons. */
          <>
            <Button
              variant="ghost"
              size="sm"
              className="flex-1"
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
              className="flex-1"
              onClick={() => onDelete(goal.id)}
              disabled={isBusy || hideSensitive}
              aria-label={`Delete ${goal.name}`}
              title={hideSensitive ? 'Unhide balances to delete' : 'Delete goal'}
            >
              <Trash2 className="size-3.5 shrink-0" /> Delete
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={() => setShowManage(false)}
              aria-expanded
              aria-label={`Hide edit and delete for ${goal.name}`}
              title="Back"
            >
              <X className="size-3.5" />
            </Button>
          </>
        ) : (
          <>
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
              className="shrink-0"
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
            {/* Swipe-to-reveal is not an option for these two: the card lives in a horizontally
                scrolling rail, so a horizontal drag on it belongs to the rail. */}
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto shrink-0"
              onClick={() => setShowManage(true)}
              aria-expanded={false}
              aria-label={`Edit or delete ${goal.name}`}
              title="Edit or delete"
            >
              <MoreHorizontal className="size-3.5" />
            </Button>
          </>
        )}
      </div>
    </Card>
  )
}
