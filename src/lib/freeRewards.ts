import type { SavingsGoal } from '../types'

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
    (sum, goal) => goal.status === 'active' && !goal.isPendingDelete
      ? sum + goal.earmarkedAmount
      : sum,
    0,
  )
  return Math.round(Math.max(0, rewardsBalance - pendingRewards - earmarked) * 100) / 100
}
