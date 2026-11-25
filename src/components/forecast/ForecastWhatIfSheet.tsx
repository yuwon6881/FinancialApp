import { useState, type FormEvent } from 'react'
import { ArrowLeftRight } from 'lucide-react'
import type { ForecastBucket, ForecastScenarioItem } from '../../types'
import { FORECAST_BUCKETS } from '../../types'
import { buildScenarioChange, FORECAST_LABEL_MAX, type ScenarioChangeDraft, type ScenarioChangeKind } from '../../lib/forecastScenario'
import { BottomSheet } from '../ui/BottomSheet'
import { Button } from '../ui/Button'
import { CustomSelect } from '../ui/CustomSelect'
import { DatePicker } from '../ui/DatePicker'
import { FormField } from '../ui/FormField'
import { Input } from '../ui/Input'
import { ModalActions } from '../ui/ModalActions'
import { SmartAmountInput } from '../ui/SmartAmountInput'

const KIND_OPTIONS: { value: ScenarioChangeKind; label: string }[] = [
  { value: 'move', label: 'Move money between categories' },
  { value: 'spend', label: 'Spend from a category' },
  { value: 'add', label: 'Add money to a category' },
  { value: 'income', label: 'Extra income' },
]
const KIND_HINTS: Record<ScenarioChangeKind, string> = {
  move: 'Your total stays the same; only where the money sits changes.',
  spend: 'A one-off cost, such as a repair or a trip.',
  add: 'Money that lands in one category, such as a gift kept for Rewards.',
  income: 'Split using your income allocation settings.',
}
const BUCKET_OPTIONS = FORECAST_BUCKETS.map(bucket => ({ value: bucket, label: bucket }))

/** The dates one change may use: the whole forecast, or a single cycle opened from its card. */
export interface ForecastWindow {
  title: string
  description?: string
  min: string
  max: string | undefined
}

export function ForecastWhatIfSheet({ range, initialKind = 'spend', currency, onClose, onAddItems }: {
  range: ForecastWindow
  initialKind?: ScenarioChangeKind
  currency: string
  onClose: () => void
  onAddItems: (items: ForecastScenarioItem[]) => void
}) {
  const [draft, setDraft] = useState<ScenarioChangeDraft>({
    kind: initialKind, label: '', date: range.min, amount: '', bucket: initialKind === 'move' ? 'Rewards' : 'Essentials', toBucket: 'Essentials',
  })
  const [error, setError] = useState<string | null>(null)
  const update = (change: Partial<ScenarioChangeDraft>) => { setDraft(previous => ({ ...previous, ...change })); setError(null) }
  const isMove = draft.kind === 'move'

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const result = buildScenarioChange(draft, () => crypto.randomUUID())
    if (typeof result === 'string') {
      setError(result)
      return
    }
    if (draft.date < range.min || (range.max && draft.date > range.max)) {
      setError(range.description ? 'Pick a date within this cycle.' : 'Pick a date within the forecast.')
      return
    }
    onAddItems(result)
  }

  return (
    <BottomSheet isOpen title={range.title} description={range.description} onClose={onClose} maxWidthClassName="max-w-xl"
      footer={(
        <ModalActions>
          <Button type="button" variant="secondary" size="md" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="forecast-what-if-form" variant="primary" size="md">Add to forecast</Button>
        </ModalActions>
      )}>
      <form id="forecast-what-if-form" noValidate onSubmit={submit} className="space-y-4">
        <FormField label="Change" hint={KIND_HINTS[draft.kind]}>
          <CustomSelect value={draft.kind} options={KIND_OPTIONS} className="w-full" ariaLabel="What-if type"
            onChange={kind => update(kind === 'move' && draft.bucket === draft.toBucket
              // A move needs two different buckets; keep the chosen one as the destination.
              ? { kind, bucket: FORECAST_BUCKETS.find(bucket => bucket !== draft.toBucket) ?? draft.bucket }
              : { kind })} />
        </FormField>
        {isMove ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-label font-medium text-muted-foreground">Transfer route</span>
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => update({ bucket: draft.toBucket, toBucket: draft.bucket })}
                title="Swap source and destination categories"
              >
                <ArrowLeftRight className="size-3.5" aria-hidden="true" />
                Swap Direction
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="From">
                <CustomSelect value={draft.bucket} options={BUCKET_OPTIONS} className="w-full" ariaLabel="Move from"
                  onChange={(bucket: ForecastBucket) => update({ bucket })} />
              </FormField>
              <FormField label="To">
                <CustomSelect value={draft.toBucket} options={BUCKET_OPTIONS} className="w-full" ariaLabel="Move to"
                  onChange={(toBucket: ForecastBucket) => update({ toBucket })} />
              </FormField>
            </div>
          </div>
        ) : draft.kind !== 'income' && (
          <FormField label="Category">
            <CustomSelect value={draft.bucket} options={BUCKET_OPTIONS} className="w-full" ariaLabel="Category"
              onChange={(bucket: ForecastBucket) => update({ bucket })} />
          </FormField>
        )}
        <FormField label={`Amount (${currency})`}>
          <SmartAmountInput value={draft.amount} placeholder="0.00"
            onChange={event => update({ amount: event.target.value })} />
        </FormField>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label={isMove ? 'Name (optional)' : 'Name'}>
            <Input value={draft.label} maxLength={FORECAST_LABEL_MAX}
              placeholder={isMove ? `Move ${draft.bucket} to ${draft.toBucket}` : 'e.g. Car repair'}
              onChange={event => update({ label: event.target.value })} />
          </FormField>
          <FormField label="Date">
            <DatePicker value={draft.date} min={range.min} max={range.max} className="w-full"
              onChange={date => update({ date })} />
          </FormField>
        </div>
        {error && <p role="alert" className="text-body text-destructive">{error}</p>}
      </form>
    </BottomSheet>
  )
}
