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

type WireDashboardSetting = Omit<FinancialSetting, 'targetStabilityFund'> & {
  targetStabilityFund: WireAmount
}

export type WireCategorySummary = Omit<CategorySummary, 'target' | 'budget' | 'netChange' | 'remaining'> & {
  target: WireAmount
  budget: WireAmount
  netChange: WireAmount
  remaining: WireAmount
}

type WireDashboardStats = Omit<
  DashboardStats,
  'totalBalance' | 'monthlyIncome' | 'monthlyInflow' | 'monthlyExpenses' | 'activeRecurringTotal' | 'pastThreeMonthsRewardsAverage'
> & {
  totalBalance: WireAmount
  monthlyIncome: WireAmount
  monthlyInflow: WireAmount
  monthlyExpenses: WireAmount
  activeRecurringTotal: WireAmount
  pastThreeMonthsRewardsAverage: WireAmount
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
  | 'recentTransactions'
  | 'activeRecurringPayments'
  | 'trendPoints'
  | 'last3TrendPoints'
  | 'last6TrendPoints'
  | 'pendingNotifications'
  | 'monthlyCategoryBreakdown'
  | 'last3CategoryBreakdown'
  | 'last6CategoryBreakdown'
  | 'yearlyCategoryBreakdown'
> & {
  setting: WireDashboardSetting
  categories: WireCategorySummary[]
  stats: WireDashboardStats
  recentTransactions: WireTransaction[]
  activeRecurringPayments: WireActiveRecurringPayment[]
  trendPoints: WireTrendPoint[]
  last3TrendPoints: WireTrendPoint[]
  last6TrendPoints: WireTrendPoint[]
  pendingNotifications: WirePendingNotification[]
  monthlyCategoryBreakdown: WireCategoryBreakdown[]
  last3CategoryBreakdown: WireCategoryBreakdown[]
  last6CategoryBreakdown: WireCategoryBreakdown[]
  yearlyCategoryBreakdown: WireCategoryBreakdown[]
}

export interface WirePagedTransactionResult {
  items?: WireTransaction[]
  total?: number
  page?: number
  pageSize?: number
}

export interface WireWishlistPurchaseResult {
  item: import('../types').WishlistItem
  transaction: WireTransaction
}
