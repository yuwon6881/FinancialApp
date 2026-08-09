import React from 'react'
import { CheckCircle2, Flag, Plus } from 'lucide-react'
import type { SavingsGoal } from '../../types'
import type { GoalPoolSummary } from '../../lib/savingsGoals'
import { getPaceStatus } from '../../lib/savingsGoals'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { HorizontalRail } from '../ui/HorizontalRail'
import { SavingsGoalCard } from './SavingsGoalCard'

interface CommitmentsSectionProps {
  pool: GoalPoolSummary
  completedGoals: SavingsGoal[]
  formatSensitive: (value: number) => React.ReactNode
  hideSensitive: boolean
  isGoalSyncing: (id: number) => boolean
  isGoalDeleting: (id: number) => boolean
  onAddGoal: () => void
  onEditGoal: (goal: SavingsGoal) => void
  onDeleteGoal: (id: number) => void
  onCompleteGoal: (id: number) => void
  onTopUp: (goal: SavingsGoal) => void
  onRelease: (goal: SavingsGoal) => void
}

/**
 * The commitments row.
 *
 * A rail only when there is something to scroll to: one lone card in a rail is rendered at the
 * peek-cut `80vw` with no second card behind it, so the affordance that means "there is more this
 * way" reads as a card that simply does not fit the screen. Completed goals ride along as chips and
 * count toward that decision, since they occupy the same track.
 *
 * That lone card stops growing at `lg`: stretched to a desktop panel's full width its content —
 * a name, two short bars and a row of small buttons — sat in a field of empty space that read as
 * a broken layout rather than one goal, and the same card in a rail is only `22rem` wide.
 */
export const CommitmentsSection: React.FC<CommitmentsSectionProps> = ({
  pool,
  completedGoals,
  formatSensitive,
  hideSensitive,
  isGoalSyncing,
  isGoalDeleting,
  onAddGoal,
  onEditGoal,
  onDeleteGoal,
  onCompleteGoal,
  onTopUp,
  onRelease,
}) => {
  const isSolo = pool.activeGoals.length + completedGoals.length === 1

  const goalCards = pool.activeGoals.map(goal => {
    const pace = pool.paces.get(goal.id)
    if (!pace) return null
    return (
      <SavingsGoalCard
        key={goal.id}
        goal={goal}
        pace={pace}
        status={getPaceStatus(pace)}
        formatSensitive={formatSensitive}
        hideSensitive={hideSensitive}
        isSyncing={isGoalSyncing(goal.id)}
        isDeleting={isGoalDeleting(goal.id)}
        fullWidth={isSolo}
        onEdit={onEditGoal}
        onDelete={onDeleteGoal}
        onComplete={onCompleteGoal}
        onTopUp={onTopUp}
        onRelease={onRelease}
      />
    )
  })

  // Completed goals ride along as compact chips rather than a second card below: they are history,
  // but throwing them away entirely would lose the record.
  const completedChips = completedGoals.map(goal => (
    <div
      key={goal.id}
      className={`flex flex-col justify-center gap-1 rounded-2xl border border-dashed border-border/60 bg-muted/20 p-4 ${
        isSolo ? 'w-full lg:max-w-xl' : 'snap-start shrink-0 w-36 sm:w-40'
      }`}
    >
      <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-500">
        <CheckCircle2 className="size-3 shrink-0" /> Done
      </span>
      <span className="text-xs font-bold text-foreground truncate">{goal.name}</span>
      <span className="text-[10px] font-semibold text-muted-foreground">
        {formatSensitive(goal.targetAmount)}
      </span>
    </div>
  ))

  const hasAny = pool.activeGoals.length > 0 || completedGoals.length > 0

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3 px-1">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
          <Flag className="size-4 text-violet-500" />
          Commitments
          {pool.activeGoals.length > 0 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {pool.activeGoals.length}
            </span>
          )}
        </h3>
        <Button variant="secondary" size="sm" onClick={onAddGoal}>
          <Plus className="size-3" /> Add goal
        </Button>
      </div>

      {!hasAny ? (
        <Card className="p-5 border-dashed text-center">
          <p className="text-xs text-muted-foreground">No commitments yet. Add a goal to save a set amount each cycle.</p>
        </Card>
      ) : isSolo ? (
        <div>{goalCards}{completedChips}</div>
      ) : (
        <HorizontalRail label="Commitments" showControls>
          {goalCards}
          {completedChips}
        </HorizontalRail>
      )}
    </section>
  )
}
