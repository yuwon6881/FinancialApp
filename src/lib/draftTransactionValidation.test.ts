import { describe, expect, it } from 'vitest'
import type { Transaction, TransactionCategory } from '../types'
import { getDraftTransactionIssues } from './draftTransactionValidation'

const categories: TransactionCategory[] = [{ id: 'food', name: 'Food', type: 'outflow' }]
const draft: Transaction = {
  id: 'draft-1',
  date: '2026-08-13',
  description: 'Lunch',
  category: 'Food',
  ledgerCategory: 'Essentials',
  amount: -12,
  accountId: null,
}

describe('getDraftTransactionIssues', () => {
  it('requires account placement for every bucket transaction', () => {
    expect(getDraftTransactionIssues(draft, categories)).toContain(
      'Choose the account that holds this bucket money.',
    )
    expect(getDraftTransactionIssues({ ...draft, accountId: 'acct-essentials' }, categories)).not.toContain(
      'Choose the account that holds this bucket money.',
    )
  })
})
