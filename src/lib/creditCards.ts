import type { LedgerAccount, LedgerAccountKind } from '../types'
import type { LedgerAddPrefill } from '../app/useCycleNavigation'
import { roundMoney } from './money'

// A credit card is a ledger account whose balance may sit below zero: the negative balance is what
// is owed, already counted against its bucket. The limit is borrowing room and never money, so
// nothing here adds it to a balance. Mirrors LedgerAccountKind on the server.

/** Debt sits only in spending buckets: Stability is a reserve and Growth is savings. */
export const CREDIT_CARD_BUCKETS: ReadonlyArray<LedgerAccount['bucket']> = ['Essentials', 'Rewards']

export const CREDIT_CARD_BUCKET_ERROR = 'Credit cards can only be added to Essentials or Rewards.'

export const isCreditCardKind = (kind: LedgerAccountKind | null | undefined): boolean => kind === 'CreditCard'

export const isCreditCard = (account: Pick<LedgerAccount, 'kind'>): boolean => isCreditCardKind(account.kind)

export const isKindAllowedInBucket = (kind: LedgerAccountKind, bucket: LedgerAccount['bucket']): boolean =>
  !isCreditCardKind(kind) || CREDIT_CARD_BUCKETS.includes(bucket)

/** What is owed on a card, as a positive amount. A card in credit owes nothing. */
export const cardOwed = (account: Pick<LedgerAccount, 'kind' | 'remaining'>): number =>
  isCreditCard(account) ? roundMoney(Math.max(0, -account.remaining)) : 0

/** Borrowing room left, or null when no limit is recorded -- unknown is not zero. */
export const cardAvailableCredit = (
  account: Pick<LedgerAccount, 'kind' | 'remaining' | 'creditLimit'>,
): number | null =>
  isCreditCard(account) && typeof account.creditLimit === 'number'
    ? roundMoney(account.creditLimit + account.remaining)
    : null

export interface BucketCardSplit {
  /** What the bucket's non-card accounts hold. */
  cash: number
  /** What the bucket's cards owe, as a positive amount. */
  owed: number
  /** True when the bucket's cash cannot pay off its cards today. */
  isShort: boolean
}

/**
 * Splits a bucket into money held and money owed on cards, or null when the bucket has no open
 * card -- then there is nothing to split and the bucket total already says everything.
 */
export function splitBucketCards(accounts: ReadonlyArray<LedgerAccount>): BucketCardSplit | null {
  if (!accounts.some(account => isCreditCard(account) && !account.isArchived)) return null
  const cash = roundMoney(accounts
    .filter(account => !isCreditCard(account))
    .reduce((sum, account) => sum + account.remaining, 0))
  const owed = roundMoney(accounts.reduce((sum, account) => sum + cardOwed(account), 0))
  return { cash, owed, isShort: owed > 0 && cash < owed }
}

/**
 * The account a card payment should leave from by default: the open non-card account in the same
 * bucket holding the most. Null when the bucket has none, so the form asks instead of guessing.
 */
export function defaultCardPaymentSource(
  card: Pick<LedgerAccount, 'id' | 'bucket'>,
  accounts: ReadonlyArray<LedgerAccount>,
): LedgerAccount | null {
  const candidates = accounts.filter(account =>
    account.bucket === card.bucket
    && account.id !== card.id
    && !account.isArchived
    && !isCreditCard(account))
  if (candidates.length === 0) return null
  return candidates.reduce((best, account) => account.remaining > best.remaining ? account : best)
}

/**
 * A card payment is an in-bucket move from a cash account to the card: it settles debt the bucket
 * already counted, so it has no bucket effect and never reports as spending.
 */
export function buildCardPaymentPrefill(
  card: LedgerAccount,
  accounts: ReadonlyArray<LedgerAccount>,
): LedgerAddPrefill {
  const owed = cardOwed(card)
  return {
    transactionType: 'transfer',
    transferSource: card.bucket,
    transferTarget: card.bucket,
    accountId: defaultCardPaymentSource(card, accounts)?.id,
    counterAccountId: card.id,
    amount: owed > 0 ? owed.toFixed(2) : undefined,
    description: `Pay ${card.name}`,
  }
}
