import { Banknote, CircleHelp, CreditCard, Landmark, Wallet, WalletCards, type LucideIcon } from 'lucide-react'
import type { LedgerAccount, LedgerAccountKind } from '../../../types'
import { isKindAllowedInBucket } from '../../../lib/creditCards'

export const ACCOUNT_BUCKET_OPTIONS: Array<{ value: LedgerAccount['bucket']; label: string }> = [
  { value: 'Essentials', label: 'Essentials' },
  { value: 'Growth', label: 'Growth' },
  { value: 'Stability', label: 'Stability' },
  { value: 'Rewards', label: 'Rewards' },
]

export const ACCOUNT_KIND_OPTIONS: Array<{ value: LedgerAccountKind; label: string }> = [
  { value: 'Bank', label: 'Bank account' },
  { value: 'EWallet', label: 'E-wallet' },
  { value: 'Cash', label: 'Cash' },
  { value: 'Card', label: 'Debit card' },
  { value: 'CreditCard', label: 'Credit card' },
  { value: 'Other', label: 'Other' },
]

export const ACCOUNT_KIND_LABELS: Record<LedgerAccountKind, string> = {
  Bank: 'Bank account',
  EWallet: 'E-wallet',
  Cash: 'Cash',
  Card: 'Debit card',
  CreditCard: 'Credit card',
  Other: 'Other',
}

export const ACCOUNT_KIND_ICONS: Record<LedgerAccountKind, LucideIcon> = {
  Bank: Landmark,
  EWallet: Wallet,
  Cash: Banknote,
  Card: WalletCards,
  CreditCard: CreditCard,
  Other: CircleHelp,
}

/** Kind choices for a bucket: a credit card only appears where debt may sit. */
export const accountKindOptionsFor = (bucket: LedgerAccount['bucket']) =>
  ACCOUNT_KIND_OPTIONS.filter(option => isKindAllowedInBucket(option.value, bucket))

/** Bucket choices for a kind: a credit card cannot be moved into a reserve or savings bucket. */
export const accountBucketOptionsFor = (kind: LedgerAccountKind) =>
  ACCOUNT_BUCKET_OPTIONS.filter(option => isKindAllowedInBucket(kind, option.value))

export const BUCKET_DEFINITIONS: ReadonlyArray<{ name: LedgerAccount['bucket']; description: string }> = [
  { name: 'Essentials', description: 'Everyday spending' },
  { name: 'Growth', description: 'Money sent to investments' },
  { name: 'Stability', description: 'Emergency cushion' },
  { name: 'Rewards', description: 'Plans and treats' },
]
