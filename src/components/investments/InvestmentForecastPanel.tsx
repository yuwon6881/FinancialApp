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
  const sectionRef = useRef<HTMLElement>(null)
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
    const element = sectionRef.current
    if (!element || typeof IntersectionObserver === 'undefined') {
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
  }, [])

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
  const displayedEnding = forecast.result ? forecast.result.ending.median / endingFactor : 0
  const displayedFutureContributions = forecast.result
    ? forecast.result.futureContributions / endingFactor
    : 0
  const displayedGrowth = displayedEnding - startValue - displayedFutureContributions
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

  const setDisplayedTarget = (value: number) => {
    setTargetToday(todayMoney ? value : value / targetFactor)
  }
  const tryRequiredAmount = () => {
    if (!Number.isFinite(requiredContribution)) return
    setMonthlyContribution(Math.max(0, requiredContribution))
  }

  if (startValue <= 0) {
    return (
      <section ref={sectionRef} aria-labelledby="forecast-title" className="app-panel rounded-2xl border border-border/60 bg-card/92 p-5">
        <h2 id="forecast-title" className="text-base font-bold text-foreground">Investment forecast</h2>
        <p className="mt-2 text-xs text-muted-foreground">A complete current portfolio value is needed before a forecast can be calculated.</p>
      </section>
    )
  }

  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <Button
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
        <div ref={sectionRef} className="min-w-0">
          <div className="flex shrink-0 justify-end rounded-xl bg-muted/40 p-1 sm:w-max" role="group" aria-label="Forecast money view">

            <Button variant="unstyled" onClick={() => setTodayMoney(false)} aria-pressed={!todayMoney} className={`cursor-pointer rounded-lg px-2.5 py-1.5 text-[10px] font-bold ${!todayMoney ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}>Future money</Button>
            <Button variant="unstyled" onClick={() => setTodayMoney(true)} aria-pressed={todayMoney} className={`cursor-pointer rounded-lg px-2.5 py-1.5 text-[10px] font-bold ${todayMoney ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}>Today’s money</Button>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="space-y-5 rounded-2xl border border-border/50 bg-muted/15 p-4">
          <FormField label={<span className="flex justify-between gap-3"><span>Years ahead</span><strong className="text-foreground">{years} years</strong></span>} hint="Longer forecasts have a wider range of possible outcomes.">
            <RangeInput aria-label="Forecast years" min={FORECAST_MIN_YEARS} max={FORECAST_MAX_YEARS} step={1} value={years} disabled={masked} onChange={event => setYears(Number(event.target.value))} />
          </FormField>
          <FormField label={<span className="flex justify-between gap-3"><span>Monthly contribution</span><strong className="text-foreground">{money(monthlyContribution)}</strong></span>} hint={`${money(monthlyContribution * 12)} a year. This is only a what-if amount.`}>
            <RangeInput aria-label="Hypothetical monthly contribution" min={0} max={contributionMax} step={contributionStep} value={Math.min(monthlyContribution, contributionMax)} disabled={masked} onChange={event => setMonthlyContribution(Number(event.target.value))} />
          </FormField>
          <FormField label={<span className="flex justify-between gap-3"><span>Target amount</span><strong className="text-foreground">{money(displayedTarget)}</strong></span>} hint={`The monthly amount below aims to reach this in the middle simulated outcome after ${years} years.`}>
            <RangeInput aria-label="Forecast target amount" min={0} max={targetMax} step={targetStep} value={Math.min(displayedTarget, targetMax)} disabled={masked} onChange={event => setDisplayedTarget(Number(event.target.value))} />
          </FormField>
          <FormField label={<span className="flex justify-between gap-3"><span>Inflation estimate</span><strong className="text-foreground">{inflationPercent.toFixed(1)}%</strong></span>} hint="Used only for the Today’s money view; it does not change future-money balances.">
            <RangeInput aria-label="Forecast inflation estimate" min={0} max={10} step={0.1} value={inflationPercent} disabled={masked} onChange={event => setInflationPercent(Number(event.target.value))} />
          </FormField>
          {years > 30 && (
            <p className="rounded-xl border border-border/60 bg-muted/30 p-3 text-[11px] leading-relaxed text-muted-foreground">Years 31–50 extend beyond the research model’s strongest window, so treat this part of the forecast with extra caution.</p>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ['Middle estimate', money(displayedEnding), `After ${years} years in ${todayMoney ? 'today’s purchasing power' : 'future money'}.`],
            ['Broad range', forecast.result ? `${money((todayMoney ? toTodayMoney(forecast.result.ending.lower, inflation, years) : forecast.result.ending.lower))} – ${money((todayMoney ? toTodayMoney(forecast.result.ending.upper, inflation, years) : forecast.result.ending.upper))}` : 'Calculating…', 'One in ten simulated outcomes finished below the first figure, and one in ten above the second.'],
            ['Already in your portfolio', money(startValue), 'This starting amount stays fixed when any forecast slider moves.'],
            ['Future deposits — what-if', money(displayedFutureContributions), 'Only deposits after today; no transaction is created.'],
            ['Estimated market growth', money(displayedGrowth), 'The middle estimate after separating the starting value and future deposits.'],
            ['Chance of reaching target', forecast.result ? `${Math.round(forecast.result.targetChance * 100)}%` : 'Calculating…', 'The share of simulated paths that reached the selected target using the selected monthly contribution.'],
          ].map(([label, value, hint]) => (
            <article key={label} className="rounded-xl border border-border/50 bg-muted/15 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
              <strong className="mt-1 block break-words text-base text-foreground">{value}</strong>
              <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{hint}</p>
            </article>
          ))}
          <article className="rounded-xl border border-primary/25 bg-primary/5 p-3 sm:col-span-2">
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
      </div>

      {forecast.error ? (
        <p role="alert" className="mt-5 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">{forecast.error}</p>
      ) : displayedPoints.length > 0 ? (
        <InvestmentForecastChart points={displayedPoints} target={displayedTarget} currency={portfolio.appCurrency} masked={masked} />
      ) : (
        <div role="status" className="mt-5 flex h-48 items-center justify-center text-xs text-muted-foreground">Preparing possible paths…</div>
      )}

        <details className="mt-5 rounded-xl border border-border/50 bg-muted/15 p-3">
          <summary className="cursor-pointer text-xs font-bold text-foreground">How this forecast was worked out</summary>
          <div className="mt-3 space-y-2 text-[11px] leading-relaxed text-muted-foreground">
            <p>It tests 10,000 possible monthly paths using your investment-plan mix. The return assumptions are {percentage(model.annualReturn)} a year with a conservative {percentage(model.annualVolatility)} fluctuation estimate. Your personal yearly return is historical context and is not reused as a promise about the future.</p>
            <p>The assumptions use the midpoints and volatility figures in the <span className="font-semibold text-primary">{FORECAST_ASSUMPTIONS.sourceName}</span>, dated {FORECAST_ASSUMPTIONS.asOf}. The model assumes today’s portfolio and future deposits are invested to your plan, with fixed monthly deposits added at month-end.</p>
            <p>These results are hypothetical, may change over time, and are not guaranteed. They exclude future tax, investment expenses, and exchange-rate changes. Read the <span className="font-semibold text-primary">investment-analysis disclosure principles</span>.</p>
            {forecast.initializationMs !== null && <p className="sr-only">The forecast paths were prepared in {Math.round(forecast.initializationMs)} milliseconds.</p>}
          </div>
        </details>
        </div>
      </BottomSheet>
    </>
  )
}
