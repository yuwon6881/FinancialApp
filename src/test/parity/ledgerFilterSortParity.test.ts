import { describe, expect, it } from 'vitest'
import { matchesTransactionFilters, type TransactionFilterCriteria } from '../../lib/transactionFilters'
import { compareTransactions, type TransactionSort } from '../../lib/transactionOrdering'
import type { Transaction } from '../../types'
import { readFixture } from './runParity'

interface LedgerFilterSortCase {
  id: string
  why: string
  input: {
    rows: Transaction[]
    criteria: TransactionFilterCriteria
    sort?: TransactionSort
  }
  expected: {
    matchingIds: string[]
    orderedIds?: string[]
  }
}

describe('ledger filter and sort parity', () => {
  const cases = readFixture<LedgerFilterSortCase>('ledger-filter-sort')

  for (const { id, why, input, expected } of cases) {
    it(`[${id}] ${why}`, () => {
      const matching = input.rows.filter(row => matchesTransactionFilters(row, input.criteria))
      expect(matching.map(row => String(row.id))).toEqual(expected.matchingIds)

      if (expected.orderedIds) {
        const sort = input.sort ?? 'date-desc'
        const ordered = [...matching].sort((left, right) => compareTransactions(left, right, sort))
        expect(ordered.map(row => String(row.id))).toEqual(expected.orderedIds)
      }
    })
  }
})
