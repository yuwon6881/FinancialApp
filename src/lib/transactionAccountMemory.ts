import type { LedgerAccount, Transaction } from '../types'

type Bucket = LedgerAccount['bucket']

const normalize = (value: string) => value.trim().toLocaleLowerCase()

/**
 * The account most recently used for this description in this bucket, when it is still open there.
 * Only an explicit autocomplete pick consults it: a bucket alone never guesses an account, so a
 * multi-account bucket still asks the user rather than saving a default unread.
 */
export function rememberedAccountForDescription(
  transactions: readonly Transaction[],
  accounts: readonly LedgerAccount[],
  description: string,
  bucket: Bucket,
): string | null {
  const wanted = normalize(description)
  if (!wanted) return null
  let latest: Transaction | null = null
  for (const transaction of transactions) {
    if (transaction.ledgerCategory !== bucket || !transaction.accountId) continue
    if (transaction.isPendingDelete || transaction.excludeFromAutocomplete || transaction.isAccountBalanceAdjustment) continue
    if (normalize(transaction.description) !== wanted) continue
    if (!latest || compareRecency(transaction, latest) > 0) latest = transaction
  }
  if (!latest) return null
  const account = accounts.find(candidate => candidate.id === latest.accountId)
  return account && account.bucket === bucket && !account.isArchived ? account.id : null
}

function compareRecency(a: Transaction, b: Transaction): number {
  if (a.date !== b.date) return a.date > b.date ? 1 : -1
  const aPosted = a.postedAt ?? ''
  const bPosted = b.postedAt ?? ''
  return aPosted === bPosted ? 0 : aPosted > bPosted ? 1 : -1
}
