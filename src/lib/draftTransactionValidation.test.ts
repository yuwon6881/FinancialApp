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

  it('accepts a reviewed IncomeSplit draft and validates it like plain Income', () => {
    const incomeCategories: TransactionCategory[] = [{ id: 'salary', name: 'Salary', type: 'inflow' }]
    const incomeDraft: Transaction = {
      ...draft,
      amount: 3400,
      category: 'Salary',
      ledgerCategory: 'IncomeSplit:50,20,20,10',
      accountId: null,
      splitAccountIds: {
        Essentials: 'acct-essentials',
        Growth: 'acct-growth',
        Stability: 'acct-stability',
        Rewards: 'acct-rewards',
      },
    }

    expect(getDraftTransactionIssues(incomeDraft, incomeCategories)).not.toContain(
      'Choose a valid ledger category.',
    )
    expect(getDraftTransactionIssues(incomeDraft, incomeCategories)).not.toContain(
      'Choose the Essentials receiving account.',
    )
    const { Essentials: _unused, ...missingEssentials } = incomeDraft.splitAccountIds!
    void _unused
    expect(getDraftTransactionIssues({
      ...incomeDraft,
      splitAccountIds: missingEssentials,
    }, incomeCategories)).toContain('Choose the Essentials receiving account.')
  })
})
