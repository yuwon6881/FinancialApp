import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { ForecastScenario, ForecastScenarioItem } from '../../types'
import { FORECAST_BUCKETS } from '../../types'
import {
  buildScenarioItem,
  clampCycles,
  FORECAST_MAX_CYCLES,
  FORECAST_MAX_ITEMS,
  FORECAST_MIN_CYCLES,
  parseOptionalAmount,
  type ScenarioItemDraft,
} from '../../lib/forecastScenario'
import { Button } from '../ui/Button'
import { CustomSelect } from '../ui/CustomSelect'
import { DatePicker } from '../ui/DatePicker'
import { FormField } from '../ui/FormField'
import { IconButton } from '../ui/IconButton'
import { Input } from '../ui/Input'
import { AmountText } from '../ui/AmountText'
import { panelClass } from '../ui/panelStyles'
import { cn } from '../../lib/utils'

const CYCLE_OPTIONS = Array.from({ length: FORECAST_MAX_CYCLES - FORECAST_MIN_CYCLES + 1 }, (_, index) => {
  const value = index + FORECAST_MIN_CYCLES
  return { value, label: value === 1 ? '1 cycle' : `${value} cycles` }
})

const TARGET_OPTIONS: { value: ScenarioItemDraft['target']; label: string }[] = [
  { value: 'In', label: 'Money in (split like salary)' },
  ...FORECAST_BUCKETS.map(bucket => ({ value: bucket, label: `Spend from ${bucket}` })),
]

const emptyDraft = (today: string): ScenarioItemDraft => ({ label: '', date: today, amount: '', target: 'Essentials' })

const amountText = (value: number | null) => (value === null ? '' : String(value))

interface ForecastScenarioPanelProps {
  scenario: ForecastScenario
  today: string
  currency: string
  masked: boolean
  onCyclesChange: (cycles: number) => void
  onIncomeChange: (value: number | null) => void
  onEverydaySpendingChange: (value: number | null) => void
  onAddItem: (item: ForecastScenarioItem) => void
  onRemoveItem: (id: string) => void
}

export function ForecastScenarioPanel({
  scenario, today, currency, masked,
  onCyclesChange, onIncomeChange, onEverydaySpendingChange, onAddItem, onRemoveItem,
}: ForecastScenarioPanelProps) {
  // Raw text keeps "48" from snapping to a number mid-typing; the parsed value drives the forecast.
  const [income, setIncome] = useState(amountText(scenario.incomePerCycle))
  const [everyday, setEveryday] = useState(amountText(scenario.everydaySpendingPerCycle))
  const [draft, setDraft] = useState<ScenarioItemDraft>(() => emptyDraft(today))
  const [draftError, setDraftError] = useState<string | null>(null)
  const atLimit = scenario.items.length >= FORECAST_MAX_ITEMS

  const submitItem = () => {
    const result = buildScenarioItem(draft, crypto.randomUUID())
    if (typeof result === 'string') {
      setDraftError(result)
      return
    }
    onAddItem(result)
    setDraft(emptyDraft(draft.date))
    setDraftError(null)
  }

  return (
    <section aria-labelledby="forecast-scenario-title" className={cn(panelClass, 'space-y-5 p-4 sm:p-5')}>
      <div>
        <h2 id="forecast-scenario-title" className="text-section text-foreground">Your scenario</h2>
        <p className="mt-1 text-caption text-muted-foreground">
          Changes here stay in this workspace. They never touch your ledger, bills or balances.
        </p>
      </div>

      {masked ? (
        <p className="rounded-control inset-group px-3 py-2 text-caption text-muted-foreground">
          Amounts are hidden. Turn off Hide Sensitive from your profile menu to edit the scenario.
        </p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Income each cycle" hint="Leave blank if you are not sure.">
              <Input inputMode="decimal" value={income} placeholder="e.g. 4800"
                onChange={event => { setIncome(event.target.value); onIncomeChange(parseOptionalAmount(event.target.value)) }} />
            </FormField>
            <FormField label="Everyday spending each cycle" hint="Food and day-to-day costs beyond your bills.">
              <Input inputMode="decimal" value={everyday} placeholder="e.g. 600"
                onChange={event => { setEveryday(event.target.value); onEverydaySpendingChange(parseOptionalAmount(event.target.value)) }} />
            </FormField>
            <FormField label="Look ahead">
              <CustomSelect value={scenario.cycles} options={CYCLE_OPTIONS} ariaLabel="Cycles to forecast"
                onChange={value => onCyclesChange(clampCycles(value))} />
            </FormField>
          </div>

          <div className="space-y-3">
            <h3 className="text-label text-foreground">What-if items</h3>
            {scenario.items.length === 0 && (
              <p className="text-caption text-muted-foreground">Add a one-off cost or extra money to see how it plays out.</p>
            )}
            {scenario.items.length > 0 && (
              <ul className="divide-y divide-border/60">
                {scenario.items.map(item => (
                  <li key={item.id} className="flex min-w-0 items-center justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <span className="block truncate text-body text-foreground">{item.label}</span>
                      <span className="text-caption text-muted-foreground">
                        {item.date} · {item.bucket ? `From ${item.bucket}` : 'Money in, split like salary'}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      <AmountText value={item.amount} currency={currency} signDisplay="always"
                        tone={item.amount > 0 ? 'positive' : 'neutral'} className="text-body" />
                      <IconButton type="button" label={`Remove ${item.label}`} onClick={() => onRemoveItem(item.id)}>
                        <Trash2 className="size-4" />
                      </IconButton>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <div className="grid gap-3 rounded-control inset-group p-3 sm:grid-cols-2 lg:grid-cols-4">
              <FormField label="Name">
                <Input value={draft.label} maxLength={80} placeholder="e.g. Tooth crown"
                  onChange={event => setDraft({ ...draft, label: event.target.value })} />
              </FormField>
              <FormField label="Date">
                <DatePicker value={draft.date} min={today} onChange={date => setDraft({ ...draft, date })} />
              </FormField>
              <FormField label="Amount">
                <Input inputMode="decimal" value={draft.amount} placeholder="0.00"
                  onChange={event => setDraft({ ...draft, amount: event.target.value })} />
              </FormField>
              <FormField label="Type">
                <CustomSelect value={draft.target} options={TARGET_OPTIONS} ariaLabel="What-if type"
                  onChange={target => setDraft({ ...draft, target })} />
              </FormField>
              <div className="flex items-center justify-end gap-3 sm:col-span-2 lg:col-span-4">
                {draftError && <p role="alert" className="text-caption text-destructive">{draftError}</p>}
                <Button type="button" variant="secondary" size="md" onClick={submitItem} disabled={atLimit}>
                  <Plus className="size-4" /> Add what-if
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
