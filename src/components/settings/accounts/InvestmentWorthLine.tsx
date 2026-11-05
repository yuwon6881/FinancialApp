import { TrendingUp } from 'lucide-react'
import type { InvestmentMarketValue } from '../../../lib/investmentMarketValue'
import { formatCurrencyVal } from '../../../lib/utils'
import { SensitiveAmount } from '../../ui/SensitiveAmount'

/**
 * The Accounts total counts what was sent to the broker, because that is what the ledger records.
 * This line adds what the market made of it, at today's prices, without touching any balance.
 */
export function InvestmentWorthLine({ value, ledgerTotal, currency, hideSensitive }: {
  value: InvestmentMarketValue
  ledgerTotal: number
  currency: string
  hideSensitive: boolean
}) {
  const money = (amount: number) => formatCurrencyVal(amount, currency)
  if (value.kind === 'unknown') {
    return (
      <p className="mt-4 flex items-start gap-2 border-t border-border/60 pt-4 text-caption text-muted-foreground">
        <TrendingUp className="mt-px size-4 shrink-0" aria-hidden="true" />
        Investments are counted at what you sent the broker. Their worth today shows here once prices arrive.
      </p>
    )
  }
  const { worth, sent, gain } = value
  const direction = gain === 0 ? 'the same as' : gain > 0 ? `${money(gain)} more than` : `${money(-gain)} less than`
  return (
    <div className="mt-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-1 border-t border-border/60 pt-4">
      <div className="min-w-0 max-w-prose">
        <p className="text-label font-medium text-foreground">With investments at today’s prices</p>
        <p className="mt-0.5 text-caption text-muted-foreground">
          {hideSensitive
            ? 'Investments are counted above at what you sent the broker; this adds what the market made of it.'
            : `Investments are worth ${money(worth)} today, ${direction} the ${money(sent)} you sent the broker, which is what the total above counts.`}
        </p>
      </div>
      <SensitiveAmount
        value={ledgerTotal + gain}
        isMasked={hideSensitive}
        formatFn={money}
        className="text-section font-semibold text-foreground tabular-nums"
      />
    </div>
  )
}
