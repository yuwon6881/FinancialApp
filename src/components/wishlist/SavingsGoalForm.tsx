import { m } from 'framer-motion'
import type { ChangeEvent, FormEvent } from 'react'
import { CustomSelect } from '../ui/CustomSelect'
import { DatePicker } from '../ui/DatePicker'
import { SmartAmountInput } from '../ui/SmartAmountInput'

interface SavingsGoalFormProps {
  mode: 'add' | 'edit'
  currency: string
  name: string
  target: string
  date: string
  priority: string
  isRecurring: boolean
  recurrenceMonths: string
  errors: Record<string, string>
  onNameChange: (value: string) => void
  onTargetChange: (event: ChangeEvent<HTMLInputElement>) => void
  onDateChange: (value: string) => void
  onPriorityChange: (value: string) => void
  onRecurringChange: (value: boolean) => void
  onRecurrenceMonthsChange: (value: string) => void
  onClearError: (field: string) => void
  onCancel: () => void
  onSubmit: (event: FormEvent) => void
}

const inputClass = (hasError: boolean) =>
  `w-full px-3.5 py-2 bg-background border rounded-xl focus:outline-none focus:ring-1 transition font-medium ${
    hasError ? 'border-destructive focus:ring-destructive' : 'border-border focus:ring-ring'
  }`

export function SavingsGoalForm(props: SavingsGoalFormProps) {
  const isAdd = props.mode === 'add'
  return (
    <form noValidate onSubmit={props.onSubmit} className="space-y-4 text-xs font-semibold">
      <div>
        <label className="text-muted-foreground block mb-1">What are you saving for? *</label>
        <input
          type="text"
          value={props.name}
          onChange={event => {
            props.onNameChange(event.target.value)
            props.onClearError('name')
          }}
          placeholder={isAdd ? 'e.g. Car maintenance, House deposit' : undefined}
          className={inputClass(!!props.errors.name)}
        />
        {props.errors.name && <p className="text-[11px] text-destructive font-medium mt-1">{props.errors.name}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-muted-foreground block mb-1">Amount needed ({props.currency}) *</label>
          <SmartAmountInput
            type="text"
            value={props.target}
            onChange={event => {
              props.onTargetChange(event)
              props.onClearError('target')
            }}
            placeholder={isAdd ? '0.00' : undefined}
            className={`${inputClass(!!props.errors.target)} [appearance:textfield]`}
          />
          {props.errors.target && <p className="text-[11px] text-destructive font-medium mt-1">{props.errors.target}</p>}
        </div>
        <div>
          <label className="text-muted-foreground block mb-1">Priority</label>
          <CustomSelect
            ariaLabel="Goal priority"
            value={props.priority}
            onChange={props.onPriorityChange}
            options={['High', 'Medium', 'Low'].map(value => ({ value, label: value }))}
            className="w-full"
          />
          <p className="text-[10px] text-muted-foreground/80 font-medium mt-1">Funded first when money is short.</p>
        </div>
      </div>

      <div>
        <label className="text-muted-foreground block mb-1">Needed by *</label>
        <DatePicker
          value={props.date}
          onChange={value => {
            props.onDateChange(value)
            props.onClearError('date')
          }}
          className="w-full"
        />
        {props.errors.date
          ? <p className="text-[11px] text-destructive font-medium mt-1">{props.errors.date}</p>
          : (
            <p className="text-[11px] text-muted-foreground mt-1 font-medium">
              The deadline sets the pace — we work out what to set aside each cycle so you land on it.
            </p>
          )}
      </div>

      <div className="rounded-xl border border-border/50 bg-muted/20 p-3 space-y-3">
        <div className="flex items-center gap-2 select-none">
          <input
            type="checkbox"
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
          <div>
            <label className="text-muted-foreground block mb-1">Repeat every (months)</label>
            <input
              type="number"
              min={1}
              max={120}
              inputMode="numeric"
              value={props.recurrenceMonths}
              onChange={event => {
                props.onRecurrenceMonthsChange(event.target.value)
                props.onClearError('recurrence')
              }}
              className={`${inputClass(!!props.errors.recurrence)} [appearance:textfield]`}
            />
            {props.errors.recurrence
              ? <p className="text-[11px] text-destructive font-medium mt-1">{props.errors.recurrence}</p>
              : (
                <p className="text-[10px] text-muted-foreground/80 font-medium mt-1">
                  When you mark it done, the deadline rolls forward and saving restarts from zero.
                </p>
              )}
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground/80 font-medium">
            For things like a quarterly car service or annual insurance.
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 border-t border-border/30 pt-4 mt-6">
        <button type="button" onClick={props.onCancel} className="flex-1 py-2.5 bg-muted text-muted-foreground rounded-xl font-bold cursor-pointer">
          Cancel
        </button>
        <m.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          type="submit"
          className="flex-1 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full font-bold shadow-lg shadow-primary/25 cursor-pointer"
        >
          {isAdd ? 'Add Goal' : 'Save Changes'}
        </m.button>
      </div>
    </form>
  )
}
