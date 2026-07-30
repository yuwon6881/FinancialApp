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
import { getErrorMessage } from '../lib/errors'
import { formatCurrencyVal } from '../lib/utils'

type ToastTone = 'info' | 'success' | 'warning' | 'error'

export interface SavingsGoalActionDeps {
  currency: string
  commitGoals: (goals: SavingsGoal[]) => void
  showToast: (message: string, title?: string, tone?: ToastTone) => void
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
    deps.showToast(
      amount > 0 ? 'Moved into this goal.' : 'Released back to free rewards.',
      'Goal updated',
      'success',
    )
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
    deps.showToast(
      funded
        ? `${formatCurrencyVal(result.totalGranted, deps.currency)} set aside across your goals.`
        : 'Your goals are already funded for this cycle.',
      funded ? 'Goals funded' : 'Nothing to fund',
      funded ? 'success' : 'info',
    )
  } catch (error: unknown) {
    deps.showToast(getErrorMessage(error), 'Could not fund your goals', 'error')
  }
}

export async function completeGoal(deps: SavingsGoalActionDeps, id: number): Promise<void> {
  const { completeSavingsGoal, fetchSavingsGoals } = await import('../lib/api/savingsGoals')
  try {
    await completeSavingsGoal(id)
    deps.commitGoals(await fetchSavingsGoals())
    deps.showToast(
      'The money set aside is released — log the actual spend in your ledger.',
      'Goal completed',
      'success',
    )
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
export function describeCompleteGoal(goal: SavingsGoal | undefined) {
  if (goal?.isRecurring) {
    return {
      title: 'Complete This Round',
      message: `Mark "${goal.name}" done for this round? Its deadline rolls forward by ${goal.recurrenceMonths} month(s) and saving starts again from zero.`,
      confirmText: 'Roll Forward',
    }
  }
  return {
    title: 'Complete Savings Goal',
    message: `Mark "${goal?.name || 'this goal'}" done? The money set aside is released back to your rewards pool — then log the actual spend in your ledger as usual.`,
    confirmText: 'Complete',
  }
}
