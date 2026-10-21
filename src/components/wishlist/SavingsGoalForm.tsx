import { Input } from '../ui/Input'
import { Checkbox } from '../ui/Checkbox'
import type { ChangeEvent, FormEvent, ReactNode } from 'react'
import { CustomSelect } from '../ui/CustomSelect'
import { DatePicker } from '../ui/DatePicker'
import { SmartAmountInput } from '../ui/SmartAmountInput'
import { FormField } from '../ui/FormField'
import { Button } from '../ui/Button'
import { ModalActions } from '../ui/ModalActions'
import { InfoHint } from '../ui/InfoHint'
import type { SavingsGoalFundingBucket } from '../../types'
import { cn } from '../../lib/utils'

interface SavingsGoalFormProps {
  mode: 'add' | 'edit'
  currency: string
  name: string
  target: string
  fundingBucket: SavingsGoalFundingBucket
  date: string
  priority: string
  isRecurring: boolean
  recurrenceMonths: string
  errors: Record<string, string>
  /** Surplus a lowered target would hand back to free rewards. Stated, never blocking. */
  releasedByLowerTarget: number
  /** What this target and deadline would ask for each cycle, from the shared pacing math. */
  requiredPerCycle: number
  formatSensitive: (value: number) => ReactNode
  onNameChange: (value: string) => void
  onTargetChange: (event: ChangeEvent<HTMLInputElement>) => void
  onFundingBucketChange: (value: SavingsGoalFundingBucket) => void
  onDateChange: (value: string) => void
  onPriorityChange: (value: string) => void
  onRecurringChange: (value: boolean) => void
  onRecurrenceMonthsChange: (value: string) => void
  onClearError: (field: string) => void
  onCancel: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

const RECURRENCE_PRESETS = [
  { label: 'Monthly', months: '1' },
  { label: 'Quarterly', months: '3' },
  { label: 'Semi-annual', months: '6' },
  { label: 'Annual', months: '12' },
] as const

export function SavingsGoalForm(props: SavingsGoalFormProps) {
  const isAdd = props.mode === 'add'
  return (
    <form noValidate onSubmit={props.onSubmit} className="space-y-4 text-xs font-semibold">
      <FormField label="What are you saving for?" required error={props.errors.name}>
        <Input
          type="text"
          value={props.name}
          onChange={event => {
            props.onNameChange(event.target.value)
            props.onClearError('name')
          }}
          placeholder={isAdd ? 'e.g. Car maintenance, House deposit' : undefined}
          className="font-medium"
        />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          label={`Target (${props.currency})`}
          required
          error={props.errors.target}
          hint={!props.errors.target && props.releasedByLowerTarget > 0
            ? `That is below the ${props.formatSensitive(props.releasedByLowerTarget)} more you have already set aside. Saving returns the difference to your free ${props.fundingBucket.toLowerCase()} money.`
            : undefined}
        >
          <SmartAmountInput
            type="text"
            inputMode="decimal"
            value={props.target}
            onChange={event => {
              props.onTargetChange(event)
              props.onClearError('target')
            }}
            placeholder={isAdd ? '0.00' : undefined}
            className="font-medium [appearance:textfield]"
          />
        </FormField>
        <FormField label="Priority">
          <CustomSelect
            ariaLabel="Commitment priority"
            value={props.priority}
            onChange={props.onPriorityChange}
            options={['High', 'Medium', 'Low'].map(value => ({ value, label: value }))}
            className="w-full"
          />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          label="Funding source"
          labelAction={(
            <InfoHint
              inline
              label="commitment funding bucket"
              text="Essentials is the money your bills come out of. Rewards is the money you set aside for treats and rewards."
            />
          )}
        >
          <CustomSelect
            ariaLabel="Commitment funding bucket"
            value={props.fundingBucket}
            onChange={value => props.onFundingBucketChange(value as SavingsGoalFundingBucket)}
            options={[
              { value: 'Essentials', label: 'Everyday money (Essentials)' },
              { value: 'Rewards', label: 'Rewards money (Rewards)' },
            ]}
            className="w-full"
          />
        </FormField>

        <FormField
          label="Needed by"
          required
          error={props.errors.date}
        >
          <DatePicker
            value={props.date}
            onChange={value => {
              props.onDateChange(value)
              props.onClearError('date')
            }}
            className="w-full"
          />
        </FormField>
      </div>

      <div className="rounded-control bg-surface-2/70 p-3.5 space-y-3 border border-border/40 transition-colors">
        <div className="flex items-start gap-2.5 select-none">
          <Checkbox
            id={`goal-recurring-${props.mode}`}
            checked={props.isRecurring}
            onChange={event => props.onRecurringChange(event.target.checked)}
            className="mt-0.5"
          />
          <div className="min-w-0 flex-1">
            <label htmlFor={`goal-recurring-${props.mode}`} className="text-foreground font-semibold cursor-pointer block text-body">
              This repeats
            </label>
            <p className="text-caption text-muted-foreground font-normal mt-0.5 leading-relaxed">
              Automatically restarts saving and advances the deadline once completed.
            </p>
          </div>
        </div>
        {props.isRecurring && (
          <div className="pt-2.5 border-t border-border/40 space-y-3">
            <FormField
              label="Repeat every (months)"
              error={props.errors.recurrence}
              hint={!props.errors.recurrence ? 'Marking it done moves the deadline forward and restarts saving.' : undefined}
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={120}
                    inputMode="numeric"
                    value={props.recurrenceMonths}
                    onChange={event => {
                      props.onRecurrenceMonthsChange(event.target.value)
                      props.onClearError('recurrence')
                    }}
                    placeholder="12"
                    className="font-medium [appearance:textfield] flex-1"
                  />
                  <span className="text-body font-medium text-muted-foreground shrink-0 pr-1">months</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-caption text-muted-foreground mr-1">Presets:</span>
                  {RECURRENCE_PRESETS.map(preset => {
                    const isSelected = props.recurrenceMonths === preset.months
                    return (
                      <Button
                        key={preset.months}
                        type="button"
                        variant={isSelected ? 'primary' : 'secondary'}
                        size="sm"
                        onClick={() => {
                          props.onRecurrenceMonthsChange(preset.months)
                          props.onClearError('recurrence')
                        }}
                        className={cn(
                          'h-7 min-h-7 px-2.5 text-caption font-medium rounded-full cursor-pointer',
                          isSelected && 'bg-ink text-ink-foreground',
                        )}
                      >
                        {preset.label}
                      </Button>
                    )
                  })}
                </div>
              </div>
            </FormField>
          </div>
        )}
      </div>

      <ModalActions className="border-t border-border/30 pt-4 mt-6">
        <Button variant="secondary" type="button" onClick={props.onCancel} className="rounded-xl py-2.5">
          Cancel
        </Button>
        <Button
          type="submit"
        >
          {isAdd ? 'Add Commitment' : 'Save Changes'}
        </Button>
      </ModalActions>
    </form>
  )
}
