import { describe, expect, it } from 'vitest'
import { accountAmount } from '../../lib/accountAttribution'
import type { LedgerAccount, Transaction } from '../../types'
import { readFixture } from './runParity'

interface AccountAttributionCase {
  id: string
  why: string
  input: {
    transaction: {
      amount: number
      ledgerCategory: string
      accountId: string | null
      counterAccountId: string | null
    }
    account: {
      id: string
      bucket: LedgerAccount['bucket']
    }
    accounts: Array<{
      id: string
      bucket: LedgerAccount['bucket']
    }>
  }
  expected: number
}

describe('account attribution parity', () => {
  const cases = readFixture<AccountAttributionCase>('account-attribution')

  for (const { id, why, input, expected } of cases) {
    it(`[${id}] ${why}`, () => {
      const accountsById = new Map(input.accounts.map(a => [a.id, a]))
      const actual = accountAmount(
        input.transaction as Pick<Transaction, 'amount' | 'ledgerCategory' | 'accountId' | 'counterAccountId'>,
        input.account,
        accountsById,
      )
      expect(actual).toBeCloseTo(expected, 4)
    })
  }
})
