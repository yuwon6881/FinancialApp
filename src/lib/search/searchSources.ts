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

export type SearchResultKind = 'transaction' | 'draft' | 'account' | 'bill' | 'loan' | 'commitment' | 'reward'

/**
 * Where a result goes. Every kind now lands on its own row rather than its page: commitments,
 * rewards and drafts each gained a highlight id for this, so arriving from search looks the
 * same everywhere -- the shared ring from `useHighlightedElement`. Landing on a page and
 * leaving the user to find the record themselves is what this replaced.
 */
export type SearchTarget =
  | { to: 'transaction'; transactionId: string }
  | { to: 'draft'; draftId: string }
  | { to: 'account'; accountId: string }
  | { to: 'bill'; recurringPaymentId: string }
  | { to: 'loan'; loanId: string }
  | { to: 'commitment'; savingsGoalId: string }
  | { to: 'reward'; wishlistItemId: string }

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
  /**
   * The record exists but its write has not reached the server yet. Rendered through the shared
   * `RowSyncBadge` contract, never a hand-written word: a record created offline is real and
   * must be findable, and saying so is what stops it reading as already filed.
   */
  isPendingSync?: boolean
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
  /** Local-only rows from the Draft Transactions queue; they have never reached the server. */
  draftTransactions?: readonly Transaction[]
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
 * A generated or structural row is not something the user filed, so it is not a search
 * destination: the four `[Split: Essentials] Salary` children beside a salary, balance
 * adjustments, transfer legs and completion rows all carry a server-derived marker saying so.
 * A row carrying neither flag stays searchable — cached rows predate them, and sniffing
 * `[Split:` out of the description would duplicate server logic and drift from it.
 */
const isSearchableTransaction = (transaction: Transaction): boolean => {
  if (transaction.excludeFromAutocomplete) return false
  if (transaction.isAccountBalanceAdjustment) return false
  if (!transaction.description?.trim()) return false
  return true
}

/**
 * One rule for every kind, including transactions: a record queued for deletion is on its way
 * out, and offering a jump to a row that is about to vanish is worse than not offering it. Its
 * sibling state is the opposite — `isPendingSync` keeps the record, and labels it.
 */
const isPendingDelete = (record: { isPendingDelete?: boolean }): boolean => record.isPendingDelete === true

/**
 * Month and year, so the AND-ed tokens in "coffee jan" can actually narrow by when something
 * happened. The full month name is contributed rather than `MONTH_NAMES`' abbreviation because
 * a full name prefix-matches both "jan" and "january", while the abbreviation matches neither
 * of the longer spellings people type.
 */
const MONTH_SEARCH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const

const dateFields = (isoDate: string | null | undefined): SearchField[] => {
  if (!isoDate) return []
  const [year, month] = isoDate.split('-')
  const monthName = MONTH_SEARCH_NAMES[Number(month) - 1]
  return [
    ...(monthName ? [{ kind: 'keyword' as const, value: monthName }] : []),
    ...(year && /^\d{4}$/.test(year) ? [{ kind: 'keyword' as const, value: year }] : []),
  ]
}

const bucketOf = (ledgerCategory: string | null | undefined): string => {
  if (!ledgerCategory) return ''
  const [bucket] = ledgerCategory.split(':')
  return bucket ?? ''
}

/**
 * Ranks but no longer caps. The cap belongs to grouping, which is the only place that can also
 * report what it dropped — slicing here is what made "20 matches" render as a silent "6 found".
 */
const rank = (results: SearchResult[]): SearchResult[] =>
  results.sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))

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
    if (isPendingDelete(transaction) || !isSearchableTransaction(transaction)) return null
    return {
      fields: [
        ...field('title', transaction.description),
        ...field('keyword', transaction.category),
        ...field('keyword', bucketOf(transaction.ledgerCategory)),
        ...dateFields(transaction.date),
        ...amounts(transaction.amount),
      ],
      result: {
        id: `transaction:${transaction.id}`,
        kind: 'transaction' as const,
        title: transaction.description,
        subtitle: transaction.category,
        amount: transaction.amount,
        meta: transaction.date,
        isPendingSync: transaction.isPendingSync,
        target: { to: 'transaction' as const, transactionId: transaction.id },
      },
    }
  })

  // Drafts never reached the server, so they exist only in this browser — exactly the records
  // people lose track of, and the ones a cycle-scoped ledger search cannot surface.
  const drafts = collect(data.draftTransactions, tokens, draft => {
    if (!draft.description?.trim()) return null
    return {
      fields: [
        ...field('title', draft.description),
        ...field('keyword', draft.category),
        ...field('keyword', bucketOf(draft.ledgerCategory)),
        ...dateFields(draft.date),
        ...amounts(draft.amount),
      ],
      result: {
        id: `draft:${draft.id}`,
        kind: 'draft' as const,
        title: draft.description,
        // Category first, state second — the same shape as `Rewards · Claimed` and
        // `Everyday · Closed`, which is also what lets the tile take its category colour.
        subtitle: draft.category ? `${draft.category} · Not added yet` : 'Not added yet',
        amount: draft.amount,
        meta: draft.date,
        target: { to: 'draft' as const, draftId: String(draft.id) },
      },
    }
  })

  const accounts = collect(data.accounts, tokens, account => isPendingDelete(account) ? null : ({
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
      isPendingSync: account.isPendingSync,
      target: { to: 'account' as const, accountId: account.id },
    },
  }))

  const bills = collect(data.recurringPayments, tokens, payment => isPendingDelete(payment) ? null : ({
    fields: [
      ...field('title', payment.name),
      ...field('keyword', payment.category),
      ...field('keyword', bucketOf(payment.ledgerCategory)),
      ...dateFields(payment.nextDueDate),
      ...amounts(payment.amount),
    ],
    result: {
      id: `bill:${payment.id}`,
      kind: 'bill' as const,
      title: payment.name,
      subtitle: payment.active ? payment.category : `${payment.category} · Paused`,
      amount: payment.amount,
      meta: payment.nextDueDate ?? undefined,
      isPendingSync: payment.isPendingSync,
      target: { to: 'bill' as const, recurringPaymentId: payment.id },
    },
  }))

  const loans = collect(data.loans, tokens, loan => isPendingDelete(loan) ? null : ({
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
      isPendingSync: loan.isPendingSync,
      target: { to: 'loan' as const, loanId: loan.id },
    },
  }))

  const commitments = collect(data.savingsGoals, tokens, goal => isPendingDelete(goal) ? null : ({
    fields: [
      ...field('title', goal.name),
      ...field('keyword', goal.fundingBucket ?? 'Rewards'),
      ...dateFields(goal.targetDate),
      ...amounts(goal.targetAmount),
    ],
    result: {
      id: `commitment:${goal.id}`,
      kind: 'commitment' as const,
      title: goal.name,
      subtitle: goal.status === 'completed' ? 'Commitment · Done' : 'Commitment',
      amount: goal.targetAmount,
      meta: goal.targetDate,
      isPendingSync: goal.isPendingSync,
      target: { to: 'commitment' as const, savingsGoalId: String(goal.id) },
    },
  }))

  const rewards = collect(data.wishlist, tokens, item => isPendingDelete(item) ? null : ({
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
      isPendingSync: item.isPendingSync,
      target: { to: 'reward' as const, wishlistItemId: String(item.id) },
    },
  }))

  return [...transactions, ...drafts, ...accounts, ...bills, ...loans, ...commitments, ...rewards]
}

/** Display order of the result groups, most-searched-for first. */
export const SEARCH_GROUP_ORDER: readonly SearchResultKind[] = [
  'transaction',
  'draft',
  'account',
  'bill',
  'loan',
  'commitment',
  'reward',
]

/** Plain-language group headings. No jargon: "Bills", not "Recurring payment entities". */
export const SEARCH_GROUP_LABELS: Record<SearchResultKind, string> = {
  transaction: 'Transactions in this cycle',
  draft: 'Drafts waiting to be added',
  account: 'Accounts',
  bill: 'Bills & subscriptions',
  loan: 'Loans',
  commitment: 'Commitments',
  reward: 'Rewards',
}

export interface SearchGroup {
  kind: SearchResultKind
  label: string
  /** Capped at `RESULTS_PER_KIND`; these are exactly the rows the overlay renders. */
  results: SearchResult[]
  /** How many matched before the cap, so a truncated group can say what it is not showing. */
  totalMatched: number
}

/**
 * Groups ranked results for display, applies the per-kind cap, and reports what the cap dropped.
 *
 * The cap lives here rather than in `rank` because this is the only place that still knows the
 * full count: capping earlier discarded it silently, so twenty matching transactions rendered as
 * six rows under the words "6 found" and nothing said the other fourteen existed.
 */
export const groupSearchResults = (results: readonly SearchResult[]): SearchGroup[] =>
  SEARCH_GROUP_ORDER
    .map(kind => {
      const matched = results.filter(result => result.kind === kind)
      return {
        kind,
        label: SEARCH_GROUP_LABELS[kind],
        results: matched.slice(0, RESULTS_PER_KIND),
        totalMatched: matched.length,
      }
    })
    .filter(group => group.results.length > 0)

/**
 * The rows the overlay will actually render, in group order. Keyboard selection walks this, so
 * it must be the capped set — arrowing onto a row that grouping dropped would move the active
 * option to something nobody can see.
 */
export const visibleSearchResults = (groups: readonly SearchGroup[]): SearchResult[] =>
  groups.flatMap(group => group.results)
