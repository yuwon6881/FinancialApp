import { describe, expect, it } from 'vitest'
import { buildIncomeSplitRows, type IncomeAllocations } from '../../lib/incomeSplitProjection'
import type { Transaction } from '../../types'
import { readFixture } from './runParity'

interface IncomeSplitProjectionCase {
  id: string
  why: string
  input: {
    transaction: Pick<
      Transaction,
      'id' | 'date' | 'postedAt' | 'description' | 'ledgerCategory' | 'amount' | 'stabilityRecoveryTopUpAmount' | 'splitAccountIds'
    >
    allocations: IncomeAllocations
  }
  expected: Array<{
    id: string
    description: string
    category: string
    ledgerCategory: string
    amount: number
    accountId: string
  }>
}

describe('income split projection parity', () => {
  const cases = readFixture<IncomeSplitProjectionCase>('income-split-projection')

  for (const { id, why, input, expected } of cases) {
    it(`[${id}] ${why}`, () => {
      const actual = buildIncomeSplitRows(input.transaction, input.allocations)
      expect(actual.length).toBe(expected.length)
      for (let i = 0; i < expected.length; i++) {
        expect(actual[i].id).toBe(expected[i].id)
        expect(actual[i].description).toBe(expected[i].description)
        expect(actual[i].category).toBe(expected[i].category)
        expect(actual[i].ledgerCategory).toBe(expected[i].ledgerCategory)
        expect(actual[i].amount).toBeCloseTo(expected[i].amount, 2)
        expect(actual[i].accountId).toBe(expected[i].accountId)
      }
    })
  }
})
