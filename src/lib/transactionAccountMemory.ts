import type { AutocompleteSuggestion, LedgerAccount, Transaction } from '../types'
import { compareTransactionsNewestFirst } from './transactionOrdering'

const normalize = (value: string) => value.trim().toLocaleLowerCase()

/**
 * The account most recently used for this description in this bucket, when it is still open there.
 * Only an explicit autocomplete pick consults it: a bucket alone never guesses an account, so a
 * multi-account bucket still asks the user rather than saving a default unread.
 */
export function rememberedAccountForDescription(
  transactions: readonly Transaction[],
  accounts: readonly LedgerAccount[],
  suggestion: AutocompleteSuggestion,
): string | null {
  const wanted = normalize(suggestion.description)
  if (!wanted) return null
  // The API supplies the source across cycles. A loaded local copy can replace it, including
  // when a queued edit or delete means the original source no longer matches this suggestion.
  const source = suggestion.source
  let latest = source && !transactions.some(transaction => transaction.id === source.id) ? source : undefined
  for (const transaction of transactions) {
    if (transaction.ledgerCategory !== suggestion.ledgerCategory) continue
    if ((transaction.amount < 0 ? 'outflow' : 'inflow') !== suggestion.txType) continue
    if (transaction.isPendingDelete || transaction.excludeFromAutocomplete || transaction.isAccountBalanceAdjustment) continue
    if (normalize(transaction.description) !== wanted) continue
    if (!latest || compareTransactionsNewestFirst(transaction, latest) < 0) latest = transaction
  }
  const account = accounts.find(candidate => candidate.id === latest?.accountId)
  return account && account.bucket === suggestion.ledgerCategory && !account.isArchived ? account.id : null
}
