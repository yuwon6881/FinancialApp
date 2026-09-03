import React from 'react'
import { CheckCircle2, Plus } from 'lucide-react'
import { CommitmentIcon } from '../semanticIcons'
import type { SavingsGoal } from '../../types'
import type { GoalPoolSummary } from '../../lib/savingsGoals'
import { getPaceStatus } from '../../lib/savingsGoals'
import { Button } from '../ui/Button'
import { HorizontalRail } from '../ui/HorizontalRail'
import { InfoHint } from '../ui/InfoHint'
import { SavingsGoalCard } from './SavingsGoalCard'
import { getCategoryBadgeClass } from '../../lib/categoryColors'
import { useIsCompact } from '../../lib/breakpoints'
import { DataTablePagination } from '../ui/DataTable'
import { useClientPagination } from '../ui/useClientPagination'
import { cn } from '../../lib/utils'
import { panelFromMediumClass } from '../ui/panelStyles'

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
  const isCompact = useIsCompact()
  const isSolo = pool.activeGoals.length + completedGoals.length === 1

  const goalCards = pool.activeGoals.map(goal => {
    const pace = pool.paces.get(goal.id)
    if (!pace) return null
    return (
      <SavingsGoalCard
        key={goal.id}
        elementId={`commitment-card-${goal.id}`}
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
      id={`commitment-card-${goal.id}`}
      className={`flex flex-col justify-center gap-1 rounded-2xl border border-dashed border-border/60 bg-muted/20 p-4 ${
        isSolo ? 'w-full lg:max-w-xl' : 'snap-start shrink-0 w-36 sm:w-40'
      }`}
    >
      <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-500">
        <CheckCircle2 className="size-3 shrink-0" /> Done
      </span>
      <span className="text-xs font-bold text-foreground truncate">{goal.name}</span>
      <span className={`w-fit rounded-full border px-1.5 py-0.5 text-xs ${getCategoryBadgeClass(goal.fundingBucket ?? 'Rewards')}`}>
        {goal.fundingBucket ?? 'Rewards'}
      </span>
      <span className="text-xs font-semibold text-muted-foreground">
        {formatSensitive(goal.targetAmount)}
      </span>
    </div>
  ))

  const hasAny = pool.activeGoals.length > 0 || completedGoals.length > 0
  const collection = [...goalCards, ...completedChips].filter(Boolean)
  const pagination = useClientPagination(collection.length, 9)
  const visibleCollection = collection.slice(pagination.start, pagination.end)

  return (
    /* The panel shell every other view uses. These two sections were bare headings with cards
       floating on the page background, directly under a header and a pool bar that *were* panels —
       so the page started as chrome and then stopped, which is most of why it reads as a different
       application from the rest of the app. */
    <section
      aria-labelledby="commitments-rewards-commitments-heading"
      className={cn(panelFromMediumClass, 'space-y-3')}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 id="commitments-rewards-commitments-heading" className="flex items-center gap-1.5 text-sm font-bold text-foreground">
            <CommitmentIcon className="size-4 text-accent-ink" aria-hidden />
            Commitments
            {pool.activeGoals.length + completedGoals.length > 0 && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                {pool.activeGoals.length + completedGoals.length}
              </span>
            )}
            <InfoHint
              label="a commitment"
              text="Money held back from an existing bucket for something specific."
            />
          </h3>
        </div>
        <Button variant="secondary" size="sm" className="size-11 shrink-0 p-0 sm:size-auto sm:px-3 sm:py-1.5" onClick={onAddGoal} disabled={hideSensitive} title={hideSensitive ? 'Unhide balances to add a commitment' : undefined} aria-label="Add commitment">
          <Plus className="size-3" aria-hidden /> <span className="hidden sm:inline">Add commitment</span>
        </Button>
      </div>

      {!hasAny ? (
        <div className="rounded-xl border border-dashed border-border/60 bg-muted/15 px-4 py-6 text-center">
          <p className="text-xs text-muted-foreground">No commitments yet. Add one to save a set amount each cycle.</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={onAddGoal} disabled={hideSensitive}>Add commitment</Button>
        </div>
      ) : isSolo ? (
        <div>{visibleCollection}</div>
      ) : isCompact ? (
        <HorizontalRail label="Commitments" showControls>
          {visibleCollection}
        </HorizontalRail>
      ) : (
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 min-[1280px]:grid-cols-3">
          {visibleCollection}
        </div>
      )}
      {collection.length > pagination.pageSize && (
        <DataTablePagination
          currentPage={pagination.page}
          pageSize={pagination.pageSize}
          totalItems={collection.length}
          totalPages={pagination.totalPages}
          showPageSize={false}
          onPageChange={pagination.setPage}
          onPageSizeChange={() => undefined}
        />
      )}
    </section>
  )
}
