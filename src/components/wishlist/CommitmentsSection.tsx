import React from 'react'
import { CheckCircle2, Plus } from 'lucide-react'
import { CommitmentIcon } from '../semanticIcons'
import type { SavingsGoal } from '../../types'
import type { GoalPoolSummary } from '../../lib/savingsGoals'
import { getPaceStatus } from '../../lib/savingsGoals'
import { Button } from '../ui/Button'
import { InfoHint } from '../ui/InfoHint'
import { SavingsGoalCard } from './SavingsGoalCard'
import { cn } from '../../lib/utils'
import { panelClass } from '../ui/panelStyles'
import { DataTablePagination } from '../ui/DataTable'
import { useClientPagination } from '../ui/useClientPagination'
import { EmptyState } from '../ui/EmptyState'
import { Badge } from '../ui/Badge'

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
 * The commitments list: one panel of progress rows, the active commitments first and the finished
 * ones after them as quiet one-line rows. A list reads the same at every width, where the old rail
 * of tall cards hid most commitments off-screen on a phone and left a lone card floating on desktop.
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
        onEdit={onEditGoal}
        onDelete={onDeleteGoal}
        onComplete={onCompleteGoal}
        onTopUp={onTopUp}
        onRelease={onRelease}
      />
    )
  })

  // Finished commitments stay on the list as history, one quiet line each.
  const completedChips = completedGoals.map(goal => (
    <li key={goal.id} id={`commitment-card-${goal.id}`} className="flex items-center gap-3.5 px-4 py-3 sm:px-5">
      <span className="grid size-[3.25rem] shrink-0 place-items-center">
        <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body font-medium text-foreground">{goal.name}</span>
        <span className="block text-caption text-muted-foreground">Done · {goal.fundingBucket ?? 'Rewards'}</span>
      </span>
      <span className="shrink-0 text-label text-muted-foreground tabular-nums">{formatSensitive(goal.targetAmount)}</span>
    </li>
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
      className="space-y-3"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 id="commitments-rewards-commitments-heading" className="flex items-center gap-1.5 text-subsection text-foreground">
            <CommitmentIcon className="size-4 text-muted-foreground" aria-hidden />
            Commitments
            {pool.activeGoals.length + completedGoals.length > 0 && (
              <Badge tone="neutral">
                {pool.activeGoals.length + completedGoals.length}
              </Badge>
            )}
            <InfoHint
              label="a commitment"
              text="Money held back from an existing bucket for something specific."
            />
          </h3>
        </div>
        <Button variant="secondary" size="sm" className="size-11 shrink-0 p-0 sm:size-auto sm:px-3" onClick={onAddGoal} disabled={hideSensitive} title={hideSensitive ? 'Unhide balances to add a commitment' : undefined} aria-label="Add commitment">
          <Plus className="size-4" aria-hidden /> <span className="hidden sm:inline">Add commitment</span>
        </Button>
      </div>

      {!hasAny ? (
        <EmptyState
          density="compact"
          title="No commitments yet. Add one to save a set amount each cycle."
          actions={<Button variant="secondary" size="sm" onClick={onAddGoal} disabled={hideSensitive}>Add commitment</Button>}
        />
      ) : (
        <ul className={cn(panelClass, 'divide-y divide-border/60 overflow-hidden p-0')}>
          {visibleCollection}
        </ul>
      )}
      {collection.length > pagination.pageSize && (
        <DataTablePagination
          centerOnMobile
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
