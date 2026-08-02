// The savings-goal actions that move money, plus the confirmation copy that goes with them.
//
// These live in their own module, imported on demand by useFinancialData, for two reasons:
//
// 1. Bundle: useFinancialData is on the eager critical path, and none of this is reachable until
//    the user opens the (lazily-loaded) Rewards view and taps something. Keeping the bodies and
//    their user-facing strings here keeps them out of the entry chunk.
// 2. Correctness: every one of these needs the authoritative Rewards balance so the server can
//    enforce SUM(earmarked) <= balance. They are deliberately online-only rather than outbox ops,
//    because a replayed op could apply against a pool that has since changed.

import type { SavingsGoal } from '../types'
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
  refreshAll: () => Promise<void>
  showToast: (message: string, title?: string, tone?: ToastTone, action?: ToastAction) => void
}

export async function contributeToGoal(
  deps: SavingsGoalActionDeps,
  id: number,
  amount: number,
): Promise<void> {
  const { contributeToSavingsGoal, fetchSavingsGoals } = await import('../lib/api/savingsGoals')
  try {
    await contributeToSavingsGoal(id, amount)
    deps.commitGoals(await fetchSavingsGoals())
    const copy = buildMutationSuccessToast({
      entity: 'Savings Goal',
      action: 'Updated',
      recordName: deps.getGoalName(id),
      messageSuffix: amount > 0
        ? `${formatCurrencyVal(Math.abs(amount), deps.currency)} was moved into this goal.`
        : `${formatCurrencyVal(Math.abs(amount), deps.currency)} was released back to free rewards.`,
    })
    deps.showToast(copy.message, copy.title, copy.tone)
  } catch (error: unknown) {
    // The likeliest failure is the server rejecting an over-commit against a balance the client
    // thought was larger. Surface its message rather than a generic one.
    deps.showToast(getErrorMessage(error), 'Could not move that money', 'error')
  }
}

export async function fundGoalsForCycle(deps: SavingsGoalActionDeps): Promise<void> {
  const { fundSavingsGoalsForCycle } = await import('../lib/api/savingsGoals')
  try {
    const result = await fundSavingsGoalsForCycle()
    deps.commitGoals(result.goals)
    const funded = result.totalGranted > 0
    if (funded) {
      const copy = buildMutationSuccessToast({
        entity: 'Savings Goals',
        action: 'Funded',
        message: `Savings goals were funded for this cycle. ${formatCurrencyVal(result.totalGranted, deps.currency)} was set aside across your goals.`,
      })
      deps.showToast(copy.message, copy.title, copy.tone)
    } else {
      deps.showToast('Your goals are already funded for this cycle.', 'Nothing to fund', 'info')
    }
  } catch (error: unknown) {
    deps.showToast(getErrorMessage(error), 'Could not fund your goals', 'error')
  }
}

export async function completeGoal(deps: SavingsGoalActionDeps, id: number): Promise<void> {
  const { completeSavingsGoal } = await import('../lib/api/savingsGoals')
  try {
    const result = await completeSavingsGoal(id)
    deps.commitGoal(result.goal)
    await deps.refreshAll()
    const spent = formatCurrencyVal(Math.abs(result.transaction.amount), deps.currency)
    const copy = buildMutationSuccessToast({
      entity: 'Savings Goal',
      action: result.goal.isRecurring ? 'Rolled Forward' : 'Completed',
      recordName: result.goal.name,
      messageSuffix: `${spent} was spent from Rewards and recorded in your ledger.`,
    })
    deps.showToast(copy.message, copy.title, copy.tone, {
      label: 'Undo',
      onAction: () => {
        void (async () => {
          try {
            const { deleteTransaction } = await import('../lib/api/transactions')
            await deleteTransaction(result.transaction.id)
            await deps.refreshAll()
            const undoCopy = buildUndoSuccessToast(result.goal.name, 'savings goal')
            deps.showToast(undoCopy.message, undoCopy.title, undoCopy.tone)
          } catch (error: unknown) {
            deps.showToast(getErrorMessage(error), 'Could not undo completion', 'error')
          }
        })()
      },
    })
  } catch (error: unknown) {
    deps.showToast(getErrorMessage(error), 'Could not complete this goal', 'error')
  }
}

/** Confirmation copy for deleting a goal. Deleting only releases the earmark; no money moves. */
export function describeDeleteGoal(goal: SavingsGoal | undefined, currency: string) {
  return {
    title: 'Delete Savings Goal',
    message: goal && goal.earmarkedAmount > 0
      ? `Delete "${goal.name}"? The ${formatCurrencyVal(goal.earmarkedAmount, currency)} set aside for it goes back to your free rewards — no money leaves your ledger.`
      : `Delete "${goal?.name || 'this savings goal'}"? This removes the commitment from your rewards pool.`,
    confirmText: 'Delete',
  }
}

/** Confirmation copy for completing a goal, or rolling a recurring one forward. */
export function describeCompleteGoal(goal: SavingsGoal | undefined, currency: string) {
  const amount = formatCurrencyVal(goal?.earmarkedAmount ?? 0, currency)
  if (goal?.isRecurring) {
    return {
      title: 'Complete This Round',
      message: `Mark "${goal.name}" done for this round? ${amount} will be spent from Rewards and recorded in your ledger. Its deadline then rolls forward by ${goal.recurrenceMonths} month(s). Deleting that ledger entry restores this round and its date.`,
      confirmText: 'Roll Forward',
    }
  }
  return {
    title: 'Complete Savings Goal',
    message: `Mark "${goal?.name || 'this goal'}" done? ${amount} will be spent from Rewards and recorded in your ledger. Deleting that ledger entry restores the commitment.`,
    confirmText: 'Complete',
  }
}
