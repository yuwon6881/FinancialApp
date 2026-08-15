import { describe, expect, it } from 'vitest'
import { computeIncomeLedgerCategory, type IncomeSplitInput } from '../../lib/incomeSplit'
import { readFixture } from './runParity'

interface IncomeSplitCase {
  id: string
  why: string
  input: IncomeSplitInput
  expected: {
    essentials: number
    growth: number
    stability: number
    rewards: number
    specString: string
  }
}

describe('income split parity', () => {
  const cases = readFixture<IncomeSplitCase>('income-split')

  for (const { id, why, input, expected } of cases) {
    it(`[${id}] ${why}`, () => {
      const category = computeIncomeLedgerCategory(input)
      if (input.stabilityTarget === 0 && input.recoveryTopUp === 0) {
        expect(category).toBe('Income')
      } else {
        expect(category).toBe(`IncomeSplit:${expected.specString}`)
      }
    })
  }
})
