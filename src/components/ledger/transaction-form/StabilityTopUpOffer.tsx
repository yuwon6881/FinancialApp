import { useId } from 'react'
import type { RecoveryOffer } from '../../../lib/stabilityRecovery'
import { formatCurrencyVal } from '../../../lib/utils'
import { Checkbox } from '../../ui/Checkbox'
import { InfoHint } from '../../ui/InfoHint'

interface StabilityTopUpOfferProps {
  offer: RecoveryOffer | null
  accepted: boolean
  onToggle: (accepted: boolean) => void
  currency: string
  hideSensitive: boolean
  /** The usual share this bucket receives, as a fraction of 1, for the "on top of" wording. */
  stabilityAlloc: number
  /** Bills still to pay this cycle, quoted when they are what held the offer back. */
  essentialsCommitted: number
}

/**
 * The offer to put money back into the emergency fund, shown while entering income.
 *
 * A decision, never a default: it renders unticked every time the form opens, because how much a
 * person can spare varies cycle to cycle and a pre-ticked box would move money they did not
 * choose to move.
 */
export function StabilityTopUpOffer({
  offer,
  accepted,
  onToggle,
  currency,
  hideSensitive,
  stabilityAlloc,
  essentialsCommitted,
}: StabilityTopUpOfferProps) {
  const checkboxId = useId()
  if (!offer || offer.proposedTopUp <= 0) return null

  // Masked amounts are decoration for a screen reader; the checkbox label carries the meaning.
  const money = (value: number) =>
    hideSensitive
      ? <span aria-hidden="true">•••</span>
      : formatCurrencyVal(value, currency)

  return (
    <div className="rounded-xl border border-border/60 bg-muted/25 p-3">
      <div className="flex items-start gap-2.5">
        <Checkbox
          id={checkboxId}
          checked={accepted}
          onChange={event => onToggle(event.target.checked)}
          className="mt-0.5"
        />
        <div className="min-w-0 flex-1">
          <label htmlFor={checkboxId} className="flex cursor-pointer items-center gap-1.5 text-sm font-medium">
            <span>Put {money(offer.proposedTopUp)} back into your emergency fund</span>
            <InfoHint
              label="What putting money back means"
              text="Your emergency fund is money set aside for surprises. When you spend some of it, the app offers to put it back a little at a time instead of all at once. You choose every time — nothing changes unless you tick this box."
            />
          </label>

          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {offer.isReduced ? (
              <>
                We lowered this so your Essentials money still covers the {money(essentialsCommitted)} of
                bills left this cycle, and your savings goals still get what they need.
              </>
            ) : (
              <>
                On top of the usual {Math.round(stabilityAlloc * 100)}% share. It comes out of Essentials,
                Growth and Rewards in the same proportions you already set, so no single pot takes the
                whole hit.
              </>
            )}
          </p>

          <details className="mt-2">
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
              Where it comes from
            </summary>
            <ul className="mt-1.5 space-y-1">
              {offer.draws.map(draw => (
                <li key={draw.bucket} className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{draw.bucket}</span>
                  <span className="tabular-nums">{money(draw.amount)}</span>
                </li>
              ))}
            </ul>
          </details>

          <p className="mt-2 text-xs text-muted-foreground">
            Leave this off and your money splits the usual way.
          </p>
        </div>
      </div>
    </div>
  )
}
