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
export function getRewardsAvailability(
  rewardsBalance: number,
  goals: readonly SavingsGoal[],
  pendingRewards: number,
): { committed: number; freeToSpend: number } {
  const earmarked = goals.reduce(
    (sum, goal) => isActiveGoal(goal) && (goal.fundingBucket ?? 'Rewards') === 'Rewards'
      ? sum + goal.earmarkedAmount
      : sum,
    0,
  )
  const committed = Math.round((earmarked + Math.max(0, pendingRewards)) * 100) / 100
  return {
    committed,
    freeToSpend: Math.round(Math.max(0, rewardsBalance - committed) * 100) / 100,
  }
}

/**
 * How far free Rewards money goes towards a reward's price, as a 0–100 percentage, and whether it
 * already covers it. A reward with no usable price (missing, zero or not a number) has no progress
 * to show, so it reports 0% rather than the NaN a bare division would produce, and is never
 * "ready to buy".
 */
export function rewardFundingProgress(freeBalance: number, price: number): { pct: number; canAfford: boolean } {
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(freeBalance)) return { pct: 0, canAfford: false }
  return {
    pct: Math.max(0, Math.min(100, (freeBalance / price) * 100)),
    canAfford: freeBalance >= price,
  }
}

export function calculateFreeRewardsBalance(
  rewardsBalance: number,
  goals: readonly SavingsGoal[],
  pendingRewards: number,
): number {
  return getRewardsAvailability(rewardsBalance, goals, pendingRewards).freeToSpend
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
