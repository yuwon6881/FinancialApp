import React from 'react'
import { InfoHint } from '../../ui/InfoHint'
import { Button } from '../../ui/Button'
import type { TransactionFormState } from './transactionFormReducer'

export interface StabilityReloadIntentCardProps {
  state: TransactionFormState
  errors: Record<string, string>
  onSetField: (field: keyof TransactionFormState, value: any) => void
}

export const StabilityReloadIntentCard: React.FC<StabilityReloadIntentCardProps> = ({
  state,
  errors,
  onSetField,
}) => {
  return (
    <div className="space-y-2 rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 sm:col-span-2">
      <p id="stability-reload-intent-label" className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
        Money out of your emergency fund
        <InfoHint
          label="Emergency-fund putting-back choice"
          text="Only I'll put this back keeps the Today reminder alive. Choose spent for good when this money will not return to the fund."
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
      {errors.stabilityReloadIntent && (
        <p id="stability-reload-intent-error" role="alert" className="text-xs text-destructive">
          {errors.stabilityReloadIntent}
        </p>
      )}
    </div>
  )
}
