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

// Two plans, the older one with an installment only partly paid: January asks for its own 100, the 60
// still unpaid from December, and the newer plan's first 50.
export const behindRecovery = {
  isActive: true,
  markedTotal: 450,
  repaidTotal: 40,
  outstandingShortfall: 410,
  openingOutstanding: 410,
  openingObligations: [],
  lastDrawdownCycleKey: '2026-11',
  target: 6000,
  currentBalance: 5590,
  cyclesRemaining: 2,
  requiredThisCycle: 210,
  toppedUpThisCycle: 0,
  outstandingThisCycle: 210,
  carriedThisCycle: 60,
  isOverdue: false,
  essentialsCommitted: 0,
  rewardsCommitted: 0,
  suggestedDraws: [],
  recoveryFromDate: '2026-11-04',
  recoveryCohorts: [
    {
      originCycleKey: '2026-11', repaymentCycles: 3, fromDate: '2026-11-04', transactionCount: 1,
      remainingShortfall: 260, cyclesRemaining: 2, requiredThisCycle: 160, isOverdue: false,
    },
    {
      originCycleKey: '2026-12', repaymentCycles: 3, fromDate: '2026-12-14', transactionCount: 1,
      remainingShortfall: 150, cyclesRemaining: 3, requiredThisCycle: 50, isOverdue: false,
    },
  ],
} satisfies StabilityRecovery
