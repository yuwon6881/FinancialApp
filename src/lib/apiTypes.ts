import type {
  ActiveRecurringPayment,
  CategoryBreakdown,
  CategorySummary,
  DashboardData,
  DashboardStats,
  FinancialSetting,
  PayEarlyResult,
  PendingNotification,
  RecurringPayment,
  RecurringSettlementResult,
  Transaction,
  TrendPoint,
  TodayPlanInsights,
  CategoryLimitProgress,
  StabilityRecovery,
  WishlistItem,
  SavingsGoal,
  Loan,
  LoanPaymentSplit,
  LoanScheduleEntry,
  LedgerAccount,
} from '../types'

type WireAmount = string | number

interface WireCycleSummaryInsights {
  largestExpenseDescription?: string
  largestExpenseAmount?: WireAmount
  biggestDayDate?: string
  biggestDayTotal?: WireAmount
  avgDailySpend?: WireAmount
  cycleLengthDays: number
  velocityFirstHalf?: WireAmount
  velocitySecondHalf?: WireAmount
  noSpendDays: number
  transactionCount: number
  committedSpend: WireAmount
  discretionarySpend: WireAmount
}

export interface LoginCredentials {
  username: string
  password: string
}

export type RegisterCredentials = LoginCredentials

export type WireTransaction = Omit<Transaction, 'amount' | 'stabilityRecoveryTopUpAmount'> & {
  amount: WireAmount
  stabilityRecoveryTopUpAmount?: WireAmount | null
}

export type WireRecurringPayment = Omit<RecurringPayment, 'amount'> & {
  amount: WireAmount
}

export type WireWishlistItem = Omit<WishlistItem, 'price'> & {
  price: WireAmount
}

export type WireSavingsGoal = Omit<SavingsGoal, 'targetAmount' | 'earmarkedAmount' | 'cycleFundedAmount'> & {
  targetAmount: WireAmount
  earmarkedAmount: WireAmount
  cycleFundedAmount: WireAmount
}

export interface WireSavingsGoalPool {
  rewardsBalance: WireAmount
  totalEarmarked: WireAmount
  unassigned: WireAmount
  requiredPerCycleTotal: WireAmount
  outstandingThisCycleTotal: WireAmount
  currentCycleKey?: string
}

export interface WireSavingsGoalFundingResult {
  goals?: WireSavingsGoal[]
  totalGranted: WireAmount
  freeToSpend: WireAmount
  rewardsFreeToSpend?: WireAmount
  essentialsFreeToSpend?: WireAmount
}

export type WireLedgerAccount = Omit<LedgerAccount, 'remaining'> & {
  remaining: WireAmount
}

export interface WireSavingsGoalCompletionResult {
  goal: WireSavingsGoal
  transaction: WireTransaction
}

type WireDashboardSetting = Omit<FinancialSetting, 'targetStabilityFund'> & {
  targetStabilityFund: WireAmount
}

export type WireCategorySummary = Omit<CategorySummary, 'target' | 'incomeAllocated' | 'budget' | 'netChange' | 'spent' | 'remaining' | 'accounts'> & {
  target: WireAmount
  incomeAllocated: WireAmount
  budget: WireAmount
  netChange: WireAmount
  spent?: WireAmount
  remaining: WireAmount
  accounts?: Array<Omit<NonNullable<CategorySummary['accounts']>[number], 'remaining'> & { remaining: WireAmount }>
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
  amount: WireAmount | null
}

export type WireRecurringSettlementResult = Omit<RecurringSettlementResult, 'occurrence' | 'transaction'> & {
  occurrence: WireActiveRecurringPayment
  transaction?: WireTransaction | null
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

type WireTodayPlanInsights = Omit<
  TodayPlanInsights,
  | 'unpaidRecurringTotal'
  | 'unpaidEssentialsTotal'
  | 'nonRecurringEssentialsSpent'
  | 'nonRecurringEssentialsDailyAverage'
  | 'projectedEssentialsEndingBalance'
> & {
  unpaidRecurringTotal: WireAmount
  unpaidEssentialsTotal: WireAmount
  nonRecurringEssentialsSpent: WireAmount
  nonRecurringEssentialsDailyAverage: WireAmount
  projectedEssentialsEndingBalance: WireAmount
}

type WireStabilityRecovery = Omit<
  StabilityRecovery,
  | 'target'
  | 'currentBalance'
  | 'outstandingShortfall'
  | 'requiredThisCycle'
  | 'toppedUpThisCycle'
  | 'outstandingThisCycle'
  | 'markedTotal'
  | 'repaidTotal'
  | 'essentialsCommitted'
  | 'rewardsCommitted'
> & {
  target: WireAmount
  currentBalance: WireAmount
  outstandingShortfall: WireAmount
  requiredThisCycle: WireAmount
  toppedUpThisCycle: WireAmount
  outstandingThisCycle: WireAmount
  markedTotal: WireAmount
  repaidTotal: WireAmount
  essentialsCommitted: WireAmount
  rewardsCommitted: WireAmount
}

export type WireLoanPaymentSplit = Omit<LoanPaymentSplit, 'payment' | 'interest' | 'principal' | 'balanceBefore' | 'balanceAfter' | 'surplus'> & {
  payment: WireAmount
  interest: WireAmount
  principal: WireAmount
  balanceBefore: WireAmount
  balanceAfter: WireAmount
  surplus: WireAmount
}

export type WireLoanScheduleEntry = Omit<LoanScheduleEntry, 'payment' | 'interest' | 'principal' | 'balanceAfter'> & {
  payment: WireAmount
  interest: WireAmount
  principal: WireAmount
  balanceAfter: WireAmount
}

export type WireLoan = Omit<Loan, 'openingPrincipal' | 'annualRatePercent' | 'snapshot'> & {
  openingPrincipal: WireAmount
  annualRatePercent: number | string
  snapshot: Omit<Loan['snapshot'], 'outstandingBalance' | 'scheduledPayment' | 'totalScheduledInterest' | 'totalInterestPaid' | 'nextPayment' | 'payments' | 'futureSchedule'> & {
    outstandingBalance: WireAmount
    scheduledPayment: WireAmount
    totalScheduledInterest: WireAmount
    totalInterestPaid: WireAmount
    nextPayment?: WireLoanScheduleEntry | null
    payments: WireLoanPaymentSplit[]
    futureSchedule: WireLoanScheduleEntry[]
  }
}

type WireCategoryLimitProgress = Omit<
  CategoryLimitProgress,
  'limit' | 'spent' | 'remaining' | 'pendingCommitted' | 'projectedSpend'
> & {
  limit: WireAmount
  spent: WireAmount
  remaining: WireAmount
  pendingCommitted: WireAmount
  projectedSpend: WireAmount
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
  | 'todayPlanInsights'
  | 'categoryLimitProgress'
  | 'stabilityRecovery'
  | 'recurringAccountShortfalls'
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
  todayPlanInsights?: WireTodayPlanInsights
  categoryLimitProgress?: WireCategoryLimitProgress[]
  cycleSummaryInsights?: WireCycleSummaryInsights
  stabilityRecovery?: WireStabilityRecovery
  recurringAccountShortfalls?: WireRecurringAccountShortfall[]
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

export interface WireRecurringAccountShortfall {
  recurringPaymentId: string
  name: string
  amount: WireAmount
  dueDate: string
  dueDay?: number
  offsetDays: number
  accountId: string
  accountName: string
  accountBalance: WireAmount
  shortfall: WireAmount
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

export type WirePayEarlyResult = Omit<PayEarlyResult, 'transaction'> & {
  transaction: WireTransaction
}
