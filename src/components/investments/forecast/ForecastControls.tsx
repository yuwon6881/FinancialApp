import { FORECAST_MAX_YEARS, FORECAST_MIN_YEARS } from '../../../lib/investmentForecast'
import { FormField } from '../../ui/FormField'
import { PillSwitch } from '../../ui/PillSwitch'
import { RangeInput } from '../../ui/RangeInput'

/** The two questions that shape the forecast, plus how to read the amounts. */
export function ForecastControls({
  years,
  onYearsChange,
  monthlyContribution,
  onMonthlyContributionChange,
  contributionMax,
  contributionStep,
  todayMoney,
  onTodayMoneyChange,
  inflationPercent,
  onInflationPercentChange,
  masked,
  money,
}: {
  years: number
  onYearsChange: (value: number) => void
  monthlyContribution: number
  onMonthlyContributionChange: (value: number) => void
  contributionMax: number
  contributionStep: number
  todayMoney: boolean
  onTodayMoneyChange: (value: boolean) => void
  inflationPercent: number
  onInflationPercentChange: (value: number) => void
  masked: boolean
  money: (value: number) => string
}) {
  return (
    <div className="space-y-5 rounded-2xl border border-border/50 bg-muted/15 p-4">
      <FormField
        label={<span className="flex justify-between gap-3"><span>Years ahead</span><strong className="text-foreground">{years} years</strong></span>}
        hint="More years mean a wider outcome range."
      >
        <RangeInput aria-label="Forecast years" min={FORECAST_MIN_YEARS} max={FORECAST_MAX_YEARS} step={1} value={years} disabled={masked} onChange={event => onYearsChange(Number(event.target.value))} />
      </FormField>
      <FormField
        label={<span className="flex justify-between gap-3"><span>Monthly contribution</span><strong className="text-foreground">{money(monthlyContribution)}</strong></span>}
        hint={`${money(monthlyContribution * 12)} a year; for planning only.`}
      >
        <RangeInput aria-label="Hypothetical monthly contribution" min={0} max={contributionMax} step={contributionStep} value={Math.min(monthlyContribution, contributionMax)} disabled={masked} onChange={event => onMonthlyContributionChange(Number(event.target.value))} />
      </FormField>
      {years > 30 && (
        <p className="rounded-xl border border-border/60 bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">Years 31–50 use a less certain part of the model.</p>
      )}

      <div className="space-y-3 border-t border-border/50 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold text-foreground">Show in today’s money</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">What this could buy at today’s prices.</p>
          </div>
          <PillSwitch checked={todayMoney} onChange={onTodayMoneyChange} ariaLabel="Show in today’s money" disabled={masked} />
        </div>
        {/* The inflation slider only means anything to the today's-money view, so it
            appears with it instead of sitting on screen unexplained. */}
        {todayMoney && (
          <FormField
            label={<span className="flex justify-between gap-3"><span>Prices rise by</span><strong className="text-foreground">{inflationPercent.toFixed(1)}% a year</strong></span>}
            hint="Affects today’s-money figures only."
          >
            <RangeInput aria-label="Forecast inflation estimate" min={0} max={10} step={0.1} value={inflationPercent} disabled={masked} onChange={event => onInflationPercentChange(Number(event.target.value))} />
          </FormField>
        )}
      </div>
    </div>
  )
}
