import type { ActiveRecurringPayment, CategorySummary, SavingsGoal } from '../types'
import { isActiveGoal, pendingRecurringAmount } from './freeRewards'

export type OutflowBucket = 'Essentials' | 'Growth' | 'Stability' | 'Rewards'

export interface BucketWarningContext {
  categories?: readonly CategorySummary[]
  savingsGoals?: readonly SavingsGoal[]
  activeRecurringPayments?: readonly Pick<ActiveRecurringPayment, 'status' | 'amount' | 'remainingAmount' | 'ledgerCategory'>[]
  targetStabilityFund?: number
}

export interface BucketOutflowWarningOptions {
  bucket: OutflowBucket
  amount: number
  context: BucketWarningContext
  /** If editing, the original amount previously deducted from this bucket in the current cycle */
  existingAmountInBucket?: number
}

export interface BucketOutflowWarning {
  bucket: OutflowBucket
  shortfall: number
  message: string
}

function toCents(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Pure calculation that assesses whether an outgoing expense or transfer leaves a bucket
 * short of its obligations (e.g. pending bills in Essentials, goal earmarks in Rewards/Essentials,
 * or target in Stability).
 */
export function getBucketOutflowWarning({
  bucket,
  amount,
  context,
  existingAmountInBucket = 0,
}: BucketOutflowWarningOptions): BucketOutflowWarning | null {
  if (!Number.isFinite(amount) || amount <= 0) return null

  const category = context.categories?.find(
    c => c.name.toLowerCase() === bucket.toLowerCase(),
  )
  if (!category) return null

  const baselineRemaining = toCents((category.remaining ?? 0) + Math.max(0, existingAmountInBucket))
  const pendingRecurring = toCents(pendingRecurringAmount(context.activeRecurringPayments, bucket))

  const earmarkedGoals = toCents(
    (context.savingsGoals ?? []).reduce((sum, goal) => {
      if (!isActiveGoal(goal)) return sum
      const goalBucket = goal.fundingBucket ?? 'Rewards'
      return goalBucket.toLowerCase() === bucket.toLowerCase()
        ? sum + Math.max(0, goal.earmarkedAmount)
        : sum
    }, 0),
  )

  if (bucket === 'Essentials') {
    const obligations = toCents(pendingRecurring + earmarkedGoals)
    const safeHeadroom = toCents(Math.max(0, baselineRemaining - obligations))
    const shortfall = toCents(amount - safeHeadroom)
    if (shortfall <= 0) return null

    let message: string
    if (pendingRecurring > 0 && earmarkedGoals > 0) {
      message = 'This amount leaves your Essentials bucket short of covering upcoming bills and commitments this cycle.'
    } else if (pendingRecurring > 0) {
      message = 'This amount leaves your Essentials bucket short of covering upcoming bills this cycle.'
    } else if (earmarkedGoals > 0) {
      message = 'This amount leaves your Essentials bucket short of covering commitment earmarks this cycle.'
    } else {
      message = 'This amount exceeds your remaining Essentials balance.'
    }

    return { bucket, shortfall, message }
  }

  if (bucket === 'Rewards') {
    const obligations = toCents(pendingRecurring + earmarkedGoals)
    const safeHeadroom = toCents(Math.max(0, baselineRemaining - obligations))
    const shortfall = toCents(amount - safeHeadroom)
    if (shortfall <= 0) return null

    let message: string
    if (earmarkedGoals > 0) {
      message = 'This amount dips into your commitment earmarks.'
    } else if (pendingRecurring > 0) {
      message = 'This amount leaves your Rewards bucket short of covering upcoming subscriptions.'
    } else {
      message = 'This amount exceeds your remaining Rewards balance.'
    }

    return { bucket, shortfall, message }
  }

  if (bucket === 'Stability') {
    const target = toCents(Math.max(0, context.targetStabilityFund ?? 0))
    const safeHeadroom = toCents(Math.max(0, baselineRemaining - pendingRecurring - target))
    const shortfall = toCents(amount - safeHeadroom)
    if (shortfall <= 0) return null

    const message = target > 0
      ? 'This amount drops your emergency fund below your target.'
      : 'This amount exceeds your remaining Stability balance.'

    return { bucket, shortfall, message }
  }

  if (bucket === 'Growth') {
    const safeHeadroom = toCents(Math.max(0, baselineRemaining - pendingRecurring))
    const shortfall = toCents(amount - safeHeadroom)
    if (shortfall <= 0) return null

    return {
      bucket,
      shortfall,
      message: 'This amount exceeds your remaining Growth balance.',
    }
  }

  return null
}
