import { describe, expect, it } from 'vitest'
import { computeRecoveryCohortPlan, type RecoveryCohortInput } from '../../lib/stabilityRecovery'
import { readFixture } from './runParity'

interface StabilityRecoveryPacingCase {
  id: string
  why: string
  input: {
    currentCycleKey: string
    horizon: number
    outstandingShortfall: number
    toppedUpThisCycle: number
    cohorts: RecoveryCohortInput[]
  }
  expected: {
    cyclesRemaining: number
    requiredThisCycle: number
    outstandingThisCycle: number
    isOverdue: boolean
    isDeferred: boolean
    cohorts: Array<{
      originCycleKey: string
      transactionCount: number
      cyclesRemaining: number
      requiredThisCycle: number
      isOverdue: boolean
      isDeferred: boolean
    }>
  }
}

describe('Stability recovery pacing parity', () => {
  const cases = readFixture<StabilityRecoveryPacingCase>('stability-recovery-pacing')

  for (const { id, why, input, expected } of cases) {
    it(`[${id}] ${why}`, () => {
      const actual = computeRecoveryCohortPlan(input)

      expect(actual.cyclesRemaining).toBe(expected.cyclesRemaining)
      expect(actual.requiredThisCycle).toBeCloseTo(expected.requiredThisCycle, 2)
      expect(actual.outstandingThisCycle).toBeCloseTo(expected.outstandingThisCycle, 2)
      expect(actual.isOverdue).toBe(expected.isOverdue)
      expect(actual.isDeferred).toBe(expected.isDeferred)
      expect(actual.cohorts).toHaveLength(expected.cohorts.length)
      for (let index = 0; index < expected.cohorts.length; index += 1) {
        expect(actual.cohorts[index]).toMatchObject(expected.cohorts[index])
      }
    })
  }
})
