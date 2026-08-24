import { describe, expect, it } from 'vitest'
import {
  replayStabilityReload,
  type StabilityReloadMovement,
  type StabilityReloadObligation,
  type StabilityReloadPlanPoint,
} from '../../lib/stabilityRecovery'
import { readFixture } from './runParity'

interface StabilityReloadCase {
  id: string
  why: string
  input: {
    opening: {
      outstanding: number
      oldestOutstandingDate: string | null
      obligations: StabilityReloadObligation[]
    }
    openingBalance: number
    target: number
    /** A case may carry an effective-dated plan timeline instead of one flat target. */
    planPoints?: StabilityReloadPlanPoint[]
    movements: StabilityReloadMovement[]
  }
  expected: {
    outstanding: number
    oldestOutstandingDate: string | null
    markedThisRun: number
    repaidThisRun: number
    openMarkedTotal: number
    openRepaidTotal: number
    obligations: StabilityReloadObligation[]
  }
}

describe('stability reload parity', () => {
  const cases = readFixture<StabilityReloadCase>('stability-reload')

  for (const { id, why, input, expected } of cases) {
    it(`[${id}] ${why}`, () => {
      const actual = replayStabilityReload(
        {
          outstanding: input.opening.outstanding,
          oldestOutstandingDate: input.opening.oldestOutstandingDate ?? undefined,
          obligations: input.opening.obligations,
        },
        input.openingBalance,
        input.target,
        input.movements,
        input.planPoints,
      )

      expect(actual.outstanding).toBeCloseTo(expected.outstanding, 2)
      expect(actual.oldestOutstandingDate ?? null).toBe(expected.oldestOutstandingDate)
      expect(actual.markedThisRun).toBeCloseTo(expected.markedThisRun, 2)
      expect(actual.repaidThisRun).toBeCloseTo(expected.repaidThisRun, 2)
      expect(actual.openMarkedTotal).toBeCloseTo(expected.openMarkedTotal, 2)
      expect(actual.openRepaidTotal).toBeCloseTo(expected.openRepaidTotal, 2)
      // The reported totals must always account for exactly what is owed.
      expect(actual.openMarkedTotal - actual.openRepaidTotal).toBeCloseTo(actual.outstanding, 2)

      expect(actual.obligations.length).toBe(expected.obligations.length)
      for (let i = 0; i < expected.obligations.length; i++) {
        expect(actual.obligations[i].transactionId).toBe(expected.obligations[i].transactionId)
        expect(actual.obligations[i].originalAmount).toBeCloseTo(expected.obligations[i].originalAmount, 2)
        expect(actual.obligations[i].remainingAmount).toBeCloseTo(expected.obligations[i].remainingAmount, 2)
        if (expected.obligations[i].date !== undefined) {
          expect(actual.obligations[i].date).toBe(expected.obligations[i].date)
        }
      }
    })
  }
})
