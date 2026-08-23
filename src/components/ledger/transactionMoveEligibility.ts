import type { Transaction } from '../../types'

export function transactionMoveIneligibility(transaction: Transaction): string | null {
  if (String(transaction.id).includes('-split-')) return 'Generated income-split rows can only move with their parent.'
  if (transaction.recurringPaymentId) return 'Recurring settlements must be changed through Recurring.'
  if (transaction.savingsGoalId != null) return 'Commitment completion records cannot be moved.'
  if (transaction.wishlistItemId != null) return 'Reward completion records cannot be moved.'
  if (transaction.isAccountBalanceAdjustment) return 'Reconciliation adjustments cannot be moved.'
  if ((transaction.stabilityRecoveryTopUpAmount ?? 0) > 0) return 'Stability lifecycle records cannot be moved.'
  return null
}
