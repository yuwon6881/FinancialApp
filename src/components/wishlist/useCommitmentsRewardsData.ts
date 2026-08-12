import { useMemo } from 'react'
import type { SavingsGoal, WishlistItem } from '../../types'
import { previewRequiredPerCycle, summarizePool } from '../../lib/savingsGoals'
import { getActiveWishlistItem, orderRewardsForRail } from '../../lib/wishlist'

interface Options {
  wishlist: WishlistItem[]
  savingsGoals: SavingsGoal[]
  rewardsBalance: number
  rewardsTarget: number
  pendingRewardsDeduction: number
  essentialsBalance: number
  essentialsTarget: number
  pendingEssentialsDeduction: number
  pastThreeMonthsRewardsAverage: number
  hasRewardsHistory: boolean
  cycleDay: number
  goalTargetInput: string
  editingGoal: SavingsGoal | null
  goalDateInput: string
}

export function useCommitmentsRewardsData(options: Options) {
  const todayKey = new Date().toLocaleDateString('en-CA')
  const today = useMemo(() => new Date(`${todayKey}T00:00:00`), [todayKey])
  const rewardsPool = useMemo(
    () => summarizePool(options.savingsGoals, options.rewardsBalance, options.rewardsTarget, today, options.cycleDay, options.pendingRewardsDeduction, 'Rewards'),
    [options.savingsGoals, options.rewardsBalance, options.rewardsTarget, today, options.cycleDay, options.pendingRewardsDeduction],
  )
  const essentialsPool = useMemo(
    () => summarizePool(options.savingsGoals, options.essentialsBalance, options.essentialsTarget, today, options.cycleDay, options.pendingEssentialsDeduction, 'Essentials'),
    [options.savingsGoals, options.essentialsBalance, options.essentialsTarget, today, options.cycleDay, options.pendingEssentialsDeduction],
  )
  const commitmentsPool = useMemo(() => ({
    ...rewardsPool,
    activeGoals: [...rewardsPool.activeGoals, ...essentialsPool.activeGoals],
    totalEarmarked: rewardsPool.totalEarmarked + essentialsPool.totalEarmarked,
    requiredPerCycleTotal: rewardsPool.requiredPerCycleTotal + essentialsPool.requiredPerCycleTotal,
    fundedThisCycleTotal: rewardsPool.fundedThisCycleTotal + essentialsPool.fundedThisCycleTotal,
    outstandingThisCycleTotal: rewardsPool.outstandingThisCycleTotal + essentialsPool.outstandingThisCycleTotal,
    paceShortfall: rewardsPool.paceShortfall + essentialsPool.paceShortfall,
    hasUnfinishedGoals: rewardsPool.hasUnfinishedGoals || essentialsPool.hasUnfinishedGoals,
    paces: new Map([...rewardsPool.paces, ...essentialsPool.paces]),
  }), [rewardsPool, essentialsPool])
  const completedGoals = useMemo(
    () => options.savingsGoals.filter(goal => goal.status === 'completed'),
    [options.savingsGoals],
  )
  const goalPacePreview = useMemo(() => previewRequiredPerCycle(
    Number.parseFloat(options.goalTargetInput),
    options.editingGoal?.earmarkedAmount ?? 0,
    options.goalDateInput,
    today,
    options.cycleDay,
  ), [options.goalTargetInput, options.editingGoal, options.goalDateInput, today, options.cycleDay])
  const claimableBalance = rewardsPool.unassigned
  const freeAfterGoalPace = Math.round((claimableBalance - rewardsPool.outstandingThisCycleTotal) * 100) / 100
  const freeInflowPerCycle = useMemo(() => {
    const budgeted = Math.max(0, options.rewardsTarget - rewardsPool.requiredPerCycleTotal)
    return options.hasRewardsHistory
      ? Math.max(0, options.pastThreeMonthsRewardsAverage - rewardsPool.requiredPerCycleTotal)
      : budgeted
  }, [options.rewardsTarget, options.pastThreeMonthsRewardsAverage, options.hasRewardsHistory, rewardsPool.requiredPerCycleTotal])
  const activeItem = useMemo(() => getActiveWishlistItem(options.wishlist), [options.wishlist])
  const rewardItems = useMemo(() => orderRewardsForRail(options.wishlist, activeItem), [options.wishlist, activeItem])
  const affordableCount = useMemo(
    () => rewardItems.filter(item => claimableBalance >= item.price).length,
    [rewardItems, claimableBalance],
  )

  const rewardTimeline = (itemPrice: number) => {
    const remaining = itemPrice - claimableBalance
    if (remaining <= 0) return 'Available now'
    if (freeInflowPerCycle <= 0) return 'No estimate available'
    const days = Math.ceil((remaining / freeInflowPerCycle) * 30)
    const targetDate = new Date(today)
    targetDate.setDate(targetDate.getDate() + days)
    const date = targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    return days < 30 ? `about ${days} days (${date})` : `about ${(days / 30).toFixed(1)} months (${date})`
  }

  return {
    todayKey,
    rewardsPool,
    essentialsPool,
    commitmentsPool,
    completedGoals,
    goalPacePreview,
    claimableBalance,
    freeAfterGoalPace,
    activeItem,
    rewardItems,
    affordableCount,
    rewardTimeline,
  }
}
