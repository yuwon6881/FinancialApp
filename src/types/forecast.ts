export const FORECAST_BUCKETS = ['Essentials', 'Growth', 'Stability', 'Rewards'] as const
export type ForecastBucket = (typeof FORECAST_BUCKETS)[number]

/** A temporary what-if line. `bucket: null` is extra income, split like a salary. */
export interface ForecastScenarioItem {
  id: string
  date: string
  amount: number
  bucket: ForecastBucket | null
  label: string
}

/** Everything the Forecast workspace lets the user change. Never sent to the outbox. */
export interface ForecastScenario {
  cycles: number
  incomePerCycle: number | null
  everydaySpendingPerCycle: number | null
  items: ForecastScenarioItem[]
  skippedBills: string[]
}

export type ForecastBucketAmounts = Record<ForecastBucket, number>

export interface ForecastLine {
  date: string
  label: string
  bucket: ForecastBucket | null
  amount: number
  kind: 'Bill' | 'Scenario'
  sourceId: string | null
}

export interface ForecastCycle {
  start: string
  end: string
  label: string
  isCurrent: boolean
  opening: ForecastBucketAmounts
  moneyIn: ForecastBucketAmounts
  moneyOut: ForecastBucketAmounts
  closing: ForecastBucketAmounts
  lines: ForecastLine[]
  shortBuckets: ForecastBucket[]
  stabilityTargetReached: boolean
}

export interface ForecastSkippedBill {
  date: string
  amount: number
  bucket: ForecastBucket | null
  label: string
  sourceId: string | null
}

export interface CashFlowForecast {
  today: string
  stabilityTarget: number
  skippedBills: ForecastSkippedBill[]
  forecast: {
    cycles: ForecastCycle[]
    incomeKnown: boolean
    everydaySpendingIncluded: boolean
    stabilityTargetReachedOn: string | null
  }
}
