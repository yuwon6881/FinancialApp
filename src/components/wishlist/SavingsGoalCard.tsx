import React from 'react'
import { CheckCircle2, Edit2, Minus, Plus, Trash2 } from 'lucide-react'
import type { SavingsGoal } from '../../types'
import type { GoalPace, GoalPaceStatus } from '../../lib/savingsGoals'
import { MONTH_NAMES } from '../../lib/cycle'
import { parseGoalDate } from '../../lib/savingsGoals'
import { useDetailDisclosure } from '../../lib/useDetailDisclosure'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { DetailDisclosure } from '../ui/DetailDisclosure'
import { Meter } from '../ui/Meter'
import { OverflowMenu } from '../ui/OverflowMenu'
import { RowSyncStatus } from '../ui/RowSyncBadge'
import { getCategoryBadgeClass, getCategoryChartColor } from '../../lib/categoryColors'

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
const STATUS: Record<GoalPaceStatus, { label: string; dot: string; text: string; bar: string }> = {
  funded: { label: 'Ready', dot: 'bg-emerald-500', text: 'text-emerald-500', bar: 'bg-emerald-500' },
  onPace: { label: 'On pace', dot: 'bg-emerald-500', text: 'text-emerald-500', bar: 'bg-pink-500' },
  needsFunding: { label: 'Needs funding', dot: 'bg-amber-500', text: 'text-amber-500', bar: 'bg-pink-500' },
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
  const bucketColor = getCategoryChartColor(fundingBucket)
  // Overfunding a goal by hand fills the meter rather than overflowing it.
  const cycleTarget = Math.max(pace.requiredPerCycle, pace.fundedThisCycle)
  const cyclePct = cycleTarget > 0 ? Math.min(100, (pace.fundedThisCycle / cycleTarget) * 100) : 100
  const cycleDone = pace.outstandingThisCycle <= 0
  const isBusy = isSyncing || isDeleting || goal.isPendingSync === true
  const detail = useDetailDisclosure()

  return (
    <Card
      id={elementId}
      className={`flex flex-col gap-3 p-4 transition-colors duration-300 ${
        fullWidth ? 'w-full lg:max-w-xl' : 'w-[calc(100vw-3.5rem)] shrink-0 snap-start sm:w-full sm:min-w-0'
      } ${status === 'overdue' ? 'border-destructive/40' : 'border-border/60'}`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`size-1.5 rounded-full shrink-0 ${style.dot}`} aria-hidden />
          <h4 className="min-w-0 flex-1 truncate text-sm font-bold text-foreground">{goal.name}</h4>
          <RowSyncStatus isDeleting={isDeleting} isSyncing={isSyncing} isPending={goal.isPendingSync} entityLabel="goal" />
        </div>
        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <span className={`rounded-full border px-1.5 py-0.5 text-xs ${getCategoryBadgeClass(fundingBucket)}`}>
            {fundingBucket}
          </span>
          <span>{formatDeadline(goal.targetDate)}</span>
        </p>
      </div>

      {/* One headline: saved against target, with the percentage that was already computed here and
          never shown. */}
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-lg font-extrabold text-foreground">{formatSensitive(goal.earmarkedAmount)}</span>
          <span className="text-xs font-semibold text-muted-foreground">
            of {formatSensitive(goal.targetAmount)}
          </span>
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <Meter
            percent={pct}
            label={`${pct.toFixed(0)}% of this commitment set aside`}
            tone={style.bar}
            color={status === 'onPace' || status === 'needsFunding' ? bucketColor : undefined}
          />
          <span className="shrink-0 text-xs font-bold tabular-nums text-muted-foreground">{pct.toFixed(0)}%</span>
        </div>
      </div>

      {/* One status line. The per-cycle figures behind it used to sit in an always-open inset that
          repeated what the Rewards pool panel and its Committed tile already said — with a single
          commitment the same number appeared three times on one screen. */}
      <p className={`text-xs font-bold ${pace.isFunded || cycleDone ? 'text-emerald-500' : style.text}`}>
        {pace.isFunded ? (
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="size-3.5 shrink-0" aria-hidden /> Ready to use
          </span>
        ) : cycleDone ? (
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="size-3.5 shrink-0" aria-hidden /> Done for this cycle
          </span>
        ) : (
          <>{formatSensitive(pace.outstandingThisCycle)} still to set aside this cycle</>
        )}
      </p>

      <DetailDisclosure
        label="Details"
        open={detail.isOpen}
        onOpenChange={detail.setOpen}
        expandedFrom="lg"
      >
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
          <div>
            <dt className="font-semibold text-muted-foreground">Per cycle</dt>
            <dd className="font-bold text-foreground">{formatSensitive(pace.requiredPerCycle)}</dd>
          </div>
          <div>
            <dt className="font-semibold text-muted-foreground">Time left</dt>
            <dd className="font-bold text-foreground">{describeHorizon(pace)}</dd>
          </div>
          <div>
            <dt className="font-semibold text-muted-foreground">Still to save</dt>
            <dd className="font-bold text-foreground">{formatSensitive(pace.remaining)}</dd>
          </div>
          {goal.isRecurring && (
            <div>
              <dt className="font-semibold text-muted-foreground">Repeats</dt>
              <dd className="font-bold text-foreground">Every {goal.recurrenceMonths} months</dd>
            </div>
          )}
          <div className="col-span-2 space-y-1">
            <dt className="font-semibold text-muted-foreground">
              This cycle: <span className={`font-extrabold ${cycleDone ? 'text-emerald-500' : 'text-foreground'}`}>
                {formatSensitive(pace.fundedThisCycle)}
              </span>{' '}of {formatSensitive(pace.requiredPerCycle)}
            </dt>
            <dd>
              <Meter
                percent={cyclePct}
                size="sm"
                tone={cycleDone ? 'bg-emerald-500' : style.bar}
                label={cycleDone
                  ? "This cycle's share is set aside"
                  : `${cyclePct.toFixed(0)}% of this cycle's share set aside`}
              />
            </dd>
          </div>
        </dl>
      </DetailDisclosure>

      <div className="mt-auto flex items-center gap-1.5 border-t border-border/30 pt-3">
        <Button
          variant="secondary"
          size="icon"
          className="shrink-0"
          onClick={() => onTopUp(goal)}
          disabled={isBusy || hideSensitive || pace.isFunded}
          aria-label={`Add money to ${goal.name}`}
          title={pace.isFunded ? 'This goal already has everything it needs' : `Move free ${fundingBucket.toLowerCase()} money into this goal`}
        >
          <Plus className="size-3.5" />
        </Button>
        <Button
          variant="successGhost"
          size="sm"
          className="h-11 sm:h-9 shrink-0"
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
        {/* One primary pair plus a menu, so releasing money and editing no longer have to replace
            the money actions to fit at rail width. */}
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
    </Card>
  )
}
