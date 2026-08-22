import type { ActiveRecurringPayment, SavingsGoal } from '../types'

/**
 * A goal that still holds a claim on the pool. A row queued for deletion has already released its
 * claim optimistically, so it is not one. Defined here rather than in `savingsGoals.ts` because
 * this module is the lower of the two — the other imports it, not the reverse.
 */
export const isActiveGoal = (goal: SavingsGoal): boolean =>
  goal.status === 'active' && !goal.isPendingDelete

/**
 * Money that is genuinely free for a reward claim. This is the shared calculation for Today,
 * Wishlist and AI actions: the same Rewards balance cannot be spent twice by a goal, a pending
 * bill and a wishlist item.
 */
export function calculateFreeRewardsBalance(
  rewardsBalance: number,
  goals: readonly SavingsGoal[],
  pendingRewards: number,
): number {
  const earmarked = goals.reduce(
    (sum, goal) => isActiveGoal(goal) && (goal.fundingBucket ?? 'Rewards') === 'Rewards'
      ? sum + goal.earmarkedAmount
      : sum,
    0,
  )
  return Math.round(Math.max(0, rewardsBalance - pendingRewards - earmarked) * 100) / 100
}

export function pendingRecurringAmount(
  payments: readonly Pick<ActiveRecurringPayment, 'status' | 'amount' | 'remainingAmount' | 'ledgerCategory'>[] | undefined,
  fundingBucket: string,
): number {
  const total = (payments ?? []).reduce((sum, payment) => {
    if (payment.status !== 'Pending' && payment.status !== 'PartiallyPaid') return sum
    // remainingAmount when the server sent one, else amount — which the API already narrows to the
    // still-owed figure for a part-paid row, so the two agree.
    const outstanding = payment.remainingAmount ?? payment.amount
    if (outstanding == null) return sum
    return payment.ledgerCategory?.toLowerCase() === fundingBucket.toLowerCase()
      ? sum + Math.abs(outstanding)
      : sum
  }, 0)
  return Math.round(total * 100) / 100
}

/**
 * Pending Rewards bills are another claim on the pool until the occurrence is settled — the
 * `pendingRewards` argument above.
 *
 * Matched on `ledgerCategory` alone, case-insensitively, exactly as the server's
 * `SavingsGoalService.GetPendingRewardsRecurringAsync` does. `category` is the ledger category
 * (Food, Social, …) rather than a bucket, so the old fallback to it could only ever match a
 * user-named category that happened to read "Rewards" — money the server would not have held
 * aside, leaving the page reporting less free to spend than the pool actually allows.
 *
 * Lives here beside the balance it feeds rather than in `savingsGoals.ts`, so the eager path can
 * reach it without pulling the whole pacing module onto the critical bundle.
 */
export function pendingRewardsAmount(
  payments: readonly Pick<ActiveRecurringPayment, 'status' | 'amount' | 'remainingAmount' | 'ledgerCategory'>[] | undefined,
): number {
  return pendingRecurringAmount(payments, 'Rewards')
}
