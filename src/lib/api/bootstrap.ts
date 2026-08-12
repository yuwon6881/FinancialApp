import type {
  AutocompleteSuggestion,
  DashboardCore,
  DashboardInsights,
  RecurringPayment,
  SavingsGoal,
  Transaction,
  TransactionCategory,
  WishlistItem,
  Loan,
  LedgerAccount,
} from '../../types'
import type {
  WireDashboardData,
  WireDashboardInsights,
  WireRecurringPayment,
  WireSavingsGoal,
  WireTransaction,
  WireWishlistItem,
  WireLoan,
  WireLedgerAccount,
} from '../apiTypes'
import {
  deobfuscateAmount,
  deobfuscateRecurringPayment,
  deobfuscateSavingsGoal,
  deobfuscateTransaction,
  deobfuscateWishlistItem,
  deobfuscateLoan,
  deobfuscateLedgerAccount,
} from './amounts'
import { mapCategory, type WireTransactionCategory } from './categories'
import { mapDashboardCore, mapDashboardInsights } from './financial'
import { request } from './client'

export interface BootstrapPayload {
  month: string
  year: number
  dashboard: DashboardCore
  insights: DashboardInsights
  transactions: Transaction[]
  recurringPayments: RecurringPayment[]
  categories: TransactionCategory[]
  wishlist: WishlistItem[]
  savingsGoals: SavingsGoal[]
  loans: Loan[] | null
  accounts: LedgerAccount[]
  autocomplete: AutocompleteSuggestion[]
  walletBalance: number
}

interface WireBootstrapPayload {
  month: string
  year: number
  dashboard: WireDashboardData
  insights: WireDashboardInsights
  transactions: WireTransaction[] | null
  recurringPayments: WireRecurringPayment[] | null
  categories: WireTransactionCategory[] | null
  wishlist: WireWishlistItem[] | null
  // Absent from an older server that predates savings goals; treated as "none" rather than an error.
  savingsGoals: WireSavingsGoal[] | null
  loans?: WireLoan[] | null
  accounts?: WireLedgerAccount[] | null
  autocomplete: AutocompleteSuggestion[] | null
  walletBalance: { totalBalance: string | number }
}

/**
 * One request for everything a cold launch needs, replacing eight.
 *
 * The old boot path fired eight GETs, two of which could not start until the dashboard
 * response arrived (the client learned the active month/year from it). On a phone that
 * dependency chain, not the queries behind it, was the dominant cost of starting the app.
 *
 * Every slice is decoded with the same mapper the individual endpoint uses, so the two
 * paths cannot disagree about amount deobfuscation. This is deliberately NOT routed through
 * `cachedGet`: the individual endpoints own those cache keys, and writing this composite
 * response into them would let a boot payload satisfy a later targeted refetch.
 */
export async function fetchBootstrap(
  month?: string,
  year?: number,
  signal?: AbortSignal,
): Promise<BootstrapPayload> {
  const params = new URLSearchParams()
  if (month) params.append('month', month)
  if (year) params.append('year', year.toString())
  params.append('includeLoans', 'false')
  const query = params.size ? `?${params}` : ''

  const data = await request<WireBootstrapPayload>(`/bootstrap${query}`, {
    signal,
    errorMessage: 'Failed to fetch initial application data',
  })

  return {
    month: data.month,
    year: data.year,
    dashboard: mapDashboardCore(data.dashboard, data.month, data.year),
    insights: mapDashboardInsights(data.insights),
    transactions: (data.transactions || []).map(deobfuscateTransaction),
    recurringPayments: (data.recurringPayments || []).map(deobfuscateRecurringPayment),
    categories: (data.categories || []).map(mapCategory),
    wishlist: (data.wishlist || []).map(deobfuscateWishlistItem),
    savingsGoals: (data.savingsGoals || []).map(deobfuscateSavingsGoal),
    loans: Array.isArray(data.loans) ? data.loans.map(deobfuscateLoan) : null,
    accounts: (data.accounts || []).map(deobfuscateLedgerAccount),
    autocomplete: data.autocomplete || [],
    walletBalance: deobfuscateAmount(data.walletBalance?.totalBalance),
  }
}
