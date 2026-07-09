import type {
  ActiveRecurringPayment,
  CategoryBreakdown,
  CategorySummary,
  DashboardData,
  DashboardStats,
  FinancialSetting,
  PendingNotification,
  RecurringPayment,
  Transaction,
  TrendPoint,
  WishlistItem,
} from '../types'

type WireAmount = string | number

export interface LoginCredentials {
  username: string
  password: string
}

export type RegisterCredentials = LoginCredentials

export type WireTransaction = Omit<Transaction, 'amount'> & {
  amount: WireAmount
}

export type WireRecurringPayment = Omit<RecurringPayment, 'amount'> & {
  amount: WireAmount
}

export type WireWishlistItem = Omit<WishlistItem, 'price'> & {
  price: WireAmount
}

type WireDashboardSetting = Omit<FinancialSetting, 'targetStabilityFund'> & {
  targetStabilityFund: WireAmount
}

export type WireCategorySummary = Omit<CategorySummary, 'target' | 'budget' | 'netChange' | 'remaining'> & {
  target: WireAmount
  budget: WireAmount
  netChange: WireAmount
  remaining: WireAmount
}

// pastThreeMonthsRewardsAverage/hasRewardsHistory are no longer part of the /dashboard response --
// they've moved to WireDashboardInsights below (see fetchDashboardInsights).
type WireDashboardStats = Omit<
  DashboardStats,
  'totalBalance' | 'monthlyIncome' | 'monthlyInflow' | 'monthlyExpenses' | 'activeRecurringTotal' | 'pastThreeMonthsRewardsAverage' | 'hasRewardsHistory'
> & {
  totalBalance: WireAmount
  monthlyIncome: WireAmount
  monthlyInflow: WireAmount
  monthlyExpenses: WireAmount
  activeRecurringTotal: WireAmount
}

export type WireActiveRecurringPayment = Omit<ActiveRecurringPayment, 'amount'> & {
  amount: WireAmount
}

export type WireTrendPoint = Omit<TrendPoint, 'balance'> & {
  balance: WireAmount
}

export type WirePendingNotification = Omit<PendingNotification, 'amount'> & {
  amount: WireAmount
}

export type WireCategoryBreakdown = Omit<CategoryBreakdown, 'amount'> & {
  amount: WireAmount
}

export type WireDashboardData = Omit<
  DashboardData,
  | 'setting'
  | 'categories'
  | 'stats'
  | 'activeRecurringPayments'
  | 'trendPoints'
  | 'last3TrendPoints'
  | 'last6TrendPoints'
  | 'pendingNotifications'
  | 'monthlyCategoryBreakdown'
  | 'last3CategoryBreakdown'
  | 'last6CategoryBreakdown'
  | 'yearlyCategoryBreakdown'
  | 'availableYears'
> & {
  setting: WireDashboardSetting
  categories: WireCategorySummary[]
  stats: WireDashboardStats
  activeRecurringPayments: WireActiveRecurringPayment[]
  trendPoints: WireTrendPoint[]
  last3TrendPoints: WireTrendPoint[]
  last6TrendPoints: WireTrendPoint[]
  pendingNotifications: WirePendingNotification[]
  monthlyCategoryBreakdown: WireCategoryBreakdown[]
}

// The expensive historical aggregates split out of /dashboard into /dashboard/insights (see
// FinancialService.GetDashboardInsightsAsync on the backend) -- fetched separately and merged
// back into a full DashboardData client-side in App.tsx's loadAll().
export interface WireDashboardInsights {
  last3CategoryBreakdown: WireCategoryBreakdown[]
  last6CategoryBreakdown: WireCategoryBreakdown[]
  yearlyCategoryBreakdown: WireCategoryBreakdown[]
  pastThreeMonthsRewardsAverage: WireAmount
  hasRewardsHistory: boolean
  availableYears: number[]
}

export interface WirePagedTransactionResult {
  items?: WireTransaction[]
  total?: number
  page?: number
  pageSize?: number
}

export interface WireWishlistPurchaseResult {
  item: WireWishlistItem
  transaction: WireTransaction
}
