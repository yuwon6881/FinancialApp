import { useState, type FormEvent } from 'react'
import type { InvestmentGroup } from '../../../types'
import { FORECAST_MAX_ASSUMPTION_PERCENT, FORECAST_MIN_RETURN_PERCENT, forecastGroupAssumption, type ForecastGroupAssumption } from '../../../lib/investmentForecast'
import { Button } from '../../ui/Button'
import { Input } from '../../ui/Input'

interface Props {
  groups: InvestmentGroup[]
  overrides: ReadonlyMap<string, ForecastGroupAssumption>
  onApply: (assumptions: Map<string, ForecastGroupAssumption>) => void
}

export function ForecastGroupAssumptions({ groups, overrides, onApply }: Props) {
  const [error, setError] = useState('')
  const apply = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const assumptions = new Map<string, ForecastGroupAssumption>()
    for (const { key, label } of groups) {
      const annualReturn = form.elements.namedItem(key + '-return') as HTMLInputElement
      const volatility = form.elements.namedItem(key + '-volatility') as HTMLInputElement
      if (!annualReturn.validity.valid) {
        setError(label + ' needs an annual return from −99% to 100%.')
        annualReturn.focus()
        return
      }
      if (!volatility.validity.valid) {
        setError(label + ' needs annual volatility from 0% to 100%.')
        volatility.focus()
        return
      }
      assumptions.set(key, { annualReturn: annualReturn.valueAsNumber / 100, annualVolatility: volatility.valueAsNumber / 100 })
    }
    setError('')
    onApply(assumptions)
  }

  return (
    <form noValidate onSubmit={apply} onChange={() => setError('')} className="mt-3 space-y-3">
      <p className="text-caption text-muted-foreground">
        Enter an expected annual return and volatility for each group. Volatility describes how much returns can vary.
        These assumptions apply only to this forecast session.
      </p>
      {groups.map(group => {
        const assumption = forecastGroupAssumption(group, overrides)
        return (
          <fieldset key={group.key} className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
            <legend className="mb-1 max-w-full wrap-anywhere text-label text-foreground">{group.label} · {group.targetPercentage}% target</legend>
            <label className="grid min-w-0 gap-1 text-caption text-muted-foreground">
              Annual return (%)
              <Input name={group.key + '-return'} aria-label={group.label + ' annual return (%)'}
                type="number" step="any" required min={FORECAST_MIN_RETURN_PERCENT} max={FORECAST_MAX_ASSUMPTION_PERCENT}
                defaultValue={assumption && Number((assumption.annualReturn * 100).toFixed(8))} />
            </label>
            <label className="grid min-w-0 gap-1 text-caption text-muted-foreground">
              Annual volatility (%)
              <Input name={group.key + '-volatility'} aria-label={group.label + ' annual volatility (%)'}
                type="number" step="any" required min={0} max={FORECAST_MAX_ASSUMPTION_PERCENT}
                defaultValue={assumption && Number((assumption.annualVolatility * 100).toFixed(8))} />
            </label>
          </fieldset>
        )
      })}
      {error && <p className="text-caption text-destructive" role="alert">{error}</p>}
      <div className="flex justify-end">
        <Button type="submit" variant="secondary">Apply assumptions</Button>
      </div>
    </form>
  )
}
