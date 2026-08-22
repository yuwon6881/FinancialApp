import { describe, expect, it, vi } from 'vitest'
import { openSearchResult, type SearchResultNavigation } from './openSearchResult'
import type { SearchResult, SearchTarget } from './searchSources'

const result = (target: SearchTarget): SearchResult => ({
  id: 'result', kind: 'transaction', title: 'Result', subtitle: 'Result', target, score: 1,
})

describe('openSearchResult', () => {
  it.each([
    [{ to: 'transaction', transactionId: 'tx-1', transactionDate: '2026-08-04' }, 'transaction', ['tx-1', '2026-08-04']],
    [{ to: 'draft', draftId: 'draft-1' }, 'draft', ['draft-1']],
    [{ to: 'account', accountId: 'acc-1' }, 'account', ['acc-1']],
    [{ to: 'bill', recurringPaymentId: 'bill-1' }, 'bill', ['bill-1']],
    [{ to: 'loan', loanId: 'loan-1' }, 'loan', ['loan-1']],
    [{ to: 'commitment', savingsGoalId: 'goal-1' }, 'commitment', ['goal-1']],
    [{ to: 'reward', wishlistItemId: 'reward-1' }, 'reward', ['reward-1']],
  ] as const)('routes %s to its exact destination handler', (target, handler, args) => {
    const navigation: SearchResultNavigation = {
      transaction: vi.fn(), draft: vi.fn(), account: vi.fn(), bill: vi.fn(), loan: vi.fn(),
      commitment: vi.fn(), reward: vi.fn(),
    }
    openSearchResult(result(target), navigation)
    expect(navigation[handler]).toHaveBeenCalledWith(...args)
  })
})
