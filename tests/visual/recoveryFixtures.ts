import type { StabilityRecovery } from '../../src/types'

export const coveredRecovery = {
  isActive: true,
  markedTotal: 696.05,
  repaidTotal: 10.16,
  outstandingShortfall: 685.89,
  openingOutstanding: 0,
  openingObligations: [],
  lastDrawdownCycleKey: '2026-08',
  target: 6000,
  currentBalance: 5009.50,
  cyclesRemaining: 3,
  requiredThisCycle: 416.23,
  toppedUpThisCycle: 416.23,
  outstandingThisCycle: 0,
  isOverdue: false,
  essentialsCommitted: 0,
  rewardsCommitted: 0,
  suggestedDraws: [],
  recoveryFromDate: '2026-09-10',
  recoveryCohorts: [
    {
      originCycleKey: '2026-07', fromDate: '2026-08-15', transactionCount: 5,
      remainingShortfall: 0, cyclesRemaining: 2, requiredThisCycle: 146.54, isOverdue: false,
    },
    {
      originCycleKey: '2026-08', fromDate: '2026-09-10', transactionCount: 4,
      remainingShortfall: 685.89, cyclesRemaining: 3, requiredThisCycle: 269.69, isOverdue: false,
    },
  ],
} satisfies StabilityRecovery
