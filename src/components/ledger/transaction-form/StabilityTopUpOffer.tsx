import { useId } from 'react'
import { drawsFor, type RecoveryBucketState, type RecoveryOffer } from '../../../lib/stabilityRecovery'
import { formatCurrencyVal, maskCurrencyInput } from '../../../lib/utils'
import { Checkbox } from '../../ui/Checkbox'
import { InfoHint } from '../../ui/InfoHint'
import { Input } from '../../ui/Input'

interface StabilityTopUpOfferProps {
  offer: RecoveryOffer | null
  accepted: boolean
  onToggle: (accepted: boolean) => void
  /** Empty string means "follow the offer's default", so it tracks a changing salary. */
  amount: string
  onAmountChange: (amount: string) => void
  buckets: RecoveryBucketState[]
  currency: string
  hideSensitive: boolean
  /** The usual share the fund receives, as a fraction of 1, for the "on top of" wording. */
  stabilityAlloc: number
  error?: string
}

/**
 * The offer to put money back into the emergency fund, shown while entering income.
 *
 * A decision, never a default: it renders unticked every time the form opens, because how much a
 * person can spare varies cycle to cycle and a pre-ticked box would move money they did not
 * choose to move. The amount is editable up to the whole outstanding shortfall — the paced
 * instalment is a suggestion, not a limit, and a small dip should not need three cycles.
 */
export function StabilityTopUpOffer({
  offer,
  accepted,
  onToggle,
  amount,
  onAmountChange,
  buckets,
  currency,
  hideSensitive,
  stabilityAlloc,
  error,
}: StabilityTopUpOfferProps) {
  const checkboxId = useId()
  const amountId = useId()
  if (!offer || offer.maxTopUp <= 0) return null

  const typed = parseFloat(amount)
  const chosen = amount.trim() === '' || !Number.isFinite(typed) ? offer.proposedTopUp : typed
  const overMax = chosen > offer.maxTopUp
  const overSafe = !overMax && chosen > offer.safeCap
  const invalid = chosen <= 0 || overMax || Boolean(error)
  const draws = invalid ? [] : drawsFor(chosen, buckets)

  // Masked amounts are decoration for a screen reader; the labels carry the meaning.
  const money = (value: number) =>
    hideSensitive ? <span aria-hidden="true">•••</span> : formatCurrencyVal(value, currency)

  return (
    <div className="rounded-xl border border-border/60 bg-muted/25 p-3.5 sm:col-span-2">
      <div className="flex items-center gap-3">
        <Checkbox
          id={checkboxId}
          checked={accepted}
          onChange={event => onToggle(event.target.checked)}
          className="shrink-0"
        />
        <label htmlFor={checkboxId} className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 text-sm font-semibold text-foreground select-none">
          <span>Put money back into your emergency fund</span>
          <InfoHint
            label="What putting money back means"
            text="Put back used emergency-fund money; choose an amount, then tick the box."
          />
        </label>
      </div>

      {!accepted && (
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          {offer.proposedTopUp >= offer.maxTopUp
            ? <>Suggested: {money(offer.proposedTopUp)}, which clears what is left.</>
            : <>Suggested: {money(offer.proposedTopUp)} of the {money(offer.maxTopUp)} still to go.</>}
        </p>
      )}

      {accepted && (
        <div className="mt-3 space-y-3">
          <div>
            <label htmlFor={amountId} className="mb-1 block text-xs font-medium text-muted-foreground">
              Amount to put back (up to {money(offer.maxTopUp)})
            </label>
            <Input
              id={amountId}
              inputMode="decimal"
              value={amount}
              placeholder={offer.proposedTopUp.toFixed(2)}
              invalid={invalid}
              onChange={event => onAmountChange(maskCurrencyInput(event.target.value, amount))}
              className="w-full"
            />
          </div>

          {overMax && (
            <p className="text-xs text-destructive">
              That is more than the {money(offer.maxTopUp)} this pay packet can put back.
            </p>
          )}

          {error && !overMax && (
            <p className="text-xs text-destructive">{error}</p>
          )}

          {overSafe && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Above {money(offer.safeCap)}, bills or commitments may be short this cycle. Still your call.
            </p>
          )}

          {!invalid && !overSafe && offer.isReduced && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              The suggestion leaves room for this cycle’s bills and commitments.
            </p>
          )}

          <details className="rounded-lg border border-border/40 bg-card/50 p-2.5">
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
              Where it comes from
            </summary>
            <ul className="mt-2 space-y-1">
              {draws.map(draw => (
                <li key={draw.bucket} className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{draw.bucket}</span>
                  <span className="tabular-nums font-semibold">{money(draw.amount)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground border-t border-border/30 pt-1.5">
              Plus the usual {Math.round(stabilityAlloc * 100)}% share, split by your current plan.
            </p>
          </details>
        </div>
      )}
    </div>
  )
}
