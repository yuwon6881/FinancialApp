import { useEffect, useMemo, useRef, useState } from 'react'
import type { InvestmentPortfolio } from '../../types'
import {
  FORECAST_ASSUMPTIONS,
  FORECAST_DEFAULT_YEARS,
  FORECAST_MAX_YEARS,
  FORECAST_MIN_YEARS,
  buildForecastModel,
  inflationFactor,
  medianCompoundValue,
  niceCeiling,
  niceStep,
  toTodayMoney,
} from '../../lib/investmentForecast'
import { formatCurrencyVal } from '../../lib/utils'
import { BottomSheet } from '../ui/BottomSheet'
import { Button } from '../ui/Button'
import { ChevronDown } from 'lucide-react'
import { FormField } from '../ui/FormField'
import { RangeInput } from '../ui/RangeInput'
import { InvestmentForecastChart } from './InvestmentForecastChart'
import { useInvestmentForecast } from './useInvestmentForecast'

const mask = '••••'

function percentage(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

export function InvestmentForecastPanel({ portfolio, masked }: {
  portfolio: InvestmentPortfolio
  masked: boolean
}) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const startValue = Math.max(0, portfolio.summary.totalValue ?? 0)
  const observedContribution = portfolio.allocation.contributionPlan?.isEstimated
    ? 0
    : Math.max(0, portfolio.allocation.contributionPlan?.amount ?? 0)
  const model = useMemo(
    () => buildForecastModel(portfolio.allocation.plan),
    [
      portfolio.allocation.plan.usEquityTarget,
      portfolio.allocation.plan.internationalExUsTarget,
      portfolio.allocation.plan.bondsTarget,
    ],
  )
  const [nearViewport, setNearViewport] = useState(false)
  const [years, setYears] = useState(FORECAST_DEFAULT_YEARS)
  const [monthlyContribution, setMonthlyContribution] = useState(observedContribution)
  const [inflationPercent, setInflationPercent] = useState(FORECAST_ASSUMPTIONS.defaultInflation * 100)
  const [todayMoney, setTodayMoney] = useState(false)
  const initialNominalTarget = niceCeiling(medianCompoundValue(
    startValue,
    observedContribution,
    FORECAST_DEFAULT_YEARS,
    model.annualReturn,
  ))
  const [targetToday, setTargetToday] = useState(
    initialNominalTarget / inflationFactor(FORECAST_ASSUMPTIONS.defaultInflation, FORECAST_DEFAULT_YEARS),
  )
  const inflation = inflationPercent / 100
  const targetFactor = inflationFactor(inflation, years)
  const targetNominal = targetToday * targetFactor

  useEffect(() => {
    const element = triggerRef.current
    if (!element) return
    if (typeof IntersectionObserver === 'undefined') {
      setNearViewport(true)
      return
    }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setNearViewport(true)
        observer.disconnect()
      }
    }, { rootMargin: '600px' })
    observer.observe(element)
    return () => observer.disconnect()
  }, [startValue])

  const request = useMemo(() => ({
    startValue,
    monthlyContribution,
    horizonYears: years,
    targetValue: targetNominal,
  }), [startValue, monthlyContribution, years, targetNominal])
  const forecast = useInvestmentForecast(model, request, nearViewport && startValue > 0)

  const displayedPoints = useMemo(() => forecast.result?.points.map(point => todayMoney ? {
    ...point,
    lower: toTodayMoney(point.lower, inflation, point.year),
    median: toTodayMoney(point.median, inflation, point.year),
    upper: toTodayMoney(point.upper, inflation, point.year),
  } : point) ?? [], [forecast.result, inflation, todayMoney])
  const displayedTarget = todayMoney ? targetToday : targetNominal
  const endingFactor = todayMoney ? targetFactor : 1
  const displayedEnding = forecast.result ? forecast.result.ending.median / endingFactor : undefined
  const displayedFutureContributions = forecast.result
    ? forecast.result.futureContributions / endingFactor
    : undefined
  const displayedGrowth = displayedEnding === undefined || displayedFutureContributions === undefined
    ? undefined
    : displayedEnding - startValue - displayedFutureContributions
  const resultMedianToday = forecast.result
    ? toTodayMoney(forecast.result.ending.median, inflation, years)
    : toTodayMoney(initialNominalTarget, inflation, years)
  const targetMaxToday = niceCeiling(Math.max(startValue * 10, resultMedianToday * 2, targetToday * 1.25))
  const targetMax = todayMoney ? targetMaxToday : targetMaxToday * targetFactor
  const targetStep = niceStep(targetMax, 200)
  const requiredContribution = forecast.result?.requiredMonthlyContribution ?? 0
  const contributionMax = niceCeiling(Math.max(
    observedContribution * 3,
    startValue / 12,
    monthlyContribution,
    requiredContribution * 1.25,
  ))
  const contributionStep = niceStep(contributionMax)
  const money = (value: number) => masked ? mask : formatCurrencyVal(value, portfolio.appCurrency)
  const calculatedMoney = (value: number | undefined) => value === undefined ? 'Calculating…' : money(value)

  const setDisplayedTarget = (value: number) => {
    setTargetToday(todayMoney ? value : value / targetFactor)
  }
  const tryRequiredAmount = () => {
    if (!Number.isFinite(requiredContribution)) return
    setMonthlyContribution(Math.max(0, requiredContribution))
  }

  const [isOpen, setIsOpen] = useState(false)

  if (startValue <= 0) {
    return (
      <section aria-labelledby="forecast-title" className="app-panel rounded-2xl border border-border/60 bg-card/92 p-5">
        <h2 id="forecast-title" className="text-base font-bold text-foreground">Investment forecast</h2>
        <p className="mt-2 text-xs text-muted-foreground">A complete current portfolio value is needed before a forecast can be calculated.</p>
      </section>
    )
  }

  return (
    <>
      <Button
        ref={triggerRef}
        variant="unstyled"
        onClick={() => setIsOpen(true)}
        aria-expanded={isOpen}
        className="app-panel group flex w-full cursor-pointer items-center justify-between rounded-2xl border border-border/60 bg-card/92 p-5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <div>
          <h2 id="forecast-title" className="text-base font-bold text-foreground">Investment forecast</h2>
          <p className="mt-1 text-xs text-muted-foreground">Explore possible long-term outcomes without changing any money or recorded activity.</p>
        </div>
        <ChevronDown className="size-4 -rotate-90 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-1 group-hover:text-foreground" />
      </Button>

      <BottomSheet
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Investment forecast"
        description="Explore possible long-term outcomes without changing any money or recorded activity."
        maxWidthClassName="max-w-4xl"
      >
        <div className="min-w-0">
          <div className="space-y-5 rounded-2xl border border-border/50 bg-muted/15 p-4">
            <FormField label={<span className="flex justify-between gap-3"><span>Years ahead</span><strong className="text-foreground">{years} years</strong></span>} hint="Longer forecasts have a wider range of possible outcomes.">
              <RangeInput aria-label="Forecast years" min={FORECAST_MIN_YEARS} max={FORECAST_MAX_YEARS} step={1} value={years} disabled={masked} onChange={event => setYears(Number(event.target.value))} />
            </FormField>
            <FormField label={<span className="flex justify-between gap-3"><span>Monthly contribution</span><strong className="text-foreground">{money(monthlyContribution)}</strong></span>} hint={`${money(monthlyContribution * 12)} a year. This is only a what-if amount.`}>
              <RangeInput aria-label="Hypothetical monthly contribution" min={0} max={contributionMax} step={contributionStep} value={Math.min(monthlyContribution, contributionMax)} disabled={masked} onChange={event => setMonthlyContribution(Number(event.target.value))} />
            </FormField>
            {years > 30 && (
              <p className="rounded-xl border border-border/60 bg-muted/30 p-3 text-[11px] leading-relaxed text-muted-foreground">Years 31–50 extend beyond the research model’s strongest window, so treat this part of the forecast with extra caution.</p>
            )}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <article className="rounded-xl border border-border/50 bg-muted/15 p-3 sm:col-span-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Middle estimate after {years} years</p>
              <strong className="mt-1 block break-words text-xl text-foreground">{calculatedMoney(displayedEnding)}</strong>
              <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                {forecast.result
                  ? `Could reasonably range from ${money(todayMoney ? toTodayMoney(forecast.result.ending.lower, inflation, years) : forecast.result.ending.lower)} to ${money(todayMoney ? toTodayMoney(forecast.result.ending.upper, inflation, years) : forecast.result.ending.upper)}, based on 10,000 simulated paths.`
                  : 'Calculating…'}
              </p>
            </article>
            <article className="rounded-xl border border-border/50 bg-muted/15 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Already in your portfolio</p>
              <strong className="mt-1 block break-words text-base text-foreground">{money(startValue)}</strong>
            </article>
            <article className="rounded-xl border border-border/50 bg-muted/15 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Future deposits — what-if</p>
              <strong className="mt-1 block break-words text-base text-foreground">{calculatedMoney(displayedFutureContributions)}</strong>
            </article>
            <article className="rounded-xl border border-border/50 bg-muted/15 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Estimated market growth</p>
              <strong className="mt-1 block break-words text-base text-foreground">{calculatedMoney(displayedGrowth)}</strong>
            </article>
          </div>

          {forecast.error ? (
            <p role="alert" className="mt-5 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">{forecast.error}</p>
          ) : displayedPoints.length > 0 ? (
            <InvestmentForecastChart points={displayedPoints} target={displayedTarget} currency={portfolio.appCurrency} masked={masked} />
          ) : (
            <div role="status" className="mt-5 flex h-48 items-center justify-center text-xs text-muted-foreground">Preparing possible paths…</div>
          )}

          <details className="mt-5 rounded-xl border border-border/50 bg-muted/15 p-3">
            <summary className="cursor-pointer text-xs font-bold text-foreground">Set a target and fine-tune assumptions</summary>
            <div className="mt-4 space-y-5">
              <div className="flex shrink-0 justify-start rounded-xl bg-muted/40 p-1 sm:w-max" role="group" aria-label="Forecast money view">
                <Button variant="unstyled" onClick={() => setTodayMoney(false)} aria-pressed={!todayMoney} className={`cursor-pointer rounded-lg px-2.5 py-1.5 text-[10px] font-bold ${!todayMoney ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}>Future money</Button>
                <Button variant="unstyled" onClick={() => setTodayMoney(true)} aria-pressed={todayMoney} className={`cursor-pointer rounded-lg px-2.5 py-1.5 text-[10px] font-bold ${todayMoney ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}>Today’s money</Button>
              </div>

              <FormField label={<span className="flex justify-between gap-3"><span>Target amount</span><strong className="text-foreground">{money(displayedTarget)}</strong></span>} hint={`The monthly amount below aims to reach this in the middle simulated outcome after ${years} years.`}>
                <RangeInput aria-label="Forecast target amount" min={0} max={targetMax} step={targetStep} value={Math.min(displayedTarget, targetMax)} disabled={masked} onChange={event => setDisplayedTarget(Number(event.target.value))} />
              </FormField>
              <FormField label={<span className="flex justify-between gap-3"><span>Inflation estimate</span><strong className="text-foreground">{inflationPercent.toFixed(1)}%</strong></span>} hint="Used only for the Today’s money view; it does not change future-money balances.">
                <RangeInput aria-label="Forecast inflation estimate" min={0} max={10} step={0.1} value={inflationPercent} disabled={masked} onChange={event => setInflationPercent(Number(event.target.value))} />
              </FormField>

              <article className="rounded-xl border border-border/50 bg-muted/15 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Chance of reaching your target</p>
                <strong className="mt-1 block break-words text-base text-foreground">{forecast.result ? `${Math.round(forecast.result.targetChance * 100)}%` : 'Calculating…'}</strong>
                <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">The share of simulated paths that reached the selected target using the selected monthly contribution.</p>
              </article>
              <article className="rounded-xl border border-primary/25 bg-primary/5 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Monthly amount for your target</p>
                <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <strong className="block text-xl text-foreground">{forecast.result ? money(requiredContribution) : 'Calculating…'}</strong>
                    <span className="text-[10px] text-muted-foreground">Middle estimate · {forecast.result ? money(requiredContribution * 12) : '—'} a year</span>
                  </div>
                  <Button variant="outline" size="sm" disabled={masked || !forecast.result || !Number.isFinite(requiredContribution)} onClick={tryRequiredAmount}>Try this amount</Button>
                </div>
              </article>
            </div>
          </details>

          <details className="mt-3 rounded-xl border border-border/50 bg-muted/15 p-3">
            <summary className="cursor-pointer text-xs font-bold text-foreground">How this forecast was worked out</summary>
            <div className="mt-3 space-y-2 text-[11px] leading-relaxed text-muted-foreground">
              <p>It tests 10,000 possible outcomes using your investment-plan mix. The estimates use {percentage(model.annualReturn)} average yearly growth and allow for returns to vary by about {percentage(model.annualVolatility)} a year. Your own past return is historical context, not a promise about the future.</p>
              <p>The research source is <a href={FORECAST_ASSUMPTIONS.sourceUrl} target="_blank" rel="noreferrer" className="font-semibold text-primary underline underline-offset-2">{FORECAST_ASSUMPTIONS.sourceName}</a>, dated {FORECAST_ASSUMPTIONS.asOf}. The model assumes today’s portfolio and future deposits follow your plan, with deposits added at month-end.</p>
              <p>These results are hypothetical, may change over time, and are not guaranteed. They exclude future tax, investment expenses, and exchange-rate changes. Read the <span className="font-semibold text-primary">investment-analysis disclosure principles</span>.</p>
              {forecast.initializationMs !== null && <p className="sr-only">The forecast paths were prepared in {Math.round(forecast.initializationMs)} milliseconds.</p>}
            </div>
          </details>
        </div>
      </BottomSheet>
    </>
  )
}
