import { describe, expect, it } from 'vitest'
import {
  isRecoveryActive,
  buildStabilityPlanPoints,
  projectStabilityRecovery,
  projectStabilityReloadStatuses,
  replayStabilityReload,
  proposeTopUp,
  describeStabilityReloadMovements,
  stabilityReloadStatusLabel,
  type RecoveryBucketState,
} from './stabilityRecovery'
import type { StabilityRecovery, Transaction } from '@/types'

// Mirrors StabilityRecoveryPlannerTests.cs case for case, so drift between the two
// implementations shows up as a failing pair rather than a quiet disagreement.

// A raw fold over described movements, with no FIFO discharge and no target clearing. Deliberately
// test-only: it is the right shape for asserting the per-movement description rules below and the
// wrong shape for any reported total, because a settled drawdown still contributes to it.
const summarize = (transactions: Transaction[], stabilityAlloc: number) =>
  describeStabilityReloadMovements(transactions, stabilityAlloc).reduce(
    (accumulated, movement) => ({
      markedAmount: accumulated.markedAmount + (movement.marked ? Math.max(0, -movement.change) : 0),
      repaidAmount: accumulated.repaidAmount + movement.repayment,
    }),
    { markedAmount: 0, repaidAmount: 0 },
  )

const recovery = (overrides: Partial<StabilityRecovery> = {}): StabilityRecovery => ({
  isActive: true,
  markedTotal: 3000,
  target: 10000,
  currentBalance: 7000,
  outstandingShortfall: 3000,
  cyclesRemaining: 3,
  requiredThisCycle: 1000,
  toppedUpThisCycle: 0,
  outstandingThisCycle: 1000,
  isOverdue: false,
  lastDrawdownCycleKey: '2026-06',
  repaidTotal: 0,
  essentialsCommitted: 0,
  rewardsCommitted: 0,
  suggestedDraws: [
    { bucket: 'Essentials', share: 0.588235 },
    { bucket: 'Growth', share: 0.294118 },
    { bucket: 'Rewards', share: 0.117647 },
  ],
  ...overrides,
})

const buckets = (overrides: Partial<Record<string, Partial<RecoveryBucketState>>> = {}): RecoveryBucketState[] => [
  { bucket: 'Essentials', alloc: 0.5, balance: 5000, committed: 0, ...overrides.Essentials },
  { bucket: 'Growth', alloc: 0.25, balance: 5000, committed: 0, ...overrides.Growth },
  { bucket: 'Rewards', alloc: 0.1, balance: 5000, committed: 0, ...overrides.Rewards },
]

const drawFor = (draws: { bucket: string; amount: number }[], bucket: string) =>
  draws.find(draw => draw.bucket === bucket)!.amount

const transaction = (overrides: Partial<Transaction>): Transaction => ({
  id: 'tx-1',
  date: '2026-06-04',
  description: 'Movement',
  category: 'Other',
  ledgerCategory: 'Stability',
  amount: 0,
  ...overrides,
})

describe('isRecoveryActive', () => {
  it('is false when there is nothing to put back', () => {
    expect(isRecoveryActive(undefined)).toBe(false)
    expect(isRecoveryActive(recovery({ isActive: false }))).toBe(false)
    expect(isRecoveryActive(recovery({ outstandingShortfall: 0 }))).toBe(false)
  })

  it('is true for a fund below the point it once reached', () => {
    expect(isRecoveryActive(recovery())).toBe(true)
  })
})

describe('proposeTopUp', () => {
  it('keeps the full reload offer when the normal share stays below the target', () => {
    const offer = proposeTopUp(
      recovery({ outstandingShortfall: 100, outstandingThisCycle: 100 }), 1000, buckets(), 0.15
    )!

    expect(offer.maxTopUp).toBe(100)
    expect(offer.proposedTopUp).toBe(100)
  })

  it('does not let the normal share reduce the explicit reload obligation', () => {
    const offer = proposeTopUp(
      recovery({ outstandingShortfall: 200, outstandingThisCycle: 200 }), 1000, buckets(), 0.15
    )!

    expect(offer.maxTopUp).toBe(200)
    expect(offer.proposedTopUp).toBe(200)
  })

  it('splits the draw across the three buckets in proportion', () => {
    const offer = proposeTopUp(
      recovery({ outstandingShortfall: 3000, outstandingThisCycle: 170 }), 1000, buckets()
    )!

    expect(offer.proposedTopUp).toBe(170)
    expect(offer.isReduced).toBe(false)
    expect(drawFor(offer.draws, 'Essentials')).toBe(100)
    expect(drawFor(offer.draws, 'Growth')).toBe(50)
    expect(drawFor(offer.draws, 'Rewards')).toBe(20)
  })

  it('offers the whole small reload when the normal share does not reach the target', () => {
    const offer = proposeTopUp(
      recovery({ outstandingShortfall: 70, outstandingThisCycle: 23.34 }), 1000, buckets(), 0.15
    )!

    expect(offer.proposedTopUp).toBe(70)
  })

  it('hides the offer when the normal share actually reaches the target', () => {
    expect(proposeTopUp(
      recovery({ currentBalance: 9900, outstandingShortfall: 100, outstandingThisCycle: 100 }),
      1000,
      buckets(),
      0.15,
    )).toBeNull()
  })

  // The spread exists for real raids, so a big one must not default to being cleared at once just
  // because no bills happen to be recorded this cycle.
  it('keeps the paced default on a big raid but lets the user raise it', () => {
    const offer = proposeTopUp(
      recovery({ outstandingShortfall: 3000, outstandingThisCycle: 1000 }), 10000, buckets(), 0.15
    )!

    expect(offer.proposedTopUp).toBe(1000)
    expect(offer.maxTopUp).toBe(1500)
  })

  it('never lets the ceiling exceed what the three buckets receive', () => {
    const offer = proposeTopUp(
      recovery({ outstandingShortfall: 3000, outstandingThisCycle: 1000 }), 100, buckets()
    )!

    expect(offer.maxTopUp).toBe(85)
  })

  it('reports a safe cap below the ceiling when money is already committed', () => {
    const offer = proposeTopUp(
      recovery({ outstandingShortfall: 3000, outstandingThisCycle: 1000 }),
      1000,
      buckets({ Essentials: { balance: 200, committed: 600 } })
    )!

    expect(offer.safeCap).toBe(170)
    expect(offer.maxTopUp).toBe(850)
    expect(offer.limitedBy).toBe('Essentials')
  })

  it('never draws more than the three buckets actually receive', () => {
    // 100 of income only sends 85 their way, however much the pace wants.
    const offer = proposeTopUp(recovery({ outstandingThisCycle: 1000 }), 100, buckets())!

    expect(offer.proposedTopUp).toBe(85)
  })

  it('holds the draw back so Essentials still covers its bills', () => {
    const offer = proposeTopUp(
      recovery({ outstandingThisCycle: 500 }),
      1000,
      buckets({ Essentials: { balance: 200, committed: 600 } })
    )!

    // 100 spare in Essentials at a 10/17 weight caps the whole draw at 170.
    expect(offer.proposedTopUp).toBe(170)
    expect(offer.isReduced).toBe(true)
    expect(offer.limitedBy).toBe('Essentials')
  })

  it('holds the draw back so savings goals still get their cycle', () => {
    const offer = proposeTopUp(
      recovery({ outstandingThisCycle: 500 }),
      1000,
      buckets({ Rewards: { balance: 0, committed: 90 } })
    )!

    expect(offer.proposedTopUp).toBe(85)
    expect(offer.limitedBy).toBe('Rewards')
  })

  it('offers nothing when every penny is already promised', () => {
    const offer = proposeTopUp(
      recovery({ outstandingThisCycle: 500 }),
      1000,
      buckets({ Essentials: { balance: 0, committed: 500 } })
    )!

    expect(offer.proposedTopUp).toBe(0)
    expect(offer.isReduced).toBe(true)
    expect(offer.draws).toEqual([])
  })

  it('rounds the offer down so a cap is never exceeded', () => {
    const offer = proposeTopUp(
      recovery({ outstandingThisCycle: 500 }),
      1000,
      buckets({ Essentials: { balance: 0, committed: 499.995 } })
    )!

    expect(offer.proposedTopUp).toBe(0)
  })

  it('ignores a bucket set to zero percent without dividing by zero', () => {
    const offer = proposeTopUp(recovery({ outstandingThisCycle: 200 }), 1000, [
      { bucket: 'Essentials', alloc: 0.6, balance: 1000, committed: 0 },
      { bucket: 'Growth', alloc: 0, balance: 1000, committed: 0 },
      { bucket: 'Rewards', alloc: 0.25, balance: 1000, committed: 0 },
    ])!

    expect(offer.proposedTopUp).toBe(200)
    expect(offer.draws.some(draw => draw.bucket === 'Growth')).toBe(false)
  })

  it('keeps the draws summing to the offer through rounding', () => {
    const offer = proposeTopUp(recovery({ outstandingThisCycle: 100.03 }), 1000, buckets())!

    const total = offer.draws.reduce((sum, draw) => sum + draw.amount, 0)
    expect(Math.abs(total - offer.proposedTopUp)).toBeLessThan(0.005)
  })

  it('offers nothing when there is no recovery or income', () => {
    expect(proposeTopUp(undefined, 1000, buckets())).toBeNull()
    expect(proposeTopUp(recovery({ isActive: false }), 1000, buckets())).toBeNull()
    expect(proposeTopUp(recovery(), 0, buckets())).toBeNull()
  })

  it('keeps an optional amount available after this cycle\'s pace is covered', () => {
    const offer = proposeTopUp(
      recovery({ outstandingShortfall: 600, outstandingThisCycle: 0, toppedUpThisCycle: 1000 }),
      1000,
      buckets(),
      0.15,
    )!

    expect(offer.proposedTopUp).toBe(0)
    expect(offer.maxTopUp).toBe(600)
    expect(offer.safeCap).toBe(600)
    expect(offer.draws).toEqual([])
  })
})

describe('stability reload projection', () => {
  it('rolls the three-cycle pace at the next cycle boundary', () => {
    const projected = projectStabilityRecovery({
      recovery: recovery({
        lastDrawdownCycleKey: '2026-07',
        markedTotal: 300,
        outstandingShortfall: 300,
        currentBalance: 7000,
        openingOutstanding: 300,
        toppedUpThisCycle: 0,
      }),
      baseTransactions: [],
      projectedTransactions: [],
      stabilityAlloc: 0.15,
      projectedBalance: 7000,
      currentCycleKey: '2026-08',
    })

    expect(projected.cyclesRemaining).toBe(2)
    expect(projected.requiredThisCycle).toBe(150)
    expect(projected.outstandingThisCycle).toBe(150)
  })

  it('uses the authoritative opening queue when deleting an inflow that preceded the drawdown', () => {
    const transfer = transaction({
      id: 'transfer', date: '2026-06-01', amount: 900,
      ledgerCategory: 'Transfer:Growth->Stability',
    })
    const drawdown = transaction({
      id: 'drawdown', date: '2026-06-02', amount: -300,
      ledgerCategory: 'Stability', stabilityReloadIntent: 'Required',
    })
    const projected = projectStabilityRecovery({
      recovery: recovery({
        currentBalance: 600,
        outstandingShortfall: 300,
        openingOutstanding: 0,
      }),
      baseTransactions: [transfer, drawdown],
      projectedTransactions: [drawdown],
      stabilityAlloc: 0.15,
      projectedBalance: -300,
    })

    expect(projected.outstandingShortfall).toBe(300)
  })

  it('clears an inherited obligation when a lowered target already contains the fund', () => {
    const projected = projectStabilityRecovery({
      recovery: recovery({
        target: 5000,
        currentBalance: 9500,
        outstandingShortfall: 500,
        recoveryFromDate: '2026-06-01',
      }),
      baseTransactions: [],
      projectedTransactions: [],
      stabilityAlloc: 0.15,
      projectedBalance: 9500,
    })

    expect(projected.outstandingShortfall).toBe(0)
    expect(projected.isActive).toBe(false)
  })

  it('clamps an earlier repayment before applying a later marked drawdown', () => {
    const transfer = transaction({
      id: 'transfer',
      date: '2026-06-01',
      amount: 900,
      ledgerCategory: 'Transfer:Growth->Stability',
    })
    const drawdown = transaction({
      id: 'drawdown',
      date: '2026-06-02',
      amount: -300,
      ledgerCategory: 'Stability',
      stabilityReloadIntent: 'Required',
    })
    const projected = projectStabilityRecovery({
      recovery: recovery({
        isActive: false,
        markedTotal: 0,
        currentBalance: 900,
        outstandingShortfall: 0,
        toppedUpThisCycle: 0,
      }),
      baseTransactions: [transfer],
      projectedTransactions: [transfer, drawdown],
      stabilityAlloc: 0.15,
      projectedBalance: 600,
    })

    expect(projected.outstandingShortfall).toBe(300)
    expect(projected.markedTotal).toBe(300)
    expect(projected.isActive).toBe(true)
  })

  it('does not add a settled carried drawdown to what is still asked back', () => {
    // The reported defect: 500 out and 400 back last cycle, then 300 out and 100 back this cycle.
    // The 100 settles the carried 500 outright, so only the 300 is still asked about.
    const drawdown = transaction({
      id: 'current-drawdown', date: '2026-07-04', amount: -300,
      ledgerCategory: 'Stability', stabilityReloadIntent: 'Required',
    })
    const repayment = transaction({
      id: 'current-repayment', date: '2026-07-20', amount: 100,
      ledgerCategory: 'Transfer:Growth->Stability',
    })
    const projected = projectStabilityRecovery({
      recovery: recovery({
        markedTotal: 500,
        repaidTotal: 400,
        outstandingShortfall: 100,
        currentBalance: 1900,
        target: 10000,
        toppedUpThisCycle: 0,
        openingOutstanding: 100,
        openingOldestDate: '2026-06-04',
        openingObligations: [{
          transactionId: 'old-drawdown',
          originalAmount: 500,
          remainingAmount: 100,
          date: '2026-06-04',
        }],
        lastDrawdownCycleKey: '2026-06',
      }),
      baseTransactions: [],
      projectedTransactions: [drawdown, repayment],
      stabilityAlloc: 0.15,
      projectedBalance: 1700,
      currentCycleKey: '2026-07',
      cycleDay: 1,
    })

    expect(projected.outstandingShortfall).toBe(300)
    expect(projected.markedTotal).toBe(300)
    expect(projected.repaidTotal).toBe(0)
    // The anchor moves off the settled June drawdown, so the window is not reported overdue.
    expect(projected.lastDrawdownCycleKey).toBe('2026-07')
    expect(projected.recoveryFromDate).toBe('2026-07-04')
  })

  it('keeps a carried drawdown only partly put back at its full original amount', () => {
    const repayment = transaction({
      id: 'current-repayment', date: '2026-07-20', amount: 200,
      ledgerCategory: 'Transfer:Growth->Stability',
    })
    const projected = projectStabilityRecovery({
      recovery: recovery({
        markedTotal: 500,
        repaidTotal: 0,
        outstandingShortfall: 500,
        currentBalance: 500,
        target: 10000,
        toppedUpThisCycle: 0,
        openingOutstanding: 500,
        openingOldestDate: '2026-06-04',
        openingObligations: [{
          transactionId: 'old-drawdown',
          originalAmount: 500,
          remainingAmount: 500,
          date: '2026-06-04',
        }],
        lastDrawdownCycleKey: '2026-06',
      }),
      baseTransactions: [],
      projectedTransactions: [repayment],
      stabilityAlloc: 0.15,
      projectedBalance: 700,
      currentCycleKey: '2026-07',
      cycleDay: 1,
    })

    expect(projected.markedTotal).toBe(500)
    expect(projected.repaidTotal).toBe(200)
    expect(projected.outstandingShortfall).toBe(300)
    expect(projected.lastDrawdownCycleKey).toBe('2026-06')
    expect(projected.recoveryFromDate).toBe('2026-06-04')
  })

  it('does not compound the reported total when a queued drawdown lands on a settled one', () => {
    // The optimistic path used to add this cycle's delta onto the server's figure, so a new drawdown
    // grew the ask by its own amount on top of a total that already counted settled drawdowns.
    const settled = transaction({
      id: 'settled', date: '2026-07-01', amount: -400,
      ledgerCategory: 'Stability', stabilityReloadIntent: 'Required',
    })
    const back = transaction({
      id: 'back', date: '2026-07-02', amount: 400,
      ledgerCategory: 'Transfer:Growth->Stability',
    })
    const queued = transaction({
      id: 'queued', date: '2026-07-10', amount: -250,
      ledgerCategory: 'Stability', stabilityReloadIntent: 'Required',
    })
    const base = recovery({
      markedTotal: 0, repaidTotal: 0, outstandingShortfall: 0, isActive: false,
      currentBalance: 2000, target: 10000, toppedUpThisCycle: 400, openingOutstanding: 0,
    })
    const projected = projectStabilityRecovery({
      recovery: base,
      baseTransactions: [settled, back],
      projectedTransactions: [settled, back, queued],
      stabilityAlloc: 0.15,
      projectedBalance: 1750,
      currentCycleKey: '2026-07',
      cycleDay: 1,
    })

    expect(projected.markedTotal).toBe(250)
    expect(projected.repaidTotal).toBe(0)
    expect(projected.outstandingShortfall).toBe(250)
    // Invariant: what is asked back less what has gone back is exactly what is owed.
    expect(projected.markedTotal - projected.repaidTotal).toBe(projected.outstandingShortfall)
  })

  it('preserves same-day FIFO order across the carried obligation payload', () => {
    const projected = projectStabilityRecovery({
      recovery: recovery({
        markedTotal: 180,
        repaidTotal: 0,
        outstandingShortfall: 180,
        openingOutstanding: 180,
        openingOldestDate: '2026-06-01',
        openingObligations: [
          { transactionId: 'z-first', originalAmount: 100, remainingAmount: 100, date: '2026-06-01' },
          { transactionId: 'a-second', originalAmount: 80, remainingAmount: 80, date: '2026-06-01' },
        ],
        target: 0,
        currentBalance: 0,
        toppedUpThisCycle: 0,
      }),
      baseTransactions: [],
      projectedTransactions: [transaction({
        id: 'repayment', date: '2026-07-05', amount: 120,
        ledgerCategory: 'Transfer:Growth->Stability',
      })],
      stabilityAlloc: 0.15,
      projectedBalance: 120,
      currentCycleKey: '2026-07',
      cycleDay: 1,
    })

    expect(projected.outstandingShortfall).toBe(60)
    expect(projected.markedTotal).toBe(80)
    expect(projected.repaidTotal).toBe(20)
  })

  it('falls back to the authoritative opening total when obligation detail is stale', () => {
    const projected = projectStabilityRecovery({
      recovery: recovery({
        markedTotal: 180,
        repaidTotal: 0,
        outstandingShortfall: 180,
        openingOutstanding: 180,
        openingOldestDate: '2026-06-01',
        openingObligations: [
          { transactionId: 'stale', originalAmount: 500, remainingAmount: 300, date: '2026-06-01' },
        ],
        target: 0,
        currentBalance: 0,
        toppedUpThisCycle: 0,
      }),
      baseTransactions: [],
      projectedTransactions: [transaction({
        id: 'repayment', date: '2026-07-05', amount: 50,
        ledgerCategory: 'Transfer:Growth->Stability',
      })],
      stabilityAlloc: 0.15,
      projectedBalance: 50,
      currentCycleKey: '2026-07',
      cycleDay: 1,
    })

    expect(projected.outstandingShortfall).toBe(130)
    expect(projected.markedTotal).toBe(130)
    expect(projected.repaidTotal).toBe(0)
  })

  it('resets the per-cycle repayment count when attainment is followed by a drawdown', () => {
    const result = replayStabilityReload(
      { outstanding: 0 },
      9000,
      10000,
      [
        { date: '2026-07-01', change: -500, repayment: 0, marked: true },
        { date: '2026-07-02', change: 1500, repayment: 500, marked: false },
        { date: '2026-07-03', change: -200, repayment: 0, marked: true },
      ],
    )

    expect(result.outstanding).toBe(200)
    expect(result.repaidThisRun).toBe(0)
  })

  // Mirrors StabilityReloadLedgerTests.Replay_DischargesACarriedObligationThatHasNoCarriedDate.
  // The queue used to be seeded only when a carried date came with the carried amount, so the
  // amount lived on in a separate running total that repayments debited while the queue had
  // nothing to discharge. Both replays must agree or the optimistic projection drifts from the
  // server the moment anything is queued.
  it('discharges a carried obligation that arrived without a date', () => {
    const movements = [
      { date: '2026-07-28', change: 148, repayment: 148, marked: false },
      { date: '2026-07-28', change: 900, repayment: 900, marked: false },
      { date: '2026-08-06', change: -70, repayment: 0, marked: true },
      { date: '2026-08-09', change: -125, repayment: 0, marked: true },
      { date: '2026-08-09', change: -676.77, repayment: 0, marked: true },
      { date: '2026-08-09', change: 520, repayment: 520, marked: false },
    ]

    const carried = replayStabilityReload({ outstanding: 1600.52 }, 5000, 10000, movements)
    expect(carried.outstanding).toBeCloseTo(904.29, 2)
    expect(carried.repaidThisRun).toBe(1568)
    expect(carried.oldestOutstandingDate).toBeUndefined()

    const fresh = replayStabilityReload({ outstanding: 0 }, 5000, 10000, movements)
    expect(fresh.outstanding).toBeCloseTo(351.77, 2)
    expect(fresh.repaidThisRun).toBe(520)
  })

  it('treats an unanswered drawdown as required and a spent-for-good row as unmarked', () => {
    const rows = [
      transaction({ id: 'required', amount: -500, stabilityReloadIntent: 'Unanswered' }),
      transaction({ id: 'spent', amount: -200, stabilityReloadIntent: 'NotRequired' }),
    ]
    expect(summarize(rows, 0.15)).toEqual({ markedAmount: 500, repaidAmount: 0 })
  })

  it('does not count ordinary salary allocation as putting a marked amount back', () => {
    const salary = transaction({
      id: 'salary',
      amount: 4000,
      ledgerCategory: 'Income',
    })
    const child = transaction({
      id: 'salary-split-Stability',
      amount: 600,
      ledgerCategory: 'Transfer:Income->Stability',
    })
    expect(summarize([salary, child], 0.15).repaidAmount).toBe(0)
  })

  it('counts explicit extra salary money, transfers in, and positive adjustments as repayment', () => {
    const salary = transaction({ id: 'salary', amount: 4000, ledgerCategory: 'Income' })
    const child = transaction({ id: 'salary-split-Stability', amount: 1100, ledgerCategory: 'Transfer:Income->Stability' })
    const transfer = transaction({ id: 'transfer', amount: 100, ledgerCategory: 'Transfer:Growth->Stability' })
    const adjustment = transaction({ id: 'adjustment', amount: 50, ledgerCategory: 'Stability' })
    expect(summarize([salary, child, transfer, adjustment], 0.15).repaidAmount).toBe(650)
  })

  it('does not treat account balance corrections as put-back money', () => {
    const correction = transaction({
      id: 'balance-correction', amount: 50, isAccountBalanceAdjustment: true,
    })
    expect(summarize([correction], 0.15)).toEqual({ markedAmount: 0, repaidAmount: 0 })
  })

  it('uses a saved salary reimbursement when the plan allocation later changes', () => {
    const salary = transaction({
      id: 'salary', amount: 4000, ledgerCategory: 'Income', stabilityRecoveryTopUpAmount: 30,
    })
    const child = transaction({ id: 'salary-split-Stability', amount: 600, ledgerCategory: 'Transfer:Income->Stability' })

    expect(summarize([salary, child], 0.10).repaidAmount).toBe(30)
  })

  it('keeps the marked obligation after ordinary salary reaches an old high point below target', () => {
    const currentRecovery = recovery({ markedTotal: 500, currentBalance: 5500, outstandingShortfall: 500 })
    const salary = transaction({ id: 'salary', amount: 5333.33, ledgerCategory: 'Income' })
    const child = transaction({ id: 'salary-split-Stability', amount: 600, ledgerCategory: 'Transfer:Income->Stability' })
    const projected = projectStabilityRecovery({
      recovery: currentRecovery,
      baseTransactions: [],
      projectedTransactions: [salary, child],
      stabilityAlloc: 0.15,
      projectedBalance: 6100,
    })
    expect(projected.outstandingShortfall).toBe(500)
    expect(projected.repaidTotal).toBe(0)
  })

  it('clears the marked obligation when the target is reached', () => {
    const currentRecovery = recovery({ markedTotal: 500, currentBalance: 9500, outstandingShortfall: 500 })
    const salary = transaction({ id: 'salary', amount: 2000, ledgerCategory: 'Income' })
    const child = transaction({ id: 'salary-split-Stability', amount: 500, ledgerCategory: 'Transfer:Income->Stability' })
    const projected = projectStabilityRecovery({
      recovery: currentRecovery,
      baseTransactions: [],
      projectedTransactions: [salary, child],
      stabilityAlloc: 0.25,
      projectedBalance: 10000,
    })
    expect(projected.outstandingShortfall).toBe(0)
    expect(projected.isActive).toBe(false)
  })

  it('derives outstanding, partial, complete, and spent-for-good row labels', () => {
    const rows = [
      transaction({ id: 'first', amount: -100, stabilityReloadIntent: 'Required' }),
      transaction({ id: 'second', amount: -80, stabilityReloadIntent: 'Required', date: '2026-06-05' }),
      transaction({ id: 'spent', amount: -20, stabilityReloadIntent: 'NotRequired', date: '2026-06-06' }),
      transaction({ id: 'pay', amount: 50, ledgerCategory: 'Transfer:Growth->Stability', date: '2026-06-07' }),
    ]
    const projected = projectStabilityReloadStatuses({
      recovery: recovery({
        currentBalance: 0,
        openingOutstanding: 0,
        outstandingShortfall: 180,
      }),
      baseTransactions: [],
      projectedTransactions: rows,
      stabilityAlloc: 0.15,
      projectedBalance: -150,
    })

    expect(projected.find(row => row.id === 'first')?.stabilityReloadStatus).toBe('PartlyRepaid')
    expect(projected.find(row => row.id === 'second')?.stabilityReloadStatus).toBe('Outstanding')
    expect(projected.find(row => row.id === 'spent')?.stabilityReloadStatus).toBe('NotRequired')
    expect(stabilityReloadStatusLabel('Complete', 'Required')).toBe('Put back complete')
    expect(stabilityReloadStatusLabel('PartlyRepaid', 'Required')).toBe('Partly put back')
    expect(stabilityReloadStatusLabel('Outstanding', 'Unanswered')).toBe('Put back')
    expect(stabilityReloadStatusLabel('NotRequired', 'NotRequired')).toBe('Spent for good')
  })

  it('does not resurrect a completed row when a pending target increase is replayed', () => {
    const points = buildStabilityPlanPoints(1000, 0.15, [{
      createdAt: Date.parse('2026-06-04T12:00:00.000Z'),
      payload: { targetStabilityFund: 2000 },
    }])
    const row = transaction({
      id: 'old-drawdown',
      date: '2026-06-01',
      postedAt: '2026-06-01T08:00:00.000Z',
      amount: -100,
      stabilityReloadIntent: 'Required',
    })
    const complete = projectStabilityReloadStatuses({
      recovery: recovery({ target: 1000, currentBalance: 900, outstandingShortfall: 100, openingOutstanding: 0 }),
      baseTransactions: [],
      projectedTransactions: [row, transaction({
        id: 'refill',
        date: '2026-06-02',
        postedAt: '2026-06-02T08:00:00.000Z',
        amount: 200,
        ledgerCategory: 'Transfer:Growth->Stability',
      })],
      stabilityAlloc: 0.15,
      projectedBalance: 1000,
      planPoints: points,
    })
    expect(complete.find(item => item.id === 'old-drawdown')?.stabilityReloadStatus).toBe('Complete')
  })

  it('retains carried obligation date as oldest outstanding date', () => {
    const result = replayStabilityReload(
      {
        outstanding: 300,
        oldestOutstandingDate: '2026-06-15',
        obligations: [{ transactionId: 'tx-carried', originalAmount: 300, remainingAmount: 300, date: '2026-06-15' }],
      },
      1000,
      2000,
      [],
    )
    expect(result.outstanding).toBe(300)
    expect(result.oldestOutstandingDate).toBe('2026-06-15')
    expect(result.obligations[0].date).toBe('2026-06-15')
  })

  it('does not skip plan revisions for backdated movements', () => {
    const planPoints = [
      { effectiveAt: '2026-07-01T00:00:00.000Z', target: 10000 },
      { effectiveAt: '2026-07-10T00:00:00.000Z', target: 5000 },
    ]
    const movements = [
      { date: '2026-07-02', postedAt: '2026-07-12T00:00:00.000Z', change: -500, repayment: 0, marked: true, id: 'backdated' },
      { date: '2026-07-06', postedAt: '2026-07-05T00:00:00.000Z', change: 1500, repayment: 0, marked: false, id: 'deposit' },
    ]
    const result = replayStabilityReload(
      { outstanding: 0 },
      4000,
      10000,
      movements,
      planPoints,
    )
    expect(result.outstanding).toBe(0)
  })
})
