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
        <FormField label={`Amount needed (${props.currency})`} required error={props.errors.target}>
          <SmartAmountInput
            type="text"
            value={props.target}
            onChange={event => {
              props.onTargetChange(event)
              props.onClearError('target')
            }}
            placeholder={isAdd ? '0.00' : undefined}
            className="font-medium [appearance:textfield]"
          />
          {/* A consequence, not a rejection: saving is still allowed, so this is stated in the
              hint slot rather than as an error that would refuse the very change it describes. */}
          {!props.errors.target && props.releasedByLowerTarget > 0 && (
            <p className="text-[10px] text-amber-500 font-medium mt-1">
              That is below the {props.formatSensitive(props.releasedByLowerTarget)} more you have
              already set aside. Saving returns the difference to your free {props.fundingBucket.toLowerCase()} money.
            </p>
          )}
        </FormField>
        <FormField label="Priority">
          <CustomSelect
            ariaLabel="Commitment priority"
            value={props.priority}
            onChange={props.onPriorityChange}
            options={['High', 'Medium', 'Low'].map(value => ({ value, label: value }))}
            className="w-full"
          />
          <p className="text-[10px] text-muted-foreground font-medium mt-1">Funded first when money is short.</p>
        </FormField>
      </div>

      <FormField label="Where should this money come from?">
        <div className="flex items-center gap-1.5">
          <CustomSelect
            ariaLabel="Commitment funding bucket"
            value={props.fundingBucket}
            onChange={value => props.onFundingBucketChange(value as SavingsGoalFundingBucket)}
            options={[
              { value: 'Essentials', label: 'From your everyday money (Essentials)' },
              { value: 'Rewards', label: 'From your rewards money (Rewards)' },
            ]}
            className="w-full"
          />
          <InfoHint
            label="commitment funding bucket"
            text="Essentials is the money your bills come out of. Rewards is the money you set aside for treats and rewards."
          />
        </div>
      </FormField>

      <FormField label="Needed by" required error={props.errors.date}>
        <DatePicker
          value={props.date}
          onChange={value => {
            props.onDateChange(value)
            props.onClearError('date')
          }}
          className="w-full"
        />
        {!props.errors.date && (
            <p className="text-[11px] text-muted-foreground mt-1 font-medium">
              {props.requiredPerCycle > 0
                ? <>Your deadline works out at about {props.formatSensitive(props.requiredPerCycle)} to set aside each cycle.</>
                : 'Your deadline sets how much to set aside each cycle.'}
            </p>
        )}
      </FormField>

      <div className="rounded-xl border border-border/50 bg-muted/20 p-3 space-y-3">
        <div className="flex items-center gap-2 select-none">
          <Checkbox
            id={`goal-recurring-${props.mode}`}
            checked={props.isRecurring}
            onChange={event => props.onRecurringChange(event.target.checked)}
            className="size-3.5 border-border rounded focus:ring-ring"
          />
          <label htmlFor={`goal-recurring-${props.mode}`} className="text-foreground font-semibold cursor-pointer">
            This repeats
          </label>
        </div>
        {props.isRecurring ? (
          <FormField label="Repeat every (months)" error={props.errors.recurrence}>
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
              className="font-medium [appearance:textfield]"
            />
            {!props.errors.recurrence && (
                <p className="text-[10px] text-muted-foreground font-medium mt-1">
                  Marking it done moves the deadline forward and restarts saving.
                </p>
            )}
          </FormField>
        ) : (
          <p className="text-[10px] text-muted-foreground font-medium">
            For things like a quarterly car service or annual insurance.
          </p>
        )}
      </div>

      <ModalActions className="border-t border-border/30 pt-4 mt-6">
        <Button variant="outline" type="button" onClick={props.onCancel} className="rounded-xl py-2.5">
          Cancel
        </Button>
        <Button
          type="submit"
          className="rounded-xl py-2.5 shadow-lg shadow-primary/25"
        >
          {isAdd ? 'Add Commitment' : 'Save Changes'}
        </Button>
      </ModalActions>
    </form>
  )
}
