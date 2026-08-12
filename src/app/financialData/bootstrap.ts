import * as api from '../../lib/api'
import { hasHttpStatus } from '../../lib/errors'
import type {
  AutocompleteSuggestion,
  RecurringPayment,
  SavingsGoal,
  Transaction,
  TransactionCategory,
  WishlistItem,
  Loan,
} from '../../types'

export type LoadAllTuple = readonly [
  api.BootstrapPayload['dashboard'],
  Transaction[],
  RecurringPayment[],
  TransactionCategory[],
  WishlistItem[] | null,
  AutocompleteSuggestion[],
  number | null,
  api.BootstrapPayload['insights'],
  SavingsGoal[] | null,
  Loan[] | null,
]

/**
 * Uses the single-request bootstrap path. Only a 404 falls back to the legacy
 * endpoint fan-out because that specifically means the server has no bootstrap route.
 */
export async function fetchBootstrapPayload(
  month: string | undefined,
  year: number | undefined,
  signal: AbortSignal,
): Promise<LoadAllTuple | null> {
  try {
    const payload = await api.fetchBootstrap(month, year, signal)
    return [
      payload.dashboard,
      payload.transactions,
      payload.recurringPayments,
      payload.categories,
      payload.wishlist,
      payload.autocomplete,
      payload.walletBalance,
      payload.insights,
      Array.isArray(payload.savingsGoals) ? payload.savingsGoals : null,
      Array.isArray(payload.loans) ? payload.loans : null,
    ] as const
  } catch (bootstrapError: unknown) {
    if (!hasHttpStatus(bootstrapError, 404)) throw bootstrapError
    console.warn('This server has no /api/bootstrap endpoint; loading each slice separately.')
    return null
  }
}
