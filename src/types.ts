export interface Transaction {
  id: string
  date: string
  description: string
  category: string
  ledgerCategory: string
  amount: number // Positive for inflow, negative for outflow
}

export interface RecurringPayment {
  id: string
  name: string
  amount: number
  frequency: "Weekly" | "Monthly" | "Annually"
  category: string
  ledgerCategory: string
  nextDueDate: string
  dueDate: number // Day of month (1-31)
  startDate: string // Date (yyyy-MM-dd)
  active: boolean
  endDate?: string
}

export interface FinancialSetting {
  targetStabilityFund: number
  selectedMonth: string
  selectedYear: number
  essentialsAlloc: number
  growthAlloc: number
  stabilityAlloc: number
  rewardsAlloc: number
  cycleDay: number
  darkMode: boolean
}

export interface CategorySummary {
  name: string
  allocation: number
  target: number
  budget: number
  netChange: number
  remaining: number
}

export interface DashboardStats {
  totalBalance: number
  monthlyIncome: number
  monthlyInflow: number
  monthlyExpenses: number
  activeRecurringTotal: number
  growthPercentAchieved: number
  essentialsPercentRemaining: number
  stabilityPercentReached: number
}

export interface ActiveRecurringPayment {
  id: string
  name: string
  amount: number
  category: string
  ledgerCategory: string
  dueDate: string
}

export interface TrendPoint {
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
  recentTransactions: Transaction[]
  activeRecurringPayments: ActiveRecurringPayment[]
  trendPoints: TrendPoint[]
  last3TrendPoints: TrendPoint[]
  last6TrendPoints: TrendPoint[]
  pendingNotifications: PendingNotification[]
  dismissedNotifications: PendingNotification[]
  monthlyCategoryBreakdown: CategoryBreakdown[]
  last3CategoryBreakdown: CategoryBreakdown[]
  last6CategoryBreakdown: CategoryBreakdown[]
  yearlyCategoryBreakdown: CategoryBreakdown[]
}

export interface TransactionCategory {
  id: string
  name: string
}
