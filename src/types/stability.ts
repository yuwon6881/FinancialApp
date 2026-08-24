export interface StabilityRecoveryDraw {
  bucket: string
  /** Fraction of a top-up this bucket contributes. The three sum to exactly 1. */
  share: number
}

export type StabilityReloadIntent = 'Unanswered' | 'Required' | 'NotRequired'

export type StabilityReloadStatus = 'Outstanding' | 'PartlyRepaid' | 'Complete' | 'NotRequired'

/** One marked drawdown and how much of it is still owed. */
export interface StabilityReloadObligation {
  transactionId: string
  originalAmount: number
  remainingAmount: number
  /** The drawdown's own date, as `yyyy-MM-dd`. */
  date?: string
}

/**
 * The explicit ledger obligation created by marked emergency-fund drawdowns, and the part that
 * has already been put back. Ordinary salary allocation does not repay a marked drawdown.
 */
export interface StabilityRecovery {
  isActive: boolean
  /**
   * What is still being asked back: the full original amount of every drawdown that still owes
   * money. A drawdown put back in full leaves this figure entirely, so `markedTotal - repaidTotal`
   * always equals `outstandingShortfall`.
   */
  markedTotal: number
  target: number
  currentBalance: number
  outstandingShortfall: number
  /** Authoritative obligation carried into the selected cycle; used for exact optimistic replay. */
  openingOutstanding?: number
  /** Oldest carried obligation date, when the server has one. */
  openingOldestDate?: string
  /**
   * The carried obligations themselves, so an optimistic replay starts from the same queue the
   * server did. Without the identities the client seeds one anonymous entry and cannot tell a
   * partly-repaid carried drawdown from one already put back in full.
   */
  openingObligations?: StabilityReloadObligation[]
  cyclesRemaining: number
  requiredThisCycle: number
  toppedUpThisCycle: number
  outstandingThisCycle: number
  /** The three-cycle window has passed and money is still owed. Distinct from the final cycle. */
  isOverdue: boolean
  lastDrawdownCycleKey?: string
  /** What has gone back against the drawdowns counted in `markedTotal`. */
  repaidTotal: number
  /** Exact date of the oldest marked drawdown that is still outstanding, as `yyyy-MM-dd`. */
  recoveryFromDate?: string
  /** Bills this cycle still owes, which the proposed draw must stay above. */
  essentialsCommitted: number
  /** Savings-goal funding this cycle still owes, likewise protected. */
  rewardsCommitted: number
  suggestedDraws: StabilityRecoveryDraw[]
}
