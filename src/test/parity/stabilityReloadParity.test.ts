import { describe, expect, it } from 'vitest'
import {
  replayStabilityReload,
  type StabilityReloadMovement,
  type StabilityReloadObligation,
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
    movements: StabilityReloadMovement[]
  }
  expected: {
    outstanding: number
    oldestOutstandingDate: string | null
    markedThisRun: number
    repaidThisRun: number
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
      )

      expect(actual.outstanding).toBeCloseTo(expected.outstanding, 2)
      expect(actual.oldestOutstandingDate ?? null).toBe(expected.oldestOutstandingDate)
      expect(actual.markedThisRun).toBeCloseTo(expected.markedThisRun, 2)
      expect(actual.repaidThisRun).toBeCloseTo(expected.repaidThisRun, 2)

      expect(actual.obligations.length).toBe(expected.obligations.length)
      for (let i = 0; i < expected.obligations.length; i++) {
        expect(actual.obligations[i].transactionId).toBe(expected.obligations[i].transactionId)
        expect(actual.obligations[i].originalAmount).toBeCloseTo(expected.obligations[i].originalAmount, 2)
        expect(actual.obligations[i].remainingAmount).toBeCloseTo(expected.obligations[i].remainingAmount, 2)
      }
    })
  }
})
