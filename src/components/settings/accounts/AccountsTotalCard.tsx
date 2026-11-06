import { TrendingUp } from 'lucide-react'
import { getCategoryChartColor } from '../../../lib/categoryColors'
import type { InvestmentMarketValue } from '../../../lib/investmentMarketValue'
import { formatCurrencyVal } from '../../../lib/utils'
import { SegmentedMeter } from '../../ui/SegmentedMeter'
import { SensitiveAmount } from '../../ui/SensitiveAmount'
import { panelClass } from '../../ui/panelStyles'
import { WorthGainChip } from './WorthGainChip'

export type BucketTotal = { bucket: string; total: number }

const figureClass = 'mt-1 block text-display text-foreground tabular-nums sm:text-hero'
// The money-in figure is the supporting one beside the larger worth figure.
const secondaryFigureClass = 'mt-1 block text-title text-foreground tabular-nums'

/**
 * The Accounts total, as two figures once investments exist: what the whole is worth at today's
 * prices (primary, larger) beside the money in the ledger (cash plus what was sent to the broker).
 * The ledger figure keeps matching the bank balances and the bucket bar; the worth figure is read
 * from the investment ledger and never written back, so the gap can grow without the total
 * ever overstating what was actually deposited.
 */
export function AccountsTotalCard({ bucketTotals, netTotal, investmentValue, openAccountCount, archivedAccountCount, currency, hideSensitive }: {
  bucketTotals: BucketTotal[]
  netTotal: number
  investmentValue: InvestmentMarketValue | null
  openAccountCount: number
  archivedAccountCount: number
  currency: string
  hideSensitive: boolean
}) {
  const money = (value: number) => formatCurrencyVal(value, currency)
  return (
    <div id="accounts-total-card" className={`${panelClass} p-5 sm:p-6`}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="grid min-w-0 grow gap-x-8 gap-y-4 sm:grid-cols-[auto_auto] sm:justify-start">
          {investmentValue ? (
            <>
              <div className="min-w-0">
                <p className="text-label text-muted-foreground">Worth today</p>
                <WorthFigure value={investmentValue} netTotal={netTotal} money={money} hideSensitive={hideSensitive} />
              </div>
              <div className="min-w-0 sm:self-start sm:border-l sm:border-border/60 sm:pl-8">
                <p className="text-label text-muted-foreground">Money in accounts</p>
                <SensitiveAmount value={netTotal} isMasked={hideSensitive} formatFn={money} className={secondaryFigureClass} />
              </div>
            </>
          ) : (
            <div className="min-w-0">
              <p className="text-label text-muted-foreground">Total across accounts</p>
              <SensitiveAmount value={netTotal} isMasked={hideSensitive} formatFn={money} className={figureClass} />
            </div>
          )}
        </div>
        <p className="text-label text-muted-foreground">
          {openAccountCount} open {openAccountCount === 1 ? 'account' : 'accounts'}
          {archivedAccountCount > 0 && <> · {archivedAccountCount} closed</>}
        </p>
      </div>
      <SegmentedMeter
        className="mt-5"
        label={bucketTotals.map(item => `${item.bucket} ${hideSensitive ? '' : money(item.total)}`.trim()).join(', ')}
        segments={bucketTotals.map(item => ({ label: item.bucket, value: Math.max(0, item.total), color: getCategoryChartColor(item.bucket) }))}
      />
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-label">
        {bucketTotals.map(item => (
          <li key={item.bucket} className="flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: getCategoryChartColor(item.bucket) }} />
            <span className="text-muted-foreground">{item.bucket}</span>
            <SensitiveAmount value={item.total} isMasked={hideSensitive} formatFn={money} className="font-medium text-foreground tabular-nums" />
          </li>
        ))}
      </ul>
      {investmentValue && <WorthNote value={investmentValue} money={money} hideSensitive={hideSensitive} />}
    </div>
  )
}

function WorthFigure({ value, netTotal, money, hideSensitive }: {
  value: InvestmentMarketValue
  netTotal: number
  money: (amount: number) => string
  hideSensitive: boolean
}) {
  // A missing price or rate leaves the worth unknown; it is never shown as the money sent.
  if (value.kind === 'unknown') return <p className={`${figureClass} text-muted-foreground`}>Unknown</p>
  const { gain } = value
  return (
    <>
      <SensitiveAmount value={netTotal + gain} isMasked={hideSensitive} formatFn={money} className={figureClass} />
      {!hideSensitive && (
        <WorthGainChip gain={gain} money={money} className="mt-1.5" />
      )}
    </>
  )
}

function WorthNote({ value, money, hideSensitive }: {
  value: InvestmentMarketValue
  money: (amount: number) => string
  hideSensitive: boolean
}) {
  const text = value.kind === 'unknown'
    ? 'Investments are counted at what you sent the broker. Their worth today shows here once prices arrive.'
    : hideSensitive
      ? 'Money in is what the ledger records; worth today adds what the market made of the investments.'
      : `Investments are worth ${money(value.worth)} today, against the ${money(value.sent)} you sent the broker. The balances and bars above show money in.`
  return (
    <p className="mt-4 flex items-start gap-2 border-t border-border/60 pt-4 text-caption text-muted-foreground">
      <TrendingUp className="mt-px size-4 shrink-0" aria-hidden="true" />
      {text}
    </p>
  )
}
