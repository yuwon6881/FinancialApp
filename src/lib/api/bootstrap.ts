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
  InvestmentAllocationOverview,
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
import type { RefreshSlice } from '../refreshSlices'
import type { DocumentOverview } from './documents'

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

interface WireBootstrapRefreshPayload {
  month: string
  year: number
  dashboard?: WireDashboardData | null
  insights?: WireDashboardInsights | null
  transactions?: WireTransaction[] | null
  recurringPayments?: WireRecurringPayment[] | null
  categories?: WireTransactionCategory[] | null
  wishlist?: WireWishlistItem[] | null
  savingsGoals?: WireSavingsGoal[] | null
  loans?: WireLoan[] | null
  accounts?: WireLedgerAccount[] | null
  autocomplete?: AutocompleteSuggestion[] | null
  walletBalance?: { totalBalance: string | number } | null
  investments?: WireInvestmentRefreshPayload | null
  documents?: WireDocumentRefreshPayload | null
}

interface WireInvestmentRefreshPayload {
  allocation: InvestmentAllocationOverview
}

type WireDocumentRefreshPayload = DocumentOverview

export type BootstrapRefreshPayload = {
  month: string
  year: number
  dashboard?: DashboardCore
  insights?: DashboardInsights
  transactions?: Transaction[]
  recurringPayments?: RecurringPayment[]
  categories?: TransactionCategory[]
  wishlist?: WishlistItem[]
  savingsGoals?: SavingsGoal[]
  loans?: Loan[]
  accounts?: LedgerAccount[]
  autocomplete?: AutocompleteSuggestion[]
  walletBalance?: number
  investments?: { allocation: InvestmentAllocationOverview }
  documents?: DocumentOverview
}

function mapInvestmentRefresh(data: WireInvestmentRefreshPayload): { allocation: InvestmentAllocationOverview } {
  return {
    allocation: {
      ...data.allocation,
      plan: { ...data.allocation.plan },
      assignments: [...data.allocation.assignments],
      sleeves: [...data.allocation.sleeves],
      recommendations: [...data.allocation.recommendations],
      incompleteReasons: [...data.allocation.incompleteReasons],
      freshness: {
        ...data.allocation.freshness,
        staleInputs: [...data.allocation.freshness.staleInputs],
      },
      contributionPlan: data.allocation.contributionPlan
        ? {
          ...data.allocation.contributionPlan,
          sleeves: [...data.allocation.contributionPlan.sleeves],
        }
        : undefined,
    },
  }
}

function mapDocumentRefresh(data: WireDocumentRefreshPayload): DocumentOverview {
  return {
    usage: { ...data.usage },
    availableYears: [...data.availableYears],
    retention: {
      ...data.retention,
      taxYears: [...data.retention.taxYears],
    },
    selectedTaxYear: data.selectedTaxYear,
    summary: data.summary
      ? { ...data.summary, categories: [...data.summary.categories] }
      : null,
    reliefCategories: [...data.reliefCategories],
  }
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

/** Fetches only the server read models named by a successful mutation's refresh hint. */
export async function fetchBootstrapRefresh(
  slices: readonly RefreshSlice[],
  month?: string,
  year?: number,
  signal?: AbortSignal,
): Promise<BootstrapRefreshPayload> {
  if (slices.length === 0) {
    throw new Error('At least one refresh slice is required')
  }
  const params = new URLSearchParams({ slices: slices.join(',') })
  if (month) params.set('month', month)
  if (year !== undefined) params.set('year', String(year))
  const data = await request<WireBootstrapRefreshPayload>(`/bootstrap/refresh?${params}`, {
    signal,
    errorMessage: 'Failed to reconcile application data',
  })

  return {
    month: data.month,
    year: data.year,
    ...(data.dashboard ? { dashboard: mapDashboardCore(data.dashboard, data.month, data.year) } : {}),
    ...(data.insights ? { insights: mapDashboardInsights(data.insights) } : {}),
    ...(data.transactions ? { transactions: data.transactions.map(deobfuscateTransaction) } : {}),
    ...(data.recurringPayments ? { recurringPayments: data.recurringPayments.map(deobfuscateRecurringPayment) } : {}),
    ...(data.categories ? { categories: data.categories.map(mapCategory) } : {}),
    ...(data.wishlist ? { wishlist: data.wishlist.map(deobfuscateWishlistItem) } : {}),
    ...(data.savingsGoals ? { savingsGoals: data.savingsGoals.map(deobfuscateSavingsGoal) } : {}),
    ...(data.loans ? { loans: data.loans.map(deobfuscateLoan) } : {}),
    ...(data.accounts ? { accounts: data.accounts.map(deobfuscateLedgerAccount) } : {}),
    ...(data.autocomplete ? { autocomplete: data.autocomplete } : {}),
    ...(data.walletBalance ? { walletBalance: deobfuscateAmount(data.walletBalance.totalBalance) } : {}),
    ...(data.investments ? { investments: mapInvestmentRefresh(data.investments) } : {}),
    ...(data.documents ? { documents: mapDocumentRefresh(data.documents) } : {}),
  }
}
