import type { SearchResult } from './searchSources'

export interface SearchResultNavigation {
  transaction: (transactionId: string, transactionDate?: string) => void
  draft: (draftId: string) => void
  account: (accountId: string) => void
  bill: (recurringPaymentId: string) => void
  loan: (loanId: string) => void
  commitment: (savingsGoalId: string) => void
  reward: (wishlistItemId: string) => void
}

export function openSearchResult(result: SearchResult, navigation: SearchResultNavigation) {
  const target = result.target
  switch (target.to) {
    case 'transaction':
      navigation.transaction(target.transactionId, target.transactionDate)
      break
    case 'draft':
      navigation.draft(target.draftId)
      break
    case 'account':
      navigation.account(target.accountId)
      break
    case 'bill':
      navigation.bill(target.recurringPaymentId)
      break
    case 'loan':
      navigation.loan(target.loanId)
      break
    case 'commitment':
      navigation.commitment(target.savingsGoalId)
      break
    case 'reward':
      navigation.reward(target.wishlistItemId)
      break
  }
}
