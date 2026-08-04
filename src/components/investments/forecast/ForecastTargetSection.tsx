import { Button } from '../../ui/Button'
import { FormField } from '../../ui/FormField'
import { InfoHint } from '../../ui/InfoHint'
import { RangeInput } from '../../ui/RangeInput'

/**
 * Aiming for a number is optional, so it is offered rather than assumed: nothing
 * about a target exists — line, odds, or required deposit — until it is asked for.
 */
export function ForecastTargetSection({
  target,
  onAdd,
  onRemove,
  onChange,
  targetMax,
  targetStep,
  years,
  targetChance,
  requiredContribution,
  onUseRequiredAmount,
  isCalculating,
  masked,
  money,
}: {
  target: number | null
  onAdd: () => void
  onRemove: () => void
  onChange: (value: number) => void
  targetMax: number
  targetStep: number
  years: number
  targetChance: number | undefined
  requiredContribution: number | undefined
  onUseRequiredAmount: () => void
  isCalculating: boolean
  masked: boolean
  money: (value: number) => string
}) {
  if (target === null) {
    return (
      <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-border/50 bg-muted/15 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold text-foreground">Want to aim for a number?</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Add a target and this will show your chances of reaching it, and the monthly amount that would get you there.</p>
        </div>
        <Button variant="outline" size="sm" disabled={masked} onClick={onAdd} className="shrink-0">Add a target</Button>
      </div>
    )
  }

  const canUseRequired = requiredContribution !== undefined && Number.isFinite(requiredContribution)

  return (
    <div className="mt-5 space-y-4 rounded-2xl border border-border/50 bg-muted/15 p-4">
      <FormField
        label={<span className="flex justify-between gap-3"><span>Target amount</span><strong className="text-foreground">{money(target)}</strong></span>}
        hint={`The monthly amount below aims to reach this in the middle simulated outcome after ${years} years.`}
      >
        <RangeInput aria-label="Forecast target amount" min={0} max={targetMax} step={targetStep} value={Math.min(target, targetMax)} disabled={masked} onChange={event => onChange(Number(event.target.value))} />
      </FormField>

      <div className="grid gap-3 sm:grid-cols-2">
        <article className="rounded-xl border border-border/50 bg-muted/15 p-3">
          <div className="flex items-center gap-1">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Chance of reaching your target</p>
            <InfoHint
              label="the chance of reaching your target"
              text="The share of the 10,000 simulated paths that ended at or above your target, using the monthly amount you picked."
            />
          </div>
          <strong className="mt-1 block break-words text-base text-foreground">
            {targetChance === undefined ? 'Calculating…' : `${Math.round(targetChance * 100)}%`}
          </strong>
        </article>
        <article className="rounded-xl border border-primary/25 bg-primary/5 p-3">
          <div className="flex items-center gap-1">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Monthly amount for your target</p>
            <InfoHint
              label="the monthly amount for your target"
              text="Adding this much every month would reach your target in the middle simulated outcome. Better or worse markets would change it."
            />
          </div>
          <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <strong className="block text-xl text-foreground">{isCalculating || !canUseRequired ? 'Calculating…' : money(requiredContribution)}</strong>
              <span className="text-[10px] text-muted-foreground">Middle estimate · {canUseRequired ? money(requiredContribution * 12) : '—'} a year</span>
            </div>
            <Button variant="outline" size="sm" disabled={masked || !canUseRequired} onClick={onUseRequiredAmount}>Use this amount</Button>
          </div>
        </article>
      </div>

      <Button variant="ghost" size="sm" onClick={onRemove}>Remove target</Button>
    </div>
  )
}
