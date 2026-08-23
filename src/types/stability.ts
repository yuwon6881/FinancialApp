export interface StabilityRecoveryDraw {
  bucket: string
  /** Fraction of a top-up this bucket contributes. The three sum to exactly 1. */
  share: number
}

export type StabilityReloadIntent = 'Unanswered' | 'Required' | 'NotRequired'

export type StabilityReloadStatus = 'Outstanding' | 'PartlyRepaid' | 'Complete' | 'NotRequired'

/**
 * The explicit ledger obligation created by marked emergency-fund drawdowns, and the part that
 * has already been put back. Ordinary salary allocation does not repay a marked drawdown.
 */
export interface StabilityRecovery {
  isActive: boolean
  markedTotal: number
  target: number
  currentBalance: number
  outstandingShortfall: number
  /** Authoritative obligation carried into the selected cycle; used for exact optimistic replay. */
  openingOutstanding?: number
  /** Oldest carried obligation date, when the server has one. */
  openingOldestDate?: string
  cyclesRemaining: number
  requiredThisCycle: number
  toppedUpThisCycle: number
  outstandingThisCycle: number
  /** The three-cycle window has passed and money is still owed. Distinct from the final cycle. */
  isOverdue: boolean
  lastDrawdownCycleKey?: string
  repaidTotal: number
  /** Exact date of the oldest marked drawdown that is still outstanding, as `yyyy-MM-dd`. */
  recoveryFromDate?: string
  /** Bills this cycle still owes, which the proposed draw must stay above. */
  essentialsCommitted: number
  /** Savings-goal funding this cycle still owes, likewise protected. */
  rewardsCommitted: number
  suggestedDraws: StabilityRecoveryDraw[]
}
