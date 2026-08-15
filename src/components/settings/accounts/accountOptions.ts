import type { LedgerAccount, LedgerAccountInterestFrequency, LedgerAccountKind } from '../../../types'

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
  { value: 'Card', label: 'Card' },
  { value: 'Other', label: 'Other' },
]

export const ACCOUNT_KIND_LABELS: Record<LedgerAccountKind, string> = {
  Bank: 'Bank account',
  EWallet: 'E-wallet',
  Cash: 'Cash',
  Card: 'Card',
  Other: 'Other',
}

export const ACCOUNT_INTEREST_FREQUENCY_OPTIONS: Array<{ value: LedgerAccountInterestFrequency; label: string }> = [
  { value: 'Daily', label: 'Daily' },
  { value: 'Monthly', label: 'Monthly' },
  { value: 'Yearly', label: 'Yearly' },
]

export const ACCOUNT_INTEREST_FREQUENCY_LABELS: Record<LedgerAccountInterestFrequency, string> = {
  Daily: 'daily',
  Monthly: 'monthly',
  Yearly: 'yearly',
}

export const BUCKET_DEFINITIONS: ReadonlyArray<{ name: LedgerAccount['bucket']; description: string }> = [
  { name: 'Essentials', description: 'Everyday spending' },
  { name: 'Growth', description: 'Money sent to investments' },
  { name: 'Stability', description: 'Emergency cushion' },
  { name: 'Rewards', description: 'Plans and treats' },
]
