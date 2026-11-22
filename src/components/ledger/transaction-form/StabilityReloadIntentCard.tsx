import React, { useState } from 'react'
import { InfoHint } from '../../ui/InfoHint'
import { Button } from '../../ui/Button'
import { CustomSelect } from '../../ui/CustomSelect'
import { FormField } from '../../ui/FormField'
import { getMonthCycleLabel, getMonthLabel } from '../../../lib/monthCycleLabel'
import { cycleKeyForDate, STABILITY_RECOVERY_PLAN_CYCLES } from '../../../lib/stabilityRecoveryPacing'
import { stabilityRepaymentPresets, stabilityRepaymentTermOptions } from '../../../lib/stabilityRepaymentTerms'
import { formatCurrencyVal } from '../../../lib/utils'
import type { TransactionFormState } from './transactionFormReducer'

export interface StabilityReloadIntentCardProps {
  state: TransactionFormState
  errors: Record<string, string>
  cycleDay: number
  currency: string
  hideSensitive: boolean
  onSetField: (field: keyof TransactionFormState, value: any) => void
}

/** "Sep 2026 cycle" for one payment, otherwise "Sep – Nov 2026 · 3 payments". Repayment opens the cycle after the spending. */
function repaymentWindowLabel(origin: string, cycles: number): string | undefined {
  if (cycles === 1) return getMonthCycleLabel(origin, 1)
  const start = getMonthLabel(origin, 1)
  const finish = getMonthLabel(origin, cycles)
  if (!start || !finish) return undefined
  const [startMonth, startYear] = start.split(' ')
  const range = startYear === finish.split(' ')[1] ? startMonth + ' – ' + finish : start + ' – ' + finish
  return range + ' · ' + cycles + ' payments'
}

export const StabilityReloadIntentCard: React.FC<StabilityReloadIntentCardProps> = ({
  state,
  errors,
  cycleDay,
  currency,
  hideSensitive,
  onSetField,
}) => {
  const repaymentCycles = state.stabilityRepaymentCycles ?? STABILITY_RECOVERY_PLAN_CYCLES
  const [choosingOther, setChoosingOther] = useState(false)
  const isCustomTerm = choosingOther || !stabilityRepaymentPresets.some(option => option.value === repaymentCycles)
  const origin = cycleKeyForDate(state.date, cycleDay)
  const schedule = origin ? repaymentWindowLabel(origin, repaymentCycles) : undefined
  const cents = Math.round(Math.abs(Number(state.amount)) * 100)
  // The cumulative schedule rounds to cents, so individual installments may differ by a cent.
  const share = !hideSensitive && cents > 0
    ? formatCurrencyVal(Math.ceil(cents / repaymentCycles) / 100, currency)
    : null
  const shareSuffix = repaymentCycles === 1 ? 'in one payment' : 'per cycle'
  const isApproximate = repaymentCycles > 1 && cents % repaymentCycles !== 0

  return (
    <div className="space-y-2 rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 sm:col-span-2">
      <p id="stability-reload-intent-label" className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
        Money out of your emergency fund
        <InfoHint
          label="Emergency-fund putting-back choice"
          text="Choose I'll put this back to start a repayment plan next financial cycle. Any unpaid part of an installment is added to the next cycle's amount due. Choose spent for good if you won't reimburse the fund."
        />
      </p>
      <div
        className="grid gap-2 sm:grid-cols-2"
        role="radiogroup"
        aria-labelledby="stability-reload-intent-label"
        aria-describedby={errors.stabilityReloadIntent ? 'stability-reload-intent-error' : undefined}
      >
        {([
          ['Required', "I'll put this back"],
          ['NotRequired', "This one's spent for good"],
        ] as const).map(([value, label]) => {
          const selected = state.stabilityReloadIntent === value
          return (
            <Button
              key={value}
              variant="tertiary"
              role="radio"
              aria-checked={selected}
              onClick={() => onSetField('stabilityReloadIntent', value)}
              className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 justify-start text-left text-xs font-semibold transition ${
                selected
                  ? 'border-amber-500/50 bg-amber-500/15 hover:bg-amber-500/15 text-amber-700 dark:text-amber-300'
                  : 'border-border/60 bg-card/60 text-foreground hover:bg-muted/40'
              }`}
            >
              <span
                aria-hidden="true"
                className={`flex size-4 shrink-0 items-center justify-center rounded-full border ${
                  selected ? 'border-amber-500' : 'border-border'
                }`}
              >
                {selected && <span className="size-2 rounded-full bg-amber-500" />}
              </span>
              {label}
            </Button>
          )
        })}
      </div>
      {state.stabilityReloadIntent === 'Required' && (
        <div className="space-y-2 border-t border-border pt-3">
          <FormField label="Repayment term">
            <CustomSelect
              value={isCustomTerm ? 'other' : repaymentCycles}
              onChange={value => {
                setChoosingOther(value === 'other')
                if (value !== 'other') onSetField('stabilityRepaymentCycles', value)
              }}
              options={stabilityRepaymentPresets}
              className="w-full"
            />
          </FormField>
          {isCustomTerm && (
            <FormField label="Custom repayment term">
              <CustomSelect
                value={repaymentCycles}
                onChange={value => onSetField('stabilityRepaymentCycles', value)}
                options={stabilityRepaymentTermOptions()}
                className="w-full"
              />
            </FormField>
          )}
          <div
            className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 rounded-lg bg-card/60 px-3 py-2.5"
            aria-live="polite"
            data-testid="stability-repayment-summary"
          >
            {share && (
              <p className="text-sm font-semibold tabular-nums text-foreground">
                {isApproximate ? 'About ' : ''}{share}
                <span className="font-normal text-muted-foreground"> {shareSuffix}</span>
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {schedule ?? 'Starts next financial cycle'}
            </p>
          </div>
        </div>
      )}
      {errors.stabilityReloadIntent && (
        <p id="stability-reload-intent-error" role="alert" className="text-xs text-destructive">
          {errors.stabilityReloadIntent}
        </p>
      )}
    </div>
  )
}
