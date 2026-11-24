import { useState, type ReactNode } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { ForecastScenario, ForecastScenarioItem } from '../../types'
import {
  clampCycles,
  FORECAST_MAX_CYCLES,
  FORECAST_MAX_ITEMS,
  FORECAST_MIN_CYCLES,
  formatForecastDate,
  parseOptionalAmount,
} from '../../lib/forecastScenario'
import { Button } from '../ui/Button'
import { CustomSelect } from '../ui/CustomSelect'
import { FormField } from '../ui/FormField'
import { IconButton } from '../ui/IconButton'
import { Input } from '../ui/Input'
import { AmountText } from '../ui/AmountText'
import { Panel } from '../ui/Panel'
import { ForecastWhatIfSheet } from './ForecastWhatIfSheet'

const CYCLE_OPTIONS = Array.from({ length: FORECAST_MAX_CYCLES - FORECAST_MIN_CYCLES + 1 }, (_, index) => {
  const value = index + FORECAST_MIN_CYCLES
  return { value, label: value === 1 ? '1 cycle ahead' : `${value} cycles ahead` }
})

function ScenarioAmount({ label, hint, value, onChange }: {
  label: string
  hint?: string
  value: number | null
  onChange: (value: number | null) => void
}) {
  const [text, setText] = useState(value === null ? '' : String(value))
  const parsed = parseOptionalAmount(text)
  const error = text.trim() && parsed === null ? 'Enter an amount from 0 to 100,000,000.' : undefined

  return (
    <FormField label={label} hint={hint} error={error}>
      <Input inputMode="decimal" value={text} placeholder="Optional"
        onChange={event => {
          const next = event.target.value
          setText(next)
          const amount = parseOptionalAmount(next)
          if (amount !== null || !next.trim()) onChange(amount)
        }} />
    </FormField>
  )
}

interface ForecastScenarioPanelProps {
  scenario: ForecastScenario
  today: string
  horizonEnd: string | undefined
  currency: string
  masked: boolean
  onCyclesChange: (cycles: number) => void
  onIncomeChange: (value: number | null) => void
  onEverydaySpendingChange: (value: number | null) => void
  onAddItem: (item: ForecastScenarioItem) => void
  onRemoveItem: (id: string) => void
  resetAction: ReactNode
}

export function ForecastScenarioPanel({
  scenario, today, horizonEnd, currency, masked,
  onCyclesChange, onIncomeChange, onEverydaySpendingChange, onAddItem, onRemoveItem, resetAction,
}: ForecastScenarioPanelProps) {
  const [adding, setAdding] = useState(false)
  const atLimit = scenario.items.length >= FORECAST_MAX_ITEMS

  if (masked) {
    return <p className="text-body text-muted-foreground">Amounts are hidden. Turn off Hide Sensitive to edit your scenario.</p>
  }

  return (
    <Panel as="section" aria-labelledby="forecast-scenario-title" className="space-y-3 p-3.5 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 id="forecast-scenario-title" className="text-section text-foreground">Scenario</h2>
        <CustomSelect value={scenario.cycles} options={CYCLE_OPTIONS} ariaLabel="Cycles to forecast"
          onChange={value => onCyclesChange(clampCycles(value))} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ScenarioAmount label="Income per cycle" value={scenario.incomePerCycle} onChange={onIncomeChange} />
        <ScenarioAmount label="Everyday spending per cycle" value={scenario.everydaySpendingPerCycle}
          hint="Enter your total Essentials spending for one budgeting cycle, excluding bills and loan instalments."
          onChange={onEverydaySpendingChange} />
      </div>
      <p className="text-caption text-muted-foreground">Both amounts apply once per cycle, starting next cycle.</p>

      {scenario.items.length > 0 && (
        <ul aria-label="What-if items" className="divide-y divide-border/60 border-t border-border">
          {scenario.items.map(item => {
            const outsideForecast = item.date < today || (horizonEnd !== undefined && item.date > horizonEnd)
            return (
              <li key={item.id} className="flex min-w-0 flex-wrap items-center justify-end gap-x-2 gap-y-1 py-1.5">
                <span className="mr-auto min-w-0 flex-[1_1_8rem]">
                  <span className="block wrap-anywhere text-body text-foreground">{item.label}</span>
                  <span className="block text-caption text-muted-foreground">
                    {formatForecastDate(item.date)} · {item.bucket ?? 'Extra income'}{outsideForecast && ' · Outside forecast dates'}
                  </span>
                </span>
                <AmountText value={item.amount} currency={currency} signDisplay="always"
                  tone={item.amount > 0 ? 'positive' : 'neutral'} className="text-body" />
                <IconButton type="button" label={`Remove ${item.label}`} onClick={() => onRemoveItem(item.id)}>
                  <Trash2 className="size-4" />
                </IconButton>
              </li>
            )
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 border-t border-border pt-2">
        {atLimit && <p className="mr-auto text-caption text-muted-foreground">Limit reached ({FORECAST_MAX_ITEMS} items).</p>}
        {resetAction}
        <Button type="button" variant="secondary" size="sm" onClick={() => setAdding(true)} disabled={atLimit}>
          <Plus className="size-4" aria-hidden="true" /> Add what-if
        </Button>
      </div>
      {adding && (
        <ForecastWhatIfSheet today={today} horizonEnd={horizonEnd} currency={currency}
          onClose={() => setAdding(false)} onAddItem={item => { onAddItem(item); setAdding(false) }} />
      )}
    </Panel>
  )
}
