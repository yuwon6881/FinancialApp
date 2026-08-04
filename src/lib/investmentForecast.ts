import type { InvestmentPlan } from '../types'

export const FORECAST_MIN_YEARS = 5
export const FORECAST_MAX_YEARS = 50
export const FORECAST_DEFAULT_YEARS = 10
export const FORECAST_PATHS = 10_000

export interface ForecastAssetAssumption {
  key: 'USEquity' | 'InternationalExUS' | 'Bonds'
  label: string
  annualReturn: number
  annualVolatility: number
}

export interface ForecastAssumptionSet {
  id: string
  defaultInflation: number
  assets: ForecastAssetAssumption[]
}

export interface ForecastModel {
  annualReturn: number
  annualVolatility: number
  weights: Record<ForecastAssetAssumption['key'], number>
  assumptionId: string
}

export interface ForecastCoefficients {
  paths: number
  years: number
  growth: Float64Array
  contribution: Float64Array
}

export interface ForecastPoint {
  year: number
  lower: number
  median: number
  upper: number
}

export interface ForecastResult {
  points: ForecastPoint[]
  ending: ForecastPoint
  futureContributions: number
  estimatedGrowth: number
  requiredMonthlyContribution: number
  targetChance: number
}

export const FORECAST_ASSUMPTIONS: ForecastAssumptionSet = {
  id: 'vanguard-vcmm-2026-q2',
  defaultInflation: 0.02,
  assets: [
    { key: 'USEquity', label: 'U.S. shares', annualReturn: 0.052, annualVolatility: 0.151 },
    { key: 'InternationalExUS', label: 'International shares', annualReturn: 0.055, annualVolatility: 0.18 },
    { key: 'Bonds', label: 'Bonds', annualReturn: 0.048, annualVolatility: 0.062 },
  ],
}

export function buildForecastModel(plan: InvestmentPlan): ForecastModel {
  const rawWeights: Record<ForecastAssetAssumption['key'], number> = {
    USEquity: Math.max(0, plan.usEquityTarget),
    InternationalExUS: Math.max(0, plan.internationalExUsTarget),
    Bonds: Math.max(0, plan.bondsTarget),
  }
  const total = Object.values(rawWeights).reduce((sum, value) => sum + value, 0)
  const weights = Object.fromEntries(
    Object.entries(rawWeights).map(([key, value]) => [key, total > 0 ? value / total : 1 / 3]),
  ) as ForecastModel['weights']

  const annualReturn = FORECAST_ASSUMPTIONS.assets.reduce(
    (sum, asset) => sum + weights[asset.key] * asset.annualReturn,
    0,
  )
  // This deliberately gives no credit for diversification. It is a transparent,
  // conservative risk band without inventing a precise long-run correlation matrix.
  const annualVolatility = FORECAST_ASSUMPTIONS.assets.reduce(
    (sum, asset) => sum + weights[asset.key] * asset.annualVolatility,
    0,
  )

  return { annualReturn, annualVolatility, weights, assumptionId: FORECAST_ASSUMPTIONS.id }
}

function mulberry32(seed: number) {
  let value = seed >>> 0
  return () => {
    value += 0x6d2b79f5
    let next = value
    next = Math.imul(next ^ (next >>> 15), next | 1)
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61)
    return ((next ^ (next >>> 14)) >>> 0) / 4_294_967_296
  }
}

function normal(random: () => number) {
  const first = Math.max(Number.EPSILON, random())
  const second = random()
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second)
}

/** A fast variance-normalized mixture with fatter tails than a normal distribution. */
function marketShock(random: () => number) {
  const scale = random() < 0.05 ? 2.5 : 1
  return normal(random) * scale / Math.sqrt(0.95 + 0.05 * 2.5 ** 2)
}

export function generateForecastCoefficients(
  model: ForecastModel,
  paths = FORECAST_PATHS,
  years = FORECAST_MAX_YEARS,
  seed = 0x5f3759df,
): ForecastCoefficients {
  const safePaths = Math.max(1, Math.floor(paths))
  const safeYears = Math.max(1, Math.floor(years))
  const growth = new Float64Array(safePaths * safeYears)
  const contribution = new Float64Array(safePaths * safeYears)
  const random = mulberry32(seed)
  const monthlyDrift = Math.log1p(model.annualReturn) / 12
  const monthlyVolatility = model.annualVolatility / Math.sqrt(12)

  for (let path = 0; path < safePaths; path += 1) {
    let growthFactor = 1
    let contributionFactor = 0
    for (let month = 1; month <= safeYears * 12; month += 1) {
      const returnFactor = Math.exp(monthlyDrift + monthlyVolatility * marketShock(random))
      growthFactor *= returnFactor
      contributionFactor = contributionFactor * returnFactor + 1
      if (month % 12 === 0) {
        const yearIndex = month / 12 - 1
        const index = yearIndex * safePaths + path
        growth[index] = growthFactor
        contribution[index] = contributionFactor
      }
    }
  }

  return { paths: safePaths, years: safeYears, growth, contribution }
}

function swap(values: Float64Array, left: number, right: number) {
  const value = values[left]
  values[left] = values[right]
  values[right] = value
}

/** In-place Quickselect keeps slider work linear instead of sorting every path. */
export function selectKth(values: Float64Array, rank: number) {
  let left = 0
  let right = values.length - 1
  const target = Math.max(0, Math.min(right, Math.floor(rank)))

  while (left < right) {
    const pivot = values[Math.floor((left + right) / 2)]
    let low = left
    let high = right
    while (low <= high) {
      while (values[low] < pivot) low += 1
      while (values[high] > pivot) high -= 1
      if (low <= high) {
        swap(values, low, high)
        low += 1
        high -= 1
      }
    }
    if (target <= high) right = high
    else if (target >= low) left = low
    else break
  }
  return values[target]
}

export function percentile(values: Float64Array, value: number) {
  if (values.length === 0) return 0
  return selectKth(values, Math.round((values.length - 1) * value))
}

export function calculateForecast(
  coefficients: ForecastCoefficients,
  startValue: number,
  monthlyContribution: number,
  horizonYears: number,
  targetValue: number,
): ForecastResult {
  const horizon = Math.max(1, Math.min(coefficients.years, Math.floor(horizonYears)))
  const safeStart = Math.max(0, startValue)
  const safeContribution = Math.max(0, monthlyContribution)
  const points: ForecastPoint[] = [{ year: 0, lower: safeStart, median: safeStart, upper: safeStart }]
  let endingValues = new Float64Array(coefficients.paths)

  for (let year = 1; year <= horizon; year += 1) {
    const offset = (year - 1) * coefficients.paths
    const values = new Float64Array(coefficients.paths)
    for (let path = 0; path < coefficients.paths; path += 1) {
      values[path] = safeStart * coefficients.growth[offset + path]
        + safeContribution * coefficients.contribution[offset + path]
    }
    if (year === horizon) endingValues = values.slice()
    points.push({
      year,
      lower: percentile(values.slice(), 0.1),
      median: percentile(values.slice(), 0.5),
      upper: percentile(values, 0.9),
    })
  }

  const ending = points[points.length - 1]
  const offset = (horizon - 1) * coefficients.paths
  const required = new Float64Array(coefficients.paths)
  let reached = 0
  for (let path = 0; path < coefficients.paths; path += 1) {
    if (endingValues[path] >= targetValue) reached += 1
    const contributionFactor = coefficients.contribution[offset + path]
    required[path] = contributionFactor <= 0
      ? Number.POSITIVE_INFINITY
      : Math.max(0, (targetValue - safeStart * coefficients.growth[offset + path]) / contributionFactor)
  }
  const futureContributions = safeContribution * horizon * 12

  return {
    points,
    ending,
    futureContributions,
    estimatedGrowth: ending.median - safeStart - futureContributions,
    requiredMonthlyContribution: percentile(required, 0.5),
    targetChance: reached / coefficients.paths,
  }
}

export function medianCompoundValue(
  startValue: number,
  monthlyContribution: number,
  years: number,
  annualReturn: number,
) {
  const monthlyRate = Math.expm1(Math.log1p(annualReturn) / 12)
  const months = Math.max(0, Math.floor(years * 12))
  const growth = (1 + monthlyRate) ** months
  const contributions = monthlyRate === 0 ? months : (growth - 1) / monthlyRate
  return Math.max(0, startValue) * growth + Math.max(0, monthlyContribution) * contributions
}

export const inflationFactor = (annualInflation: number, years: number) =>
  (1 + Math.max(0, annualInflation)) ** Math.max(0, years)

export const toTodayMoney = (value: number, annualInflation: number, years: number) =>
  value / inflationFactor(annualInflation, years)

export function niceCeiling(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const normalized = value / magnitude
  const factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10
  return factor * magnitude
}

export function niceStep(maximum: number, divisions = 100) {
  const raw = maximum / divisions
  if (!Number.isFinite(raw) || raw <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const normalized = raw / magnitude
  const factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10
  return factor * magnitude
}
