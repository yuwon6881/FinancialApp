import { useMemo, useState } from 'react'
import type { InvestmentPortfolio } from '../../../types'
import {
  FORECAST_ASSUMPTIONS,
  FORECAST_DEFAULT_YEARS,
  buildForecastModel,
  inflationFactor,
  medianCompoundValue,
  niceCeiling,
  niceStep,
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
  const [monthlyContribution, setMonthlyContribution] = useState(observedContribution)
  const [inflationPercent, setInflationPercent] = useState(FORECAST_ASSUMPTIONS.defaultInflation * 100)
  const [todayMoney, setTodayMoney] = useState(false)
  const [targetToday, setTargetToday] = useState<number | null>(null)

  const inflation = inflationPercent / 100
  const targetFactor = inflationFactor(inflation, years)
  const targetNominal = targetToday === null ? null : targetToday * targetFactor

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
  const displayedTarget = targetToday === null ? null : todayMoney ? targetToday : targetNominal
  const endingFactor = todayMoney ? targetFactor : 1
  const displayedEnding = forecast.result ? forecast.result.ending.median / endingFactor : undefined
  const displayedFutureContributions = forecast.result
    ? forecast.result.futureContributions / endingFactor
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
    const nominal = niceCeiling(medianCompoundValue(startValue, monthlyContribution, years, model.annualReturn))
    return nominal / targetFactor
  }
  const resultMedianToday = forecast.result
    ? toTodayMoney(forecast.result.ending.median, inflation, years)
    : toTodayMoney(suggestedTargetToday() * targetFactor, inflation, years)
  const targetMaxToday = niceCeiling(Math.max(startValue * 10, resultMedianToday * 2, (targetToday ?? 0) * 1.25))
  const targetMax = todayMoney ? targetMaxToday : targetMaxToday * targetFactor
  const targetStep = niceStep(targetMax, 200)
  const requiredContribution = forecast.result?.requiredMonthlyContribution ?? 0
  const contributionMax = niceCeiling(Math.max(
    observedContribution * 3,
    startValue / 12,
    monthlyContribution,
    requiredContribution * 1.25,
  ))

  return {
    model,
    forecast,
    startValue,
    years,
    setYears,
    monthlyContribution,
    setMonthlyContribution,
    contributionMax,
    contributionStep: niceStep(contributionMax),
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
    addTarget: () => setTargetToday(suggestedTargetToday()),
    removeTarget: () => setTargetToday(null),
    /** Slider values are in whichever money view is showing; state stays in today's money. */
    setDisplayedTarget: (value: number) => setTargetToday(todayMoney ? value : value / targetFactor),
    tryRequiredAmount: () => {
      if (!Number.isFinite(requiredContribution)) return
      setMonthlyContribution(Math.max(0, requiredContribution))
    },
  }
}
