import type { LedgerAccountKind } from './ledger'
import type { FinancialSetting } from './settings'
import type { ActiveRecurringPayment } from './recurring'
import type { StabilityRecovery } from './stability'

export interface CategorySummary {
  name: string
  allocation: number
  target: number
  // Income actually credited to this envelope; may differ from the planned target after recovery.
  incomeAllocated: number
  budget: number
  netChange: number
  // Actual outflows assigned to this envelope during the selected cycle. Unlike netChange this
  // excludes allocated income and transfers between envelopes.
  spent?: number
  remaining: number
  accounts?: Array<{
    id: string
    name: string
    kind?: LedgerAccountKind
    remaining: number
    isArchived?: boolean
  }>
}

export interface DashboardStats {
  totalBalance: number
  monthlyIncome: number
  monthlyInflow: number
  monthlyExpenses: number
  activeRecurringTotal: number
  growthPercentAchieved: number
  stabilityPercentReached: number
  pastThreeMonthsRewardsAverage: number
  hasRewardsHistory: boolean
}



export interface TrendPoint {
  cycleKey: string
  month: string
  balance: number
}

export interface PendingNotification {
  id: string // "{rpId}-{y}-{m}"
  recurringPaymentId: string
  name: string
  amount: number
  category: string
  ledgerCategory: string
  /**
   * The account frozen onto this occurrence when it was materialised, so confirming settles it
   * where it was scheduled rather than wherever the bill points now. Absent on occurrences
   * materialised before the account cutover; callers fall back to the parent payment.
   */
  accountId?: string | null
  billingDate: string
  year: number
  month: number
  cycleLabel: string
}

export interface CategoryBreakdown {
  category: string
  amount: number
}

export interface DashboardData {
  setting: FinancialSetting
  cycleLabel: string
  categories: CategorySummary[]
  stats: DashboardStats
  activeRecurringPayments: ActiveRecurringPayment[]
  trendPoints: TrendPoint[]
  last3TrendPoints: TrendPoint[]
  last6TrendPoints: TrendPoint[]
  pendingNotifications: PendingNotification[]
  monthlyCategoryBreakdown: CategoryBreakdown[]
  last3CategoryBreakdown: CategoryBreakdown[]
  last6CategoryBreakdown: CategoryBreakdown[]
  yearlyCategoryBreakdown: CategoryBreakdown[]
  availableYears?: number[]
  cycleSummaryInsights?: CycleSummaryInsights
  todayPlanInsights?: TodayPlanInsights
  categoryLimitProgress?: CategoryLimitProgress[]
  // Optional for the same reason todayPlanInsights is: a cached payload written before this
  // shipped must still parse.
  stabilityRecovery?: StabilityRecovery
  recurringAccountShortfalls?: RecurringAccountShortfall[]
}

export interface RecurringAccountShortfall {
  recurringPaymentId: string
  name: string
  amount: number
  dueDate: string
  dueDay?: number
  offsetDays: number
  accountId: string
  accountName: string
  accountBalance: number
  shortfall: number
}



export interface TodayPlanInsights {
  unpaidRecurringCount: number
  unpaidRecurringTotal: number
  unpaidEssentialsTotal: number
  nonRecurringEssentialsSpent: number
  nonRecurringEssentialsDailyAverage: number
  projectedEssentialsEndingBalance: number
}

type CategoryLimitStatus = 'OnTrack' | 'Watch' | 'Exceeded'

export interface CategoryLimitProgress {
  category: string
  limit: number
  spent: number
  remaining: number
  pendingCommitted: number
  projectedSpend: number
  percentUsed: number
  status: CategoryLimitStatus
}

interface CycleSummaryInsights {
  largestExpenseDescription?: string
  largestExpenseAmount?: number
  biggestDayDate?: string
  biggestDayTotal?: number
  avgDailySpend?: number
  cycleLengthDays: number
  velocityFirstHalf?: number
  velocitySecondHalf?: number
  noSpendDays: number
  transactionCount: number
  committedSpend: number
  discretionarySpend: number
}

// What api.fetchDashboard actually returns before loadAll() merges in DashboardInsights --
// everything DashboardData has except the fields that moved to the insights fetch.
export type DashboardCore = Omit<DashboardData, 'last3CategoryBreakdown' | 'last6CategoryBreakdown' | 'yearlyCategoryBreakdown' | 'availableYears' | 'stats'> & {
  stats: Omit<DashboardStats, 'pastThreeMonthsRewardsAverage' | 'hasRewardsHistory'>
  cycleSummaryInsights?: CycleSummaryInsights
}

// The expensive historical aggregates, fetched separately via api.fetchDashboardInsights and
// merged into a full DashboardData in App.tsx's loadAll() -- see WireDashboardInsights.
export interface DashboardInsights {
  last3CategoryBreakdown: CategoryBreakdown[]
  last6CategoryBreakdown: CategoryBreakdown[]
  yearlyCategoryBreakdown: CategoryBreakdown[]
  pastThreeMonthsRewardsAverage: number
  hasRewardsHistory: boolean
  availableYears: number[]
}
