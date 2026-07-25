export const APP_TABS = ['dashboard', 'reports', 'recurring', 'ledger', 'wishlist', 'drafts', 'settings', 'investments'] as const
export type AppTab = typeof APP_TABS[number]

export type InvestmentRange = '1m' | '3m' | '6m' | '1y' | 'all'
export type InvestmentInstrumentType = 'Stock' | 'ETF' | 'MutualFund'
export type InvestmentAllocationSleeve = 'USEquity' | 'InternationalExUS' | 'Bonds'
export type InvestmentAllocationStatus = 'NotStarted' | 'Incomplete' | 'OnTrack' | 'Watch' | 'Alert'
export type InvestmentTransactionType =
  | 'OpeningPosition' | 'Buy' | 'Sell' | 'Dividend' | 'FeeTax'
  | 'Split' | 'TransferIn' | 'TransferOut'

export interface InvestmentAccount {
  id: string
  name: string
  baseCurrency: string
  isArchived: boolean
  createdAt: string
  updatedAt: string
  canDelete?: boolean
  canArchive?: boolean
  archiveUnavailableReason?: string
  isPendingSync?: boolean
  isPendingDelete?: boolean
}

export interface InvestmentInstrument {
  id: string
  symbol: string
  name: string
  type: InvestmentInstrumentType
  exchange?: string
  mic?: string
  country?: string
  currency: string
  providerSymbol?: string
  providerMic?: string
  isCustom: boolean
  isArchived: boolean
  allocationSleeve?: InvestmentAllocationSleeve
  canDelete?: boolean
  canArchive?: boolean
  archiveUnavailableReason?: string
  isPendingSync?: boolean
  isPendingDelete?: boolean
}

export interface InvestmentActivity {
  id: string
  accountId: string
  instrumentId: string
  type: InvestmentTransactionType
  tradeDate: string
  units: number
  unitPrice?: number
  cashAmount?: number
  fees: number
  taxes: number
  linkedTransferId?: string
  isPairedTransfer?: boolean
  createdAt: string
  isPendingSync?: boolean
  isPendingDelete?: boolean
}

interface InvestmentHolding {
  accountId: string
  accountName: string
  instrumentId: string
  symbol: string
  name: string
  type: InvestmentInstrumentType
  currency: string
  units: number
  averageCostNative: number
  latestPriceNative?: number
  valueNative?: number
  valueApp?: number
  dailyChangeApp?: number
  unrealisedProfitLossApp?: number
  unrealisedPercent?: number
  priceDate?: string
  priceFetchedAt?: string
  usesManualPrice: boolean
  fxIncomplete: boolean
  fxRate?: number
  fxDate?: string
  fxSource?: string
  priceSource?: string
  valuationAsOf?: string
}

type InvestmentCashFlowType = 'Deposit' | 'Withdrawal' | 'Conversion'

interface InvestmentCashBalance {
  accountId: string
  accountName: string
  currency: string
  amount: number
  amountApp?: number
}

export interface InvestmentCashFlow {
  id: string
  accountId: string
  currency: string
  type: InvestmentCashFlowType
  amount: number
  // Conversions only: the currency bought and its amount.
  toCurrency?: string
  toAmount?: number
  date: string
  createdAt?: string
  isPendingSync?: boolean
  isPendingDelete?: boolean
}

export interface InvestmentPortfolio {
  appCurrency: string
  usdRate?: number
  summary: {
    growthLedgerBalance: number
    growthContributions?: number
    netDeposits?: number
    marketValue?: number
    costBasis?: number
    unrealisedProfitLoss?: number
    unrealisedPercent?: number
    realisedProfitLoss?: number
    netDividends?: number
    dailyChange?: number
    cashValue?: number
    totalValue?: number
  }
  accounts: InvestmentAccount[]
  instruments: InvestmentInstrument[]
  holdings: InvestmentHolding[]
  /** Loaded separately by the paged activity endpoint; retained for cache compatibility. */
  activity: InvestmentActivity[]
  manualPrices: Array<{ id: string; instrumentId: string; marketDate: string; price: number }>
  chart: Array<{ date: string; totalValue?: number; netDeposits?: number }>
  cashBalances: InvestmentCashBalance[]
  /** Loaded separately by the paged cash-flow endpoint; retained for cache compatibility. */
  cashFlows: InvestmentCashFlow[]
  activityCount?: number
  cashFlowCount?: number
  insights: string[]
  warnings: string[]
  pricesUpdatedAt?: string
  marketDataConfigured: boolean
  allocation: InvestmentAllocationOverview
}

export interface InvestmentPlan {
  id?: string
  usEquityTarget: number
  internationalExUsTarget: number
  bondsTarget: number
  watchDrift: number
  alertDrift: number
  updatedAt?: string
}

export interface InvestmentAllocationOverview {
  status: InvestmentAllocationStatus
  appCurrency: string
  plan: InvestmentPlan
  assignments: Array<{
    instrumentId: string
    symbol: string
    name: string
    sleeve?: InvestmentAllocationSleeve
  }>
  sleeves: Array<{
    sleeve: InvestmentAllocationSleeve
    label: string
    targetPercentage: number
    currentPercentage?: number
    value?: number
    driftPercentagePoints?: number
    driftAmount?: number
    status: InvestmentAllocationStatus
  }>
  recommendations: Array<{
    priority: number
    kind: 'UseCash' | 'TopUp' | 'Buy' | 'Sell' | 'TransferBuy'
    sleeve?: InvestmentAllocationSleeve
    amount: number
    message: string
  }>
  incompleteReasons: string[]
  freshness: {
    asOf?: string
    isStale: boolean
    hasMissingData: boolean
    maxAgeMinutes: number
    staleInputs: string[]
  }
  investedValue?: number
  availableCash: number
  minimumContribution?: number
}

export interface Transaction {
  id: string
  date: string
  postedAt?: string
  description: string
  category: string
  ledgerCategory: string
  amount: number // Positive for inflow, negative for outflow
  isPendingSync?: boolean
  // Set locally while a delete op for this record is still queued/in-flight in the outbox.
  isPendingDelete?: boolean
  // Set when this transaction was generated by confirming a recurring payment's bill.
  // Persists even after the originating RecurringPayment is deleted, so historical
  // cycles can still be identified as subscription payments.
  recurringPaymentId?: string | null
  recurringOccurrenceDate?: string | null
  // Set when this transaction was generated by purchasing a wishlist item.
  wishlistItemId?: number | null
}

export type RecurringFrequency = 'Monthly' | 'Annually'

// 'Once' sends a single reminder `leadDays` before the due date; 'Daily' sends one every day
// from `leadDays` before the due date through the due date itself.
export type RecurringReminderMode = 'Once' | 'Daily'

export interface RecurringPayment {
  id: string
  name: string
  amount: number
  frequency: RecurringFrequency
  category: string
  ledgerCategory: string
  nextDueDate: string
  dueDate: number // Day of month (1-31)
  startDate: string // Date (yyyy-MM-dd)
  active: boolean
  endDate?: string
  isPendingSync?: boolean
  // Set locally while a delete op for this record is still queued/in-flight in the outbox.
  isPendingDelete?: boolean
  // Per-subscription push reminder configuration. Undefined/false means the reminder is off --
  // new and previously-migrated subscriptions default to off (opt-in only).
  reminderEnabled?: boolean
  reminderMode?: RecurringReminderMode
  reminderLeadDays?: number
}

// Server-side state of the global "Push Payment Reminders" feature for the current device.
export interface PushStatus {
  enabled: boolean
  deviceRegistered: boolean
}

export interface RecurringReminderSettings {
  enabled: boolean
  mode: RecurringReminderMode
  leadDays: number
}

// Returned by pay-early: the ledger transaction it posted plus the occurrence date it settled,
// so the caller can advance the subscription's own local nextDueDate without a full reload.
export interface PayEarlyResult {
  transaction: Transaction
  settledOccurrenceDate: string
  nextOccurrenceDate?: string | null
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
  darkMode: boolean | null
  hideSensitive: boolean
  stabilityOverflowRedirect?: string
  currency?: string
  // Current-cycle key ("yyyy-MM") the user last acknowledged an end-of-cycle summary for.
  // Null/undefined means they've never seen one. Drives the once-per-cycle summary trigger.
  lastSummaryCycleSeen?: string | null
}

export interface CategorySummary {
  name: string
  allocation: number
  target: number
  budget: number
  netChange: number
  // Actual outflows assigned to this envelope during the selected cycle. Unlike netChange this
  // excludes allocated income and transfers between envelopes.
  spent?: number
  remaining: number
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

export interface ActiveRecurringPayment {
  id: string
  recurringPaymentId: string
  name: string
  amount: number
  category: string
  ledgerCategory: string
  dueDate: string
  dueDay?: number
  isPaid: boolean
  isDiscarded: boolean
  status: "Pending" | "Paid" | "Discarded"
  paidDate?: string | null
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

export interface TransactionCategory {
  id: string
  name: string
  cycleLimit?: number | null
  isPendingSync?: boolean
  // Set locally while a delete op for this record is still queued/in-flight in the outbox.
  isPendingDelete?: boolean
}

export interface AutocompleteSuggestion {
  description: string
  category: string
  ledgerCategory: string
  txType: "inflow" | "outflow"
}

export interface WishlistItem {
  id: number
  name: string
  price: number
  priority: string // High, Medium, Low
  isPurchased: boolean
  purchasedAt?: string
  purchaseTransactionId?: string | null
  createdAt: string
  isActive: boolean
  isPendingSync?: boolean
  // Set locally while a delete op for this record is still queued/in-flight in the outbox.
  isPendingDelete?: boolean
}

export interface QuestionAnswerDto {
  questionId: number
  answer: string
}

export interface SecurityQuestion {
  questionId: number
  question: string
}

export interface SecurityQuestionsRecoveryStartResponse {
  username: string
  questions: SecurityQuestion[]
}
