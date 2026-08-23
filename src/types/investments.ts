export type InvestmentRange = '1m' | '3m' | '6m' | '1y' | '3y' | '5y' | 'all'
export type InvestmentInstrumentType = 'Stock' | 'ETF' | 'MutualFund'
export type InvestmentAllocationSleeve = 'USEquity' | 'InternationalExUS' | 'Bonds'
export type InvestmentAllocationStatus = 'NotStarted' | 'Incomplete' | 'OnTrack' | 'Watch' | 'Alert'
export type InvestmentTransactionType =
  | 'Buy' | 'Sell' | 'Dividend' | 'FeeTax'

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

/** Price history for one fund, loaded on demand when its detail sheet opens. */
export interface InstrumentHistory {
  instrumentId: string
  symbol: string
  name: string
  currency: string
  points: Array<{ date: string; price: number }>
  averageCostNative?: number
  latestPriceNative?: number
  units: number
  firstBoughtOn?: string
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
  marketDataReference?: MarketDataReference
  isCustom: boolean
  isArchived: boolean
  allocationSleeve?: InvestmentAllocationSleeve
  canDelete?: boolean
  canArchive?: boolean
  archiveUnavailableReason?: string
  isPendingSync?: boolean
  isPendingDelete?: boolean
}

export interface MarketDataReference {
  providerId: string
  externalId: string
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
  realisedProfitLossApp?: number
  netDividendsApp?: number
  priceDate?: string
  priceFetchedAt?: string
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
  /** Rate and code of the second currency the plan can be read in; supplied by the API, never assumed. */
  referenceRate?: number
  referenceCurrency?: string
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
    annualReturn?: number
    cashValue?: number
    totalValue?: number
  }
  accounts: InvestmentAccount[]
  instruments: InvestmentInstrument[]
  holdings: InvestmentHolding[]
  /** Loaded separately by the paged activity endpoint; retained for cache compatibility. */
  activity: InvestmentActivity[]
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
    order: number
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
  availableCash?: number
  minimumContribution?: number
  /**
   * How to split all uninvested broker cash plus the next routine Growth deposit.
   * Large deviations raise the amount to the no-sale total required to restore target.
   */
  contributionPlan?: InvestmentContributionPlan
}

export interface InvestmentContributionPlan {
  /** Total cash and new money being split, in the app currency. */
  amount: number
  /** Observed completed-cycle contribution, excluding broker cash and one-time catch-up money. */
  routineContribution?: number
  /** Plain-language explanation of where `amount` came from. */
  basis: string
  /** Completed cycles the median was taken over; 0 when falling back to idle cash. */
  cyclesObserved: number
  /** True when no completed-cycle deposit rhythm was available. */
  isEstimated: boolean
  sleeves: Array<{
    sleeve: InvestmentAllocationSleeve
    label: string
    amount: number
    percentageOfContribution: number
    projectedPercentage: number
    projectedDriftPercentagePoints: number
  }>
}
