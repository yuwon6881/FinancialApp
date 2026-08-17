/**
 * Turns the records supplied by the app into ranked search results.
 *
 * Nothing in this module fetches, and nothing renders. The overlay owns the one lazy loan load
 * needed to make search complete before handing data here; a result carries a `target` describing
 * where it goes, and the overlay maps that onto the existing navigation helpers.
 */

import type {
  LedgerAccount,
  Loan,
  RecurringPayment,
  SavingsGoal,
  Transaction,
  WishlistItem,
} from '../../types'
import { scoreSearchFields, tokenizeQuery, type SearchField } from './searchMatch'

export type SearchResultKind = 'transaction' | 'account' | 'bill' | 'loan' | 'commitment' | 'reward'

/**
 * Where a result goes. Only jumps the app already supports are represented: transactions,
 * accounts and bills each have an existing highlight helper, while loans, commitments and
 * rewards have no per-row deep link and land on their page. Inventing a highlight for those
 * would mean adding ids and scroll targets to three more views for no search-specific reason.
 */
export type SearchTarget =
  | { to: 'transaction'; transactionId: string }
  | { to: 'account'; accountId: string }
  | { to: 'bill'; recurringPaymentId: string }
  | { to: 'loans' }
  | { to: 'commitments' }
  | { to: 'rewards' }

export interface SearchResult {
  /** Unique across kinds, so the overlay can key rows without colliding ids from two stores. */
  id: string
  kind: SearchResultKind
  title: string
  subtitle: string
  /** Absent when the record has no single meaningful figure. Masked by the overlay, not here. */
  amount?: number
  /** Extra right-hand context (a date, a due day, a bucket) that is never an amount. */
  meta?: string
  target: SearchTarget
  score: number
}

export interface SearchOptions {
  /**
   * Whether a query may match against amounts. False while sensitive mode hides them: a hit on
   * "12.50" would confirm that a 12.50 row exists, which is the value the mask is withholding.
   */
  includeAmounts: boolean
}

export interface SearchSourceData {
  transactions?: readonly Transaction[]
  accounts?: readonly LedgerAccount[]
  recurringPayments?: readonly RecurringPayment[]
  loans?: readonly Loan[]
  savingsGoals?: readonly SavingsGoal[]
  wishlist?: readonly WishlistItem[]
}

/** Per-kind cap. A query like "a" matches nearly everything; the list stays scannable. */
export const RESULTS_PER_KIND = 6

const field = (kind: SearchField['kind'], value: string | null | undefined): SearchField[] =>
  value ? [{ kind, value }] : []

/**
 * Amounts are matched on the bare magnitude, so "12.50" finds a -12.50 outflow.
 *
 * Only the two-decimal form is contributed: it already prefix-matches a whole-number query
 * ("3200" hits "3200.00"), while adding a rounded field made "13" match a 12.50 row.
 */
const amountFields = (amount: number | null | undefined): SearchField[] => {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return []
  return [{ kind: 'amount', value: Math.abs(amount).toFixed(2) }]
}

/**
 * A discarded or generated row is structural rather than something the user filed, so it is not
 * a search destination. This mirrors the spirit of `ExcludeFromAutocomplete` without reaching
 * for the server flag, which cached rows may predate.
 */
const isSearchableTransaction = (transaction: Transaction): boolean => {
  if (transaction.isPendingDelete) return false
  if (!transaction.description?.trim()) return false
  return true
}

const bucketOf = (ledgerCategory: string | null | undefined): string => {
  if (!ledgerCategory) return ''
  const [bucket] = ledgerCategory.split(':')
  return bucket ?? ''
}

const rank = (results: SearchResult[]): SearchResult[] =>
  results
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
    .slice(0, RESULTS_PER_KIND)

const collect = <T,>(
  items: readonly T[] | undefined,
  tokens: readonly string[],
  build: (item: T) => { fields: SearchField[]; result: Omit<SearchResult, 'score'> } | null,
): SearchResult[] => {
  if (!items?.length || tokens.length === 0) return []
  const matched: SearchResult[] = []
  for (const item of items) {
    const candidate = build(item)
    if (!candidate) continue
    const score = scoreSearchFields(candidate.fields, tokens)
    if (score === null) continue
    matched.push({ ...candidate.result, score })
  }
  return rank(matched)
}

export const buildSearchResults = (
  data: SearchSourceData,
  query: string,
  options: SearchOptions = { includeAmounts: true },
): SearchResult[] => {
  const tokens = tokenizeQuery(query)
  if (tokens.length === 0) return []

  const amounts = options.includeAmounts ? amountFields : () => []

  const transactions = collect(data.transactions, tokens, transaction => {
    if (!isSearchableTransaction(transaction)) return null
    return {
      fields: [
        ...field('title', transaction.description),
        ...field('keyword', transaction.category),
        ...field('keyword', bucketOf(transaction.ledgerCategory)),
        ...amounts(transaction.amount),
      ],
      result: {
        id: `transaction:${transaction.id}`,
        kind: 'transaction' as const,
        title: transaction.description,
        subtitle: transaction.category,
        amount: transaction.amount,
        meta: transaction.date,
        target: { to: 'transaction' as const, transactionId: transaction.id },
      },
    }
  })

  const accounts = collect(data.accounts, tokens, account => ({
    fields: [
      ...field('title', account.name),
      ...field('keyword', account.bucket),
      ...field('keyword', account.kind),
      ...amounts(account.remaining),
    ],
    result: {
      id: `account:${account.id}`,
      kind: 'account' as const,
      title: account.name,
      subtitle: account.isArchived ? `${account.bucket} · Closed` : account.bucket,
      amount: account.remaining,
      target: { to: 'account' as const, accountId: account.id },
    },
  }))

  const bills = collect(data.recurringPayments, tokens, payment => ({
    fields: [
      ...field('title', payment.name),
      ...field('keyword', payment.category),
      ...field('keyword', bucketOf(payment.ledgerCategory)),
      ...amounts(payment.amount),
    ],
    result: {
      id: `bill:${payment.id}`,
      kind: 'bill' as const,
      title: payment.name,
      subtitle: payment.active ? payment.category : `${payment.category} · Paused`,
      amount: payment.amount,
      meta: payment.nextDueDate ?? undefined,
      target: { to: 'bill' as const, recurringPaymentId: payment.id },
    },
  }))

  const loans = collect(data.loans, tokens, loan => ({
    fields: [
      ...field('title', loan.name),
      ...field('keyword', loan.recurringPaymentName),
      ...amounts(loan.openingPrincipal),
    ],
    result: {
      id: `loan:${loan.id}`,
      kind: 'loan' as const,
      title: loan.name,
      subtitle: loan.recurringPaymentName ? `Paid by ${loan.recurringPaymentName}` : 'Loan',
      amount: loan.openingPrincipal,
      target: { to: 'loans' as const },
    },
  }))

  const commitments = collect(data.savingsGoals, tokens, goal => ({
    fields: [
      ...field('title', goal.name),
      ...field('keyword', goal.fundingBucket ?? 'Rewards'),
      ...amounts(goal.targetAmount),
    ],
    result: {
      id: `commitment:${goal.id}`,
      kind: 'commitment' as const,
      title: goal.name,
      subtitle: goal.status === 'completed' ? 'Commitment · Done' : 'Commitment',
      amount: goal.targetAmount,
      meta: goal.targetDate,
      target: { to: 'commitments' as const },
    },
  }))

  const rewards = collect(data.wishlist, tokens, item => ({
    fields: [
      ...field('title', item.name),
      ...field('keyword', item.priority),
      ...amounts(item.price),
    ],
    result: {
      id: `reward:${item.id}`,
      kind: 'reward' as const,
      title: item.name,
      subtitle: item.isPurchased ? 'Reward · Claimed' : 'Reward',
      amount: item.price,
      target: { to: 'rewards' as const },
    },
  }))

  return [...transactions, ...accounts, ...bills, ...loans, ...commitments, ...rewards]
}

/** Display order of the result groups, most-searched-for first. */
export const SEARCH_GROUP_ORDER: readonly SearchResultKind[] = [
  'transaction',
  'account',
  'bill',
  'loan',
  'commitment',
  'reward',
]

/** Plain-language group headings. No jargon: "Bills", not "Recurring payment entities". */
export const SEARCH_GROUP_LABELS: Record<SearchResultKind, string> = {
  transaction: 'Transactions in this cycle',
  account: 'Accounts',
  bill: 'Bills & subscriptions',
  loan: 'Loans',
  commitment: 'Commitments',
  reward: 'Rewards',
}

export interface SearchGroup {
  kind: SearchResultKind
  label: string
  results: SearchResult[]
}

/** Groups ranked results for display while preserving each group's internal ranking. */
export const groupSearchResults = (results: readonly SearchResult[]): SearchGroup[] =>
  SEARCH_GROUP_ORDER
    .map(kind => ({
      kind,
      label: SEARCH_GROUP_LABELS[kind],
      results: results.filter(result => result.kind === kind),
    }))
    .filter(group => group.results.length > 0)
