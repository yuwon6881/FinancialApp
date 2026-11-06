import type { InvestmentMarketValue } from '../../../lib/investmentMarketValue'
import { formatCurrencyVal } from '../../../lib/utils'
import { SensitiveAmount } from '../../ui/SensitiveAmount'
import { WorthGainChip } from './WorthGainChip'

/**
 * The Growth bucket's header figures: what it is worth at today's prices (primary) beside the
 * money put in, which is the ledger balance and still what the account rows below add up to.
 * Worth is the ledger balance plus the portfolio's gain, so it always agrees with the Accounts
 * total; an unknown gain leaves the worth unknown rather than repeating the money in.
 */
export function BucketWorthFigures({ moneyIn, value, currency, hideSensitive }: {
  moneyIn: number
  value: InvestmentMarketValue
  currency: string
  hideSensitive: boolean
}) {
  const money = (amount: number) => formatCurrencyVal(amount, currency)
  return (
    <dl className="flex w-full items-end justify-between gap-x-5 @md:w-auto">
      <div className="min-w-0">
        <dt className="text-caption text-muted-foreground">Worth today</dt>
        <dd>
          {value.kind === 'unknown'
            ? <span className="block text-title text-muted-foreground">Unknown</span>
            : <SensitiveAmount value={moneyIn + value.gain} isMasked={hideSensitive} formatFn={money} className="block text-title text-foreground tabular-nums" />}
          {value.kind === 'known' && !hideSensitive && <WorthGainChip gain={value.gain} money={money} className="mt-1" />}
        </dd>
      </div>
      <div className="min-w-0 text-right">
        <dt className="text-caption text-muted-foreground">Money in</dt>
        <dd><SensitiveAmount value={moneyIn} isMasked={hideSensitive} formatFn={money} className="block text-label font-semibold text-foreground tabular-nums" /></dd>
      </div>
    </dl>
  )
}
