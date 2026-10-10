import { useEffect, useRef, useState } from 'react'
import type { InvestmentPortfolio } from '../../../types'
import { formatCurrencyVal } from '../../../lib/utils'
import { BottomSheet } from '../../ui/BottomSheet'
import { LineChart } from 'lucide-react'
import { ForecastControls } from './ForecastControls'
import { ForecastSummary } from './ForecastSummary'
import { ForecastTargetSection } from './ForecastTargetSection'
import { InvestmentForecastChart } from './InvestmentForecastChart'
import { useInvestmentForecastView } from './useInvestmentForecastView'
import { InvestmentToolRow } from '../InvestmentToolRow'

const mask = '••••'

function percentage(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

export function InvestmentForecastPanel({ portfolio, masked }: {
  portfolio: InvestmentPortfolio
  masked: boolean
}) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const initialFocusRef = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  // The 10,000-path model is only worth building once the panel is close to view.
  const [nearViewport, setNearViewport] = useState(false)
  const view = useInvestmentForecastView(portfolio, nearViewport)
  const { forecast, model } = view

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
  }, [view.startValue])

  const money = (value: number) => masked ? mask : formatCurrencyVal(value, portfolio.appCurrency)
  const calculatedMoney = (value: number | undefined) => value === undefined ? 'Calculating…' : money(value)

  if (view.startValue <= 0) {
    return (
      <InvestmentToolRow
        icon={<LineChart className="size-4" />}
        title="Investment forecast"
        titleId="forecast-title"
        subtitle="A complete current portfolio value is needed to calculate this."
      />
    )
  }

  return (
    <>
      <InvestmentToolRow
        ref={triggerRef}
        icon={<LineChart className="size-4" />}
        title="Investment forecast"
        titleId="forecast-title"
        subtitle="Where today’s portfolio and a monthly amount could go"
        onClick={() => setIsOpen(true)}
        expanded={isOpen}
      />

      <BottomSheet
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Investment forecast"
        maxWidthClassName="max-w-4xl"
        initialFocusRef={initialFocusRef}
      >
        <div ref={initialFocusRef} tabIndex={-1} className="min-w-0 outline-none">
          <ForecastSummary
            years={view.years}
            ending={view.displayedEnding}
            lower={view.displayedLower}
            upper={view.displayedUpper}
            startValue={view.startValue}
            futureContributions={view.displayedFutureContributions}
            growth={view.displayedGrowth}
            todayMoney={view.todayMoney}
            money={calculatedMoney}
          />

          <div className="mt-5">
            <ForecastControls
              years={view.years}
              onYearsChange={view.setYears}
              monthlyContribution={view.monthlyContribution}
              onMonthlyContributionChange={view.setMonthlyContribution}
              contributionMax={view.contributionMax}
              contributionStep={view.contributionStep}
              todayMoney={view.todayMoney}
              onTodayMoneyChange={view.setTodayMoney}
              inflationPercent={view.inflationPercent}
              onInflationPercentChange={view.setInflationPercent}
              masked={masked}
              money={money}
            />
          </div>

          {forecast.error ? (
            <p role="alert" className="mt-5 rounded-control bg-destructive/8 p-3 text-caption text-destructive">{forecast.error}</p>
          ) : view.displayedPoints.length > 0 ? (
            <InvestmentForecastChart points={view.displayedPoints} target={view.displayedTarget} currency={portfolio.appCurrency} masked={masked} />
          ) : (
            <div role="status" className="mt-5 flex h-48 items-center justify-center text-caption text-muted-foreground">Preparing possible paths…</div>
          )}

          <ForecastTargetSection
            target={view.displayedTarget}
            onAdd={view.addTarget}
            onRemove={view.removeTarget}
            onChange={view.setDisplayedTarget}
            targetMax={view.targetMax}
            targetStep={view.targetStep}
            years={view.years}
            targetChance={forecast.result?.targetChance}
            requiredContribution={forecast.result ? view.requiredContribution : undefined}
            maxMonthlyContribution={view.contributionMax}
            onUseRequiredAmount={view.tryRequiredAmount}
            isCalculating={!forecast.result}
            masked={masked}
            money={money}
          />

          <details className="mt-3 rounded-control bg-surface-2/70 p-3">
            <summary className="cursor-pointer text-label font-medium text-foreground">How this forecast was worked out</summary>
            <div className="mt-3 space-y-2 text-caption leading-relaxed text-muted-foreground">
              <p>It tests 10,000 outcomes using your plan. The model uses {percentage(model.annualReturn)} average annual growth and about {percentage(model.annualVolatility)} annual variation. Past returns are context, not a promise.</p>
              <p>Growth and variation come from a published long-term capital-markets model, not your history. It follows today’s portfolio and plan, adding deposits at month-end.</p>
              <p>Results are hypothetical, not guaranteed, and exclude future tax, expenses, and exchange-rate changes.</p>
              {forecast.initializationMs !== null && <p className="sr-only">The forecast paths were prepared in {Math.round(forecast.initializationMs)} milliseconds.</p>}
            </div>
          </details>
        </div>
      </BottomSheet>
    </>
  )
}
