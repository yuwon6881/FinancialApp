import { describe, expect, it } from 'vitest'
import {
  isRecoveryActive,
  buildStabilityPlanPoints,
  projectStabilityRecovery,
  projectStabilityReloadStatuses,
  replayStabilityReload,
  proposeTopUp,
  summarizeStabilityReload,
  stabilityReloadStatusLabel,
  type RecoveryBucketState,
} from './stabilityRecovery'
import type { StabilityRecovery, Transaction } from '@/types'

// Mirrors StabilityRecoveryPlannerTests.cs case for case, so drift between the two
// implementations shows up as a failing pair rather than a quiet disagreement.

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
    expect(summarizeStabilityReload(rows, 0.15)).toEqual({ markedAmount: 500, repaidAmount: 0 })
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
    expect(summarizeStabilityReload([salary, child], 0.15).repaidAmount).toBe(0)
  })

  it('counts explicit extra salary money, transfers in, and positive adjustments as repayment', () => {
    const salary = transaction({ id: 'salary', amount: 4000, ledgerCategory: 'Income' })
    const child = transaction({ id: 'salary-split-Stability', amount: 1100, ledgerCategory: 'Transfer:Income->Stability' })
    const transfer = transaction({ id: 'transfer', amount: 100, ledgerCategory: 'Transfer:Growth->Stability' })
    const adjustment = transaction({ id: 'adjustment', amount: 50, ledgerCategory: 'Stability' })
    expect(summarizeStabilityReload([salary, child, transfer, adjustment], 0.15).repaidAmount).toBe(650)
  })

  it('uses a saved salary reimbursement when the plan allocation later changes', () => {
    const salary = transaction({
      id: 'salary', amount: 4000, ledgerCategory: 'Income', stabilityRecoveryTopUpAmount: 30,
    })
    const child = transaction({ id: 'salary-split-Stability', amount: 600, ledgerCategory: 'Transfer:Income->Stability' })

    expect(summarizeStabilityReload([salary, child], 0.10).repaidAmount).toBe(30)
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
})
