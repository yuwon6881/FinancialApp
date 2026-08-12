// The savings-goal actions that move money, plus the confirmation copy that goes with them.
//
// These live in their own module, imported on demand by useFinancialData, for two reasons:
//
// 1. Bundle: useFinancialData is on the eager critical path, and none of this is reachable until
//    the user opens the (lazily-loaded) Rewards view and taps something. Keeping the bodies and
//    their user-facing strings here keeps them out of the entry chunk.
// 2. Correctness: every one of these needs the authoritative bucket balance so the server can
//    enforce SUM(earmarked) <= balance. They are deliberately online-only rather than outbox ops,
//    because a replayed op could apply against a pool that has since changed.

import type { SavingsGoal, SavingsGoalFundingBucket, Transaction } from '../types'
import type { ToastAction } from '../components/ui/ToastViewport'
import { getErrorMessage } from '../lib/errors'
import { buildMutationSuccessToast, buildUndoSuccessToast } from '../lib/mutationToast'
import { formatCurrencyVal } from '../lib/utils'

type ToastTone = 'info' | 'success' | 'warning' | 'error'

export interface SavingsGoalActionDeps {
  currency: string
  commitGoals: (goals: SavingsGoal[]) => void
  commitGoal: (goal: SavingsGoal) => void
  getGoalName: (id: number) => string | undefined
  getGoal?: (id: number) => SavingsGoal | undefined
  beginDirectSync?: (ids: Array<string | number>) => void
  endDirectSync?: (ids: Array<string | number>) => void
  getActiveGoalIds?: () => number[]
  addPendingLedgerTransaction?: (transaction: Transaction) => void
  replacePendingLedgerTransaction?: (pendingId: string, transaction: Transaction) => void
  removePendingLedgerTransaction?: (id: string) => void
  setDeletingTransactionId?: (id: string | null) => void
  refreshAll: () => Promise<void>
  showToast: (message: string, title?: string, tone?: ToastTone, action?: ToastAction) => void
}

/**
 * Returns the rejection message when the move was refused, or `null` when it
 * succeeded (or was already reported, as with the offline notice). The caller
 * keeps its sheet open and renders the message on the amount field: an
 * over-commit is an answer about the number the user just typed, and a toast
 * for it would land behind the sheet that produced it.
 */
export async function contributeToGoal(
  deps: SavingsGoalActionDeps,
  id: number,
  amount: number,
): Promise<string | null> {
  if (!isOnline()) {
    showOnlineOnlyMessage(deps, 'Moving money into a savings goal needs a live connection so the current bucket balance can be checked.')
    return null
  }
  const { contributeToSavingsGoal, fetchSavingsGoals } = await import('../lib/api/savingsGoals')
  deps.beginDirectSync?.([id])
  try {
    await contributeToSavingsGoal(id, amount)
    deps.commitGoals(await fetchSavingsGoals())
    const copy = buildMutationSuccessToast({
      entity: 'Savings Goal',
      action: 'Updated',
      recordName: deps.getGoalName(id),
      messageSuffix: amount > 0
        ? `${formatCurrencyVal(Math.abs(amount), deps.currency)} was moved into this goal.`
        : `${formatCurrencyVal(Math.abs(amount), deps.currency)} was released back to free ${bucketLabel(deps.getGoal?.(id))}.`,
    })
    deps.showToast(copy.message, copy.title, copy.tone)
    return null
  } catch (error: unknown) {
    // The likeliest failure is the server rejecting an over-commit against a balance the client
    // thought was larger. Surface its message rather than a generic one.
    return getErrorMessage(error, 'That money could not be moved.')
  } finally {
    deps.endDirectSync?.([id])
  }
}

export async function fundGoalsForCycle(deps: SavingsGoalActionDeps, bucket: SavingsGoalFundingBucket = 'Rewards'): Promise<void> {
  if (!isOnline()) {
    showOnlineOnlyMessage(deps, 'Funding goals for a new cycle needs a live connection so the current bucket balances can be checked.')
    return
  }
  const { fundSavingsGoalsForCycle } = await import('../lib/api/savingsGoals')
  const syncIds = ['savings-goals-fund', ...(deps.getActiveGoalIds?.() ?? [])]
  deps.beginDirectSync?.(syncIds)
  try {
    const result = await fundSavingsGoalsForCycle()
    deps.commitGoals(result.goals)
    const bucketLabel = bucket === 'Essentials' ? 'Essentials' : 'Rewards'
    const freeToSpend = bucket === 'Essentials' ? result.essentialsFreeToSpend : result.rewardsFreeToSpend
    const funded = result.totalGranted > 0
    if (funded) {
      const copy = buildMutationSuccessToast({
        entity: 'Savings Goals',
        action: 'Funded',
        message: `Savings goals were funded for this cycle. ${formatCurrencyVal(result.totalGranted, deps.currency)} was set aside across your goals. ${formatCurrencyVal(freeToSpend, deps.currency)} remains free in ${bucketLabel}.`,
      })
      deps.showToast(copy.message, copy.title, copy.tone)
    } else {
      deps.showToast(`Your ${bucketLabel.toLowerCase()} goals are already funded for this cycle. ${formatCurrencyVal(freeToSpend, deps.currency)} remains free.`, 'Nothing to fund', 'info')
    }
  } catch (error: unknown) {
    deps.showToast(getErrorMessage(error), 'Could not fund your goals', 'error')
  } finally {
    deps.endDirectSync?.(syncIds)
  }
}

export async function completeGoal(deps: SavingsGoalActionDeps, id: number): Promise<void> {
  if (!isOnline()) {
    showOnlineOnlyMessage(deps, 'Completing a savings goal needs a live connection so its linked ledger transaction and rollback snapshot stay authoritative.')
    return
  }
  const { completeSavingsGoal } = await import('../lib/api/savingsGoals')
  const goal = deps.getGoal?.(id)
  const pendingTransaction = goal ? createPendingCompletionTransaction(goal) : undefined
  const syncIds = [String(id), ...(pendingTransaction ? [pendingTransaction.id] : [])]
  deps.beginDirectSync?.(syncIds)
  if (pendingTransaction) deps.addPendingLedgerTransaction?.(pendingTransaction)
  try {
    const result = await completeSavingsGoal(id)
    if (pendingTransaction) {
      deps.replacePendingLedgerTransaction?.(pendingTransaction.id, result.transaction)
    }
    // Committed only once the authoritative refresh has landed, and in a `finally` so a failed
    // refresh still records the completion. Zeroing the earmark first released it from the pool
    // while the matching Rewards spend was still absent from the dashboard — the optimistic
    // dashboard reads queued ops, not this direct row — so free-to-spend briefly claimed the
    // completed amount twice, which is long enough to claim a reward against money already gone.
    try {
      await deps.refreshAll()
    } finally {
      deps.commitGoal(result.goal)
    }
    // replacePendingLedgerTransaction swaps the local placeholder id for the server id.
    // Remove that server-shaped projection after the authoritative refresh; removing the old
    // placeholder would leave a hidden duplicate that resurfaces after the real row is deleted.
    if (pendingTransaction) deps.removePendingLedgerTransaction?.(result.transaction.id)
    const spent = formatCurrencyVal(Math.abs(result.transaction.amount), deps.currency)
    const copy = buildMutationSuccessToast({
      entity: 'Savings Goal',
      action: result.goal.isRecurring ? 'Rolled Forward' : 'Completed',
      recordName: result.goal.name,
      messageSuffix: `${spent} was spent from ${bucketLabel(result.goal)} and recorded in your ledger.`,
    })
    deps.showToast(copy.message, copy.title, copy.tone, {
      label: 'Undo',
      onAction: () => {
        if (!isOnline()) {
          showOnlineOnlyMessage(deps, 'Undoing a completed savings goal needs a live connection so the linked ledger row and goal snapshot stay consistent.')
          return
        }
        void (async () => {
          const undoSyncIds = [result.transaction.id, String(result.goal.id)]
          deps.beginDirectSync?.(undoSyncIds)
          deps.setDeletingTransactionId?.(result.transaction.id)
          try {
            const { deleteTransaction } = await import('../lib/api/transactions')
            await deleteTransaction(result.transaction.id)
            await deps.refreshAll()
            deps.removePendingLedgerTransaction?.(result.transaction.id)
            if (goal) deps.commitGoal(goal)
            const undoCopy = buildUndoSuccessToast(result.goal.name, 'savings goal')
            deps.showToast(undoCopy.message, undoCopy.title, undoCopy.tone)
          } catch (error: unknown) {
            deps.showToast(getErrorMessage(error), 'Could not undo completion', 'error')
          } finally {
            deps.setDeletingTransactionId?.(null)
            deps.endDirectSync?.(undoSyncIds)
          }
        })()
      },
    })
  } catch (error: unknown) {
    if (pendingTransaction) deps.removePendingLedgerTransaction?.(pendingTransaction.id)
    deps.showToast(getErrorMessage(error), 'Could not complete this goal', 'error')
  } finally {
    deps.endDirectSync?.(syncIds)
  }
}

function isOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false
}

function showOnlineOnlyMessage(deps: SavingsGoalActionDeps, message: string): void {
  deps.showToast(message, 'Available online only', 'warning')
}

function createPendingCompletionTransaction(goal: SavingsGoal): Transaction {
  const postedAt = new Date().toISOString()
  return {
    id: `pending-savings-goal-completion-${goal.id}-${Date.now()}`,
    date: postedAt.slice(0, 10),
    postedAt,
    description: `Completed commitment: ${goal.name}`,
    category: 'Other',
    ledgerCategory: bucketLabel(goal),
    amount: -Math.abs(goal.earmarkedAmount),
    savingsGoalId: goal.id,
    isPendingSync: true,
  }
}

function bucketLabel(goal: SavingsGoal | undefined): 'Essentials' | 'Rewards' {
  return goal?.fundingBucket === 'Essentials' ? 'Essentials' : 'Rewards'
}

/** Confirmation copy for deleting a goal. Deleting only releases the earmark; no money moves. */
export function describeDeleteGoal(goal: SavingsGoal | undefined, currency: string) {
  return {
    title: 'Delete Savings Goal',
    message: goal && goal.earmarkedAmount > 0
      ? `Delete "${goal.name}"? ${formatCurrencyVal(goal.earmarkedAmount, currency)} returns to free ${bucketLabel(goal)}; no ledger money moves.`
      : `Delete "${goal?.name || 'this savings goal'}"? This removes the commitment from your ${bucketLabel(goal).toLowerCase()} pool.`,
    confirmText: 'Delete',
  }
}

/** Confirmation copy for completing a goal, or rolling a recurring one forward. */
export function describeCompleteGoal(goal: SavingsGoal | undefined, currency: string) {
  const amount = formatCurrencyVal(goal?.earmarkedAmount ?? 0, currency)
  if (goal?.isRecurring) {
    return {
      title: 'Complete This Round',
      message: `Mark "${goal.name}" done? ${amount} is recorded in ${bucketLabel(goal)}. The deadline moves forward ${goal.recurrenceMonths} month(s); deleting that entry restores this round.`,
      confirmText: 'Roll Forward',
    }
  }
  return {
    title: 'Complete Savings Goal',
    message: `Mark "${goal?.name || 'this goal'}" done? ${amount} is recorded in ${bucketLabel(goal)}. Deleting that ledger entry restores the commitment.`,
    confirmText: 'Complete',
  }
}
