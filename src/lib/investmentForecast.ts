import type { InvestmentForecastClass, InvestmentGroup, InvestmentPlan } from '../types'
import { getInvestmentGroups } from './investmentGroups'

export const FORECAST_MIN_YEARS = 5
export const FORECAST_MAX_YEARS = 50
export const FORECAST_DEFAULT_YEARS = 10
const FORECAST_PATHS = 10_000
export const FORECAST_MAX_TARGET = 10_000_000
export const FORECAST_MAX_MONTHLY_CONTRIBUTION = 10_000

export interface ForecastGroupAssumption {
  annualReturn: number
  annualVolatility: number
}

export interface ForecastModel extends ForecastGroupAssumption {
  weights: Record<string, number>
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

export const FORECAST_DEFAULT_INFLATION = 0.02

// Preserve the previous Vanguard VCMM 2026 Q2 inputs for groups with a saved preset.
const legacyAssumptions: Record<InvestmentForecastClass, ForecastGroupAssumption> = {
  USEquity: { annualReturn: 0.052, annualVolatility: 0.151 },
  InternationalExUS: { annualReturn: 0.055, annualVolatility: 0.18 },
  Bonds: { annualReturn: 0.048, annualVolatility: 0.062 },
}

export function forecastGroupAssumption(group: InvestmentGroup, overrides: ReadonlyMap<string, ForecastGroupAssumption>) {
  return overrides.get(group.key) ?? (group.forecastClass ? legacyAssumptions[group.forecastClass] : undefined)
}

export const FORECAST_MIN_RETURN_PERCENT = -99
export const FORECAST_MAX_ASSUMPTION_PERCENT = 100

export function buildForecastModel(
  plan: InvestmentPlan, overrides: ReadonlyMap<string, ForecastGroupAssumption> = new Map(),
): ForecastModel | null {
  const groups = getInvestmentGroups(plan).filter(group => group.targetPercentage > 0)
  const total = groups.reduce((sum, group) => sum + group.targetPercentage, 0)
  if (total === 0) return null

  const weights = Object.fromEntries(groups.map(group => [group.key, group.targetPercentage / total]))
  let annualReturn = 0
  let annualVolatility = 0
  for (const group of groups) {
    const assumption = forecastGroupAssumption(group, overrides)
    if (!assumption) return null
    annualReturn += weights[group.key] * assumption.annualReturn
    // The model gives no diversification credit because group correlations are unknown.
    annualVolatility += weights[group.key] * assumption.annualVolatility
  }
  return { annualReturn, annualVolatility, weights }
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
  const monthlyVolatility = model.annualVolatility / Math.sqrt(12)
  // The published return assumption is an arithmetic expectation. A lognormal
  // path needs the variance correction or volatility silently raises its mean
  // above that assumption.
  const monthlyDrift = Math.log1p(model.annualReturn) / 12 - monthlyVolatility ** 2 / 2

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

function percentile(values: Float64Array, value: number) {
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

/** Present purchasing power of fixed nominal deposits made at each month end. */
export function contributionsInTodayMoney(
  monthlyContribution: number,
  annualInflation: number,
  years: number,
) {
  const months = Math.max(0, Math.floor(years * 12))
  const contribution = Math.max(0, monthlyContribution)
  if (annualInflation <= 0) return contribution * months
  const monthlyInflation = Math.expm1(Math.log1p(annualInflation) / 12)
  return contribution * (1 - (1 + monthlyInflation) ** -months) / monthlyInflation
}

export function niceCeiling(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const normalized = value / magnitude
  const factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10
  return factor * magnitude
}
