export type CategoryFlowType = 'both' | 'inflow' | 'outflow'

export interface TransactionCategory {
  id: string
  name: string
  type?: CategoryFlowType
  cycleLimit?: number | null
  isPendingSync?: boolean
  /** Internal optimistic projection marker for a queue op that changes this row indirectly. */
  pendingSyncOperationId?: string
  // Set locally while a delete op for this record is still queued/in-flight in the outbox.
  isPendingDelete?: boolean
}

export interface AutocompleteSuggestion {
  description: string
  category: string
  ledgerCategory: string
  txType: "inflow" | "outflow"
}

export interface WishlistItem {
  id: number
  name: string
  price: number
  priority: string // High, Medium, Low
  isPurchased: boolean
  purchasedAt?: string
  purchaseTransactionId?: string | null
  createdAt: string
  isActive: boolean
  isPendingSync?: boolean
  // Set locally while a delete op for this record is still queued/in-flight in the outbox.
  isPendingDelete?: boolean
}

export type SavingsGoalStatus = 'active' | 'completed'
export type SavingsGoalFundingBucket = 'Essentials' | 'Rewards'

/**
 * A dated savings commitment funded out of an existing Essentials or Rewards pool.
 *
 * It is not a fifth budget bucket — the four ledger allocations are untouched. `earmarkedAmount`
 * is a claim on money that already exists in `fundingBucket`; the sum of active claims in that
 * bucket can never exceed its balance.
 */
export interface SavingsGoal {
  id: number
  name: string
  targetAmount: number
  earmarkedAmount: number
  /** Existing ledger bucket that holds this goal's earmark; older cached rows mean Rewards. */
  fundingBucket?: SavingsGoalFundingBucket
  /** 'YYYY-MM-DD' — the date the money needs to be ready. Drives the required-per-cycle pace. */
  targetDate: string
  priority: string // High, Medium, Low
  status: SavingsGoalStatus
  isRecurring: boolean
  recurrenceMonths: number
  /** Cycle key ("yyyy-MM") that `cycleFundedAmount` is measured against. */
  cycleFundedKey?: string | null
  /**
   * Net amount credited to this goal during `cycleFundedKey`, from automatic funding and manual
   * top-ups alike, less releases. Drives "what does this goal still need *this* cycle", which is
   * what the funding action operates on.
   */
  cycleFundedAmount: number
  createdAt: string
  completedAt?: string | null
  isPendingSync?: boolean
  // Set locally while a delete op for this record is still queued/in-flight in the outbox.
  isPendingDelete?: boolean
}
