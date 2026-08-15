import { describe, expect, it } from 'vitest'
import { buildAccountReconcileTransactions } from '../../lib/accountReconcileTransactionProjection'
import { readFixture } from './runParity'

interface ReconcileCase {
  id: string
  why: string
  input: {
    operationId: string
    createdAt: number
    bucket: string
    expectedBucketTotal: number
    targets: Array<{
      id: string
      name: string
      expectedCurrent: number
      target: number
      isArchived: boolean
    }>
  }
  expected: Array<{
    id: string
    description: string
    category: string
    ledgerCategory: string
    amount: number
    accountId: string | null
    counterAccountId: string | null
    isAccountBalanceAdjustment?: boolean
  }>
}

describe('account reconcile parity', () => {
  const cases = readFixture<ReconcileCase>('account-reconcile')

  for (const { id, why, input, expected } of cases) {
    it(`[${id}] ${why}`, () => {
      const actual = buildAccountReconcileTransactions(input)
      expect(actual.length).toBe(expected.length)
      for (let i = 0; i < expected.length; i++) {
        expect(actual[i].id).toBe(expected[i].id)
        expect(actual[i].description).toBe(expected[i].description)
        expect(actual[i].category).toBe(expected[i].category)
        expect(actual[i].ledgerCategory).toBe(expected[i].ledgerCategory)
        expect(actual[i].amount).toBeCloseTo(expected[i].amount, 2)
        expect(actual[i].accountId).toBe(expected[i].accountId)
        if (expected[i].counterAccountId !== undefined) {
          expect(actual[i].counterAccountId ?? null).toBe(expected[i].counterAccountId)
        }
        if (expected[i].isAccountBalanceAdjustment !== undefined) {
          expect(actual[i].isAccountBalanceAdjustment).toBe(expected[i].isAccountBalanceAdjustment)
        }
      }
    })
  }
})
