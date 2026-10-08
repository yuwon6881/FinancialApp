import type { LedgerAccount, LedgerAccountKind, Transaction, TransactionCategory } from '../types'
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
 * Accounts a card can be paid from here: open cash accounts in the spending buckets, the card's own
 * bucket first and the fullest first within it. Stability and Growth are left to the ledger form,
 * which asks the reload and contribution questions a payment out of them needs.
 */
export function cardPaymentSources(
  card: Pick<LedgerAccount, 'id' | 'bucket'>,
  accounts: ReadonlyArray<LedgerAccount>,
): LedgerAccount[] {
  return accounts
    .filter(account =>
      account.id !== card.id
      && !account.isArchived
      && !isCreditCard(account)
      && CREDIT_CARD_BUCKETS.includes(account.bucket))
    .sort((left, right) =>
      Number(right.bucket === card.bucket) - Number(left.bucket === card.bucket)
      || right.remaining - left.remaining)
}

const RESERVED_CATEGORY_NAMES = new Set(['transfer', 'adjustment'])
const REBATE_CATEGORY_PATTERN = /cash\s*-?\s*back|rebate|refund|reward/i

/**
 * The category a card rebate is filed under by default: an inflow category that reads like cashback,
 * else Other. Empty otherwise, so the sheet asks rather than filing a rebate under an unrelated name.
 */
export function defaultRebateCategory(categories: ReadonlyArray<TransactionCategory>): string {
  const usable = categories.filter(category =>
    !category.isPendingDelete
    && category.type !== 'outflow'
    && !RESERVED_CATEGORY_NAMES.has(category.name.trim().toLowerCase()))
  return (usable.find(category => REBATE_CATEGORY_PATTERN.test(category.name))
    ?? usable.find(category => category.name.trim().toLowerCase() === 'other'))?.name ?? ''
}

/** What the part of the bill not paid in cash was: taken off by the bank, or still owed. */
export type CardRemainder = 'rebate' | 'owed'

export interface CardSettlementInput {
  card: LedgerAccount
  source: LedgerAccount | undefined
  amountPaid: number
  /** Required only when the payment is below what is owed. */
  remainder: CardRemainder | null
  rebateCategory: string
  /** yyyy-MM-dd */
  date: string
}

export type CardSettlementPlan =
  | { ok: true; transactions: Array<Omit<Transaction, 'id'>>; rebate: number; stillOwed: number }
  | { ok: false; field: 'source' | 'amount' | 'remainder' | 'category'; message: string }

/**
 * Turns "I paid X towards this card" into ledger rows. The payment is a structural move into the
 * card -- an AccountMove inside the bucket, or a Transfer from the other spending bucket -- so it is
 * never spending. A rebate is a separate inflow on the card in the user's chosen category: the bank
 * gave that money back, so it is visible in reports rather than hidden in a balance correction.
 */
export function planCardSettlement(input: CardSettlementInput): CardSettlementPlan {
  const { card, source, rebateCategory, date } = input
  const owed = cardOwed(card)
  if (card.isArchived || owed <= 0) return { ok: false, field: 'amount', message: 'Nothing is owed on an open card.' }
  if (!source || !cardPaymentSources(card, [source]).length) {
    return { ok: false, field: 'source', message: 'Choose an open Essentials or Rewards account the payment came from.' }
  }
  if (!Number.isFinite(input.amountPaid) || input.amountPaid <= 0) {
    return { ok: false, field: 'amount', message: 'Enter the amount you paid.' }
  }
  const amountPaid = roundMoney(input.amountPaid)
  if (amountPaid <= 0) return { ok: false, field: 'amount', message: 'Enter at least 0.01 as the amount paid.' }
  if (amountPaid > owed) return { ok: false, field: 'amount', message: 'That is more than this card owes.' }
  if (amountPaid > roundMoney(source.remaining)) {
    return { ok: false, field: 'amount', message: `${source.name} does not hold that much.` }
  }

  const rest = roundMoney(owed - amountPaid)
  if (rest > 0 && input.remainder === null) {
    return { ok: false, field: 'remainder', message: 'Choose what happened to the rest.' }
  }
  const rebate = rest > 0 && input.remainder === 'rebate' ? rest : 0
  if (rebate > 0 && !rebateCategory.trim()) {
    return { ok: false, field: 'category', message: 'Choose a category for the rebate.' }
  }

  const transactions: Array<Omit<Transaction, 'id'>> = [{
    date,
    description: `Pay ${card.name}`,
    category: 'Transfer',
    ledgerCategory: source.bucket === card.bucket ? 'AccountMove' : `Transfer:${source.bucket}->${card.bucket}`,
    amount: amountPaid,
    accountId: source.id,
    counterAccountId: card.id,
  }]
  if (rebate > 0) {
    transactions.push({
      date,
      description: `Rebate on ${card.name}`,
      category: rebateCategory.trim(),
      ledgerCategory: card.bucket,
      amount: rebate,
      accountId: card.id,
    })
  }
  return { ok: true, transactions, rebate, stillOwed: roundMoney(rest - rebate) }
}
