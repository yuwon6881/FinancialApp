import React from 'react'
import { CheckCircle2, ChevronDown, Edit2, Minus, Plus, Trash2 } from 'lucide-react'
import type { SavingsGoal } from '../../types'
import type { GoalPace, GoalPaceStatus } from '../../lib/savingsGoals'
import { MONTH_NAMES } from '../../lib/cycle'
import { parseGoalDate } from '../../lib/savingsGoals'
import { cn } from '../../lib/utils'
import { Button } from '../ui/Button'
import { IconButton } from '../ui/IconButton'
import { ProgressRing } from '../ui/ProgressRing'
import { OverflowMenu } from '../ui/OverflowMenu'
import { RowSyncStatus } from '../ui/RowSyncBadge'
import { getCategoryChartColor } from '../../lib/categoryColors'
import { LedgerAllocationBadge } from '../ledger/LedgerAllocationBadge'

interface SavingsGoalCardProps {
  goal: SavingsGoal
  pace: GoalPace
  status: GoalPaceStatus
  formatSensitive: (value: number) => React.ReactNode
  hideSensitive: boolean
  isSyncing: boolean
  isDeleting: boolean
  /** DOM id the shared highlight helper scrolls to when search jumps to this commitment. */
  elementId?: string
  onEdit: (goal: SavingsGoal) => void
  onDelete: (id: number) => void
  onComplete: (id: number) => void
  onTopUp: (goal: SavingsGoal) => void
  onRelease: (goal: SavingsGoal) => void
}

// Pace, not percent, is the signal. 3% of a six-year house fund is fine; 33% of a three-month car
// service is a problem — a percentage alone cannot tell those apart.
const STATUS: Record<GoalPaceStatus, { label: string; text: string; ring?: string }> = {
  funded: { label: 'Ready', text: 'text-emerald-700 dark:text-emerald-300', ring: 'var(--color-emerald-500)' },
  onPace: { label: 'On pace', text: 'text-muted-foreground' },
  needsFunding: { label: 'Needs funding', text: 'text-muted-foreground' },
  overdue: { label: 'Overdue', text: 'text-destructive', ring: 'var(--destructive)' },
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

/**
 * One commitment as a row of the commitments list: a ring for how much is set aside, the name and
 * its deadline, what this cycle still needs, and the saved / target figures. The money actions sit
 * on the row; the pacing figures fold away under Details.
 */
export const SavingsGoalCard: React.FC<SavingsGoalCardProps> = ({
  goal,
  pace,
  status,
  formatSensitive,
  hideSensitive,
  isSyncing,
  isDeleting,
  elementId,
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
  const fundingBucket = goal.fundingBucket ?? 'Rewards'
  // Overfunding a goal by hand fills the ring rather than overflowing it.
  const cycleTarget = Math.max(pace.requiredPerCycle, pace.fundedThisCycle)
  const cyclePct = cycleTarget > 0 ? Math.min(100, (pace.fundedThisCycle / cycleTarget) * 100) : 100
  const cycleDone = pace.outstandingThisCycle <= 0
  const isBusy = isSyncing || isDeleting || goal.isPendingSync === true
  const [showDetails, setShowDetails] = React.useState(false)
  const detailsId = React.useId()

  return (
    <li id={elementId} className={cn('px-4 py-4 transition-colors duration-300 sm:px-5', status === 'overdue' && 'bg-destructive/4')}>
      <div className="flex items-start gap-3.5">
        <ProgressRing
          percent={pct}
          size={52}
          thickness={5}
          color={style.ring ?? getCategoryChartColor(fundingBucket)}
          label={`${pct.toFixed(0)}% of this commitment set aside`}
        >
          <span className="text-caption font-semibold tabular-nums text-foreground">{pct.toFixed(0)}%</span>
        </ProgressRing>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h4 className="flex min-w-0 items-center gap-1.5 text-body font-medium text-foreground">
                <span className="truncate">{goal.name}</span>
                <RowSyncStatus isDeleting={isDeleting} isSyncing={isSyncing} isPending={goal.isPendingSync} entityLabel="goal" />
              </h4>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-caption text-muted-foreground">
                <LedgerAllocationBadge ledgerCategory={fundingBucket} transactionId={String(goal.id)} />
                <span aria-hidden="true">·</span>
                <span>by {formatDeadline(goal.targetDate)}</span>
                {status === 'overdue' && <span className="font-medium text-destructive">· {style.label}</span>}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-body font-semibold text-foreground tabular-nums">{formatSensitive(goal.earmarkedAmount)}</p>
              <p className="text-caption text-muted-foreground tabular-nums">of {formatSensitive(goal.targetAmount)}</p>
            </div>
          </div>

          {/* One status line. The per-cycle figures behind it fold away under Details, so the same
              number is not said by the pool, its tiles and every row at once. */}
          <p className={cn('mt-2 text-label font-medium', pace.isFunded || cycleDone ? 'text-emerald-700 dark:text-emerald-300' : style.text)}>
            {pace.isFunded ? (
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 shrink-0" aria-hidden /> Ready to use
              </span>
            ) : cycleDone ? (
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 shrink-0" aria-hidden /> Done for this cycle
              </span>
            ) : (
              <><span className="font-semibold text-foreground tabular-nums">{formatSensitive(pace.outstandingThisCycle)}</span> still to set aside this cycle</>
            )}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <IconButton
              variant="secondary"
              className="shrink-0"
              onClick={() => onTopUp(goal)}
              disabled={isBusy || hideSensitive || pace.isFunded}
              label={`Add money to ${goal.name}`}
              tooltip={pace.isFunded ? 'This goal already has everything it needs' : `Move free ${fundingBucket.toLowerCase()} money into this goal`}
            >
              <Plus className="size-3.5" />
            </IconButton>
            <Button
              variant="secondary"
              size="sm"
              className="shrink-0"
              onClick={() => onComplete(goal.id)}
              disabled={isBusy || hideSensitive || goal.earmarkedAmount <= 0}
              aria-label={goal.isRecurring ? `Complete this cycle for ${goal.name}` : `Mark ${goal.name} done`}
              title={goal.earmarkedAmount <= 0
                ? `Set aside some ${fundingBucket.toLowerCase()} money before marking this commitment done`
                : goal.isRecurring
                  ? 'Spend the saved amount and roll the deadline forward'
                  : 'Spend the saved amount and mark this commitment done'}
            >
              <CheckCircle2 className="size-3.5 shrink-0" /> Done
            </Button>
            <Button
              variant="tertiary"
              size="sm"
              aria-expanded={showDetails}
              aria-controls={detailsId}
              onClick={() => setShowDetails(open => !open)}
              className="gap-1 text-muted-foreground hover:text-foreground"
            >
              Details
              <ChevronDown className={cn('size-3.5 transition-transform', showDetails && 'rotate-180')} aria-hidden="true" />
            </Button>
            <OverflowMenu
              className="ml-auto"
              entityLabel={goal.name}
              disabled={isBusy}
              items={[
                {
                  label: 'Release money',
                  icon: Minus,
                  onSelect: () => onRelease(goal),
                  disabled: hideSensitive || goal.earmarkedAmount <= 0,
                  hint: hideSensitive
                    ? 'Unhide balances to release money'
                    : `Nothing is set aside in ${goal.name} yet`,
                },
                {
                  label: 'Edit',
                  icon: Edit2,
                  onSelect: () => onEdit(goal),
                  disabled: hideSensitive,
                  hint: 'Unhide balances to edit',
                },
                {
                  label: 'Delete',
                  icon: Trash2,
                  tone: 'danger',
                  onSelect: () => onDelete(goal.id),
                  disabled: hideSensitive,
                  hint: 'Unhide balances to delete',
                },
              ]}
            />
          </div>

          {showDetails && (
            <dl id={detailsId} className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1.5 rounded-control bg-surface-2/70 p-3 text-label dark:bg-surface-3/70 sm:grid-cols-2">
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-muted-foreground">Per cycle</dt>
                <dd className="font-medium text-foreground tabular-nums">{formatSensitive(pace.requiredPerCycle)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-muted-foreground">Time left</dt>
                <dd className="font-medium text-foreground tabular-nums">{describeHorizon(pace)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-muted-foreground">Still to save</dt>
                <dd className="font-medium text-foreground tabular-nums">{formatSensitive(pace.remaining)}</dd>
              </div>
              {goal.isRecurring && (
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="text-muted-foreground">Repeats</dt>
                  <dd className="font-medium text-foreground tabular-nums">Every {goal.recurrenceMonths} months</dd>
                </div>
              )}
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-muted-foreground">This cycle</dt>
                <dd className={cn('text-right font-medium tabular-nums', cycleDone ? 'text-emerald-700 dark:text-emerald-300' : 'text-foreground')}>
                  {formatSensitive(pace.fundedThisCycle)}
                  <span className="font-normal text-muted-foreground"> of {formatSensitive(pace.requiredPerCycle)} · {cyclePct.toFixed(0)}%</span>
                </dd>
              </div>
            </dl>
          )}
        </div>
      </div>
    </li>
  )
}
