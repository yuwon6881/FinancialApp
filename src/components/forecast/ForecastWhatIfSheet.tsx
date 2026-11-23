import { useState, type FormEvent } from 'react'
import type { ForecastScenarioItem } from '../../types'
import { FORECAST_BUCKETS } from '../../types'
import { buildScenarioItem, FORECAST_LABEL_MAX, type ScenarioItemDraft } from '../../lib/forecastScenario'
import { BottomSheet } from '../ui/BottomSheet'
import { Button } from '../ui/Button'
import { CustomSelect } from '../ui/CustomSelect'
import { DatePicker } from '../ui/DatePicker'
import { FormField } from '../ui/FormField'
import { Input } from '../ui/Input'
import { ModalActions } from '../ui/ModalActions'

const TARGET_OPTIONS: { value: ScenarioItemDraft['target']; label: string }[] = [
  ...FORECAST_BUCKETS.map(bucket => ({ value: bucket, label: `Spend from ${bucket}` })),
  { value: 'In', label: 'Extra income' },
]

export function ForecastWhatIfSheet({ today, horizonEnd, currency, onClose, onAddItem }: {
  today: string
  horizonEnd: string | undefined
  currency: string
  onClose: () => void
  onAddItem: (item: ForecastScenarioItem) => void
}) {
  const [draft, setDraft] = useState<ScenarioItemDraft>({ label: '', date: today, amount: '', target: 'Essentials' })
  const [error, setError] = useState<string | null>(null)

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const result = buildScenarioItem(draft, crypto.randomUUID())
    if (typeof result === 'string') {
      setError(result)
      return
    }
    if (result.date < today || (horizonEnd && result.date > horizonEnd)) {
      setError('Pick a date within the forecast.')
      return
    }
    onAddItem(result)
  }

  return (
    <BottomSheet isOpen title="Add a what-if" onClose={onClose} maxWidthClassName="max-w-xl"
      footer={(
        <ModalActions>
          <Button type="button" variant="secondary" size="md" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="forecast-what-if-form" variant="primary" size="md">Add to forecast</Button>
        </ModalActions>
      )}>
      <form id="forecast-what-if-form" noValidate onSubmit={submit} className="space-y-4">
        <FormField label="Name">
          <Input value={draft.label} maxLength={FORECAST_LABEL_MAX} placeholder="e.g. Car repair"
            onChange={event => setDraft({ ...draft, label: event.target.value })} />
        </FormField>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label={`Amount (${currency})`}>
            <Input inputMode="decimal" value={draft.amount} placeholder="0.00"
              onChange={event => setDraft({ ...draft, amount: event.target.value })} />
          </FormField>
          <FormField label="Date">
            <DatePicker value={draft.date} min={today} max={horizonEnd} className="w-full"
              onChange={date => setDraft({ ...draft, date })} />
          </FormField>
        </div>
        <FormField label="Type" hint={draft.target === 'In' ? 'Split using your income allocation settings.' : undefined}>
          <CustomSelect value={draft.target} options={TARGET_OPTIONS} className="w-full" ariaLabel="What-if type"
            onChange={target => setDraft({ ...draft, target })} />
        </FormField>
        {error && <p role="alert" className="text-body text-destructive">{error}</p>}
      </form>
    </BottomSheet>
  )
}
