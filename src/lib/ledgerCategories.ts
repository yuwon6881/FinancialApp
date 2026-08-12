/** The four user-facing ledger buckets, shared by recurring payments and savings goals. */
export const RECURRING_LEDGER_CATEGORIES = ['Essentials', 'Growth', 'Stability', 'Rewards'] as const

export type RecurringLedgerCategory = typeof RECURRING_LEDGER_CATEGORIES[number]

export function isRecurringLedgerCategory(value: string): value is RecurringLedgerCategory {
  return (RECURRING_LEDGER_CATEGORIES as readonly string[]).includes(value)
}

/** Savings goals may earmark only money from these two existing buckets. */
export const SAVINGS_GOAL_FUNDING_BUCKETS = ['Essentials', 'Rewards'] as const

export type SavingsGoalFundingBucket = typeof SAVINGS_GOAL_FUNDING_BUCKETS[number]

export function isSavingsGoalFundingBucket(value: string): value is SavingsGoalFundingBucket {
  return (SAVINGS_GOAL_FUNDING_BUCKETS as readonly string[]).includes(value)
}
