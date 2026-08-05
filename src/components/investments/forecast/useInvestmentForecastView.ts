import { useEffect, useMemo, useState } from 'react'
import type { InvestmentPortfolio } from '../../../types'
import {
  FORECAST_ASSUMPTIONS,
  FORECAST_DEFAULT_YEARS,
  FORECAST_MAX_MONTHLY_CONTRIBUTION,
  FORECAST_MAX_TARGET,
  buildForecastModel,
  contributionsInTodayMoney,
  inflationFactor,
  medianCompoundValue,
  niceCeiling,
  toTodayMoney,
} from '../../../lib/investmentForecast'
import { useInvestmentForecast } from './useInvestmentForecast'

/**
 * All forecast state and derived figures. Nothing here is persisted and nothing
 * reaches the server: the panel is a what-if surface over the stored portfolio.
 *
 * The target is `null` until the user asks for one. A guessed target would draw a
 * line the user never chose and, because the target shares the chart's y-scale,
 * would squash the real forecast to make room for an invented number.
 */
export function useInvestmentForecastView(portfolio: InvestmentPortfolio, nearViewport: boolean) {
  const startValue = Math.max(0, portfolio.summary.totalValue ?? 0)
  const observedContribution = Math.max(
    0,
    portfolio.allocation.contributionPlan?.routineContribution ?? 0,
  )
  const model = useMemo(
    () => buildForecastModel(portfolio.allocation.plan),
    [
      portfolio.allocation.plan.usEquityTarget,
      portfolio.allocation.plan.internationalExUsTarget,
      portfolio.allocation.plan.bondsTarget,
    ],
  )

  const [years, setYears] = useState(FORECAST_DEFAULT_YEARS)
  const [monthlyContribution, setMonthlyContributionState] = useState(
    Math.min(observedContribution, FORECAST_MAX_MONTHLY_CONTRIBUTION),
  )
  const [inflationPercent, setInflationPercent] = useState(FORECAST_ASSUMPTIONS.defaultInflation * 100)
  const [todayMoney, setTodayMoney] = useState(false)
  const [targetToday, setTargetToday] = useState<number | null>(null)

  const inflation = inflationPercent / 100
  const targetFactor = inflationFactor(inflation, years)
  const targetMaxToday = FORECAST_MAX_TARGET / targetFactor
  const targetNominal = targetToday === null ? null : Math.min(targetToday, targetMaxToday) * targetFactor

  useEffect(() => {
    setTargetToday(current => current === null ? null : Math.min(current, targetMaxToday))
  }, [targetMaxToday])

  const request = useMemo(() => ({
    startValue,
    monthlyContribution,
    horizonYears: years,
    // With no target the worker's target answers are unused, so 0 keeps the
    // message contract fixed instead of branching the worker on absence.
    targetValue: targetNominal ?? 0,
  }), [startValue, monthlyContribution, years, targetNominal])
  const forecast = useInvestmentForecast(model, request, nearViewport && startValue > 0)

  const displayedPoints = useMemo(() => forecast.result?.points.map(point => todayMoney ? {
    ...point,
    lower: toTodayMoney(point.lower, inflation, point.year),
    median: toTodayMoney(point.median, inflation, point.year),
    upper: toTodayMoney(point.upper, inflation, point.year),
  } : point) ?? [], [forecast.result, inflation, todayMoney])
  const displayedTarget = targetToday === null ? null : todayMoney ? Math.min(targetToday, targetMaxToday) : targetNominal
  const endingFactor = todayMoney ? targetFactor : 1
  const displayedEnding = forecast.result ? forecast.result.ending.median / endingFactor : undefined
  const displayedFutureContributions = forecast.result
    ? todayMoney
      ? contributionsInTodayMoney(monthlyContribution, inflation, years)
      : forecast.result.futureContributions
    : undefined
  const displayedGrowth = displayedEnding === undefined || displayedFutureContributions === undefined
    ? undefined
    : displayedEnding - startValue - displayedFutureContributions
  const displayedLower = forecast.result
    ? toTodayMoney(forecast.result.ending.lower, todayMoney ? inflation : 0, years)
    : undefined
  const displayedUpper = forecast.result
    ? toTodayMoney(forecast.result.ending.upper, todayMoney ? inflation : 0, years)
    : undefined

  const suggestedTargetToday = () => {
    const nominal = niceCeiling(forecast.result?.ending.median
      ?? medianCompoundValue(startValue, monthlyContribution, years, model.annualReturn))
    return nominal / targetFactor
  }
  const targetMax = todayMoney ? targetMaxToday : FORECAST_MAX_TARGET
  const targetStep = 50_000
  const requiredContribution = forecast.result?.requiredMonthlyContribution ?? 0
  const contributionMax = FORECAST_MAX_MONTHLY_CONTRIBUTION

  return {
    model,
    forecast,
    startValue,
    years,
    setYears,
    monthlyContribution,
    setMonthlyContribution: (value: number) => setMonthlyContributionState(
      Math.max(0, Math.min(FORECAST_MAX_MONTHLY_CONTRIBUTION, value)),
    ),
    contributionMax,
    contributionStep: 100,
    inflationPercent,
    setInflationPercent,
    todayMoney,
    setTodayMoney,
    hasTarget: targetToday !== null,
    displayedPoints,
    displayedTarget,
    displayedEnding,
    displayedFutureContributions,
    displayedGrowth,
    displayedLower,
    displayedUpper,
    targetMax,
    targetStep,
    requiredContribution,
    addTarget: () => setTargetToday(Math.min(suggestedTargetToday(), targetMaxToday)),
    removeTarget: () => setTargetToday(null),
    /** Slider values are in whichever money view is showing; state stays in today's money. */
    setDisplayedTarget: (value: number) => setTargetToday(Math.max(
      0,
      Math.min(targetMaxToday, todayMoney ? value : value / targetFactor),
    )),
    tryRequiredAmount: () => {
      if (!Number.isFinite(requiredContribution)) return
      setMonthlyContributionState(Math.max(
        0,
        Math.min(FORECAST_MAX_MONTHLY_CONTRIBUTION, requiredContribution),
      ))
    },
  }
}
