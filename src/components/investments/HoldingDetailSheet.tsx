import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'
import type { InstrumentHistory, InvestmentPortfolio, InvestmentRange } from '../../types'
import { fetchInstrumentHistory } from '../../lib/api'
import { formatCurrencyVal } from '../../lib/utils'
import { BottomSheet } from '../ui/BottomSheet'
import { Button } from '../ui/Button'
import { AmountText } from '../ui/AmountText'
import { InfoHint } from '../ui/InfoHint'
import { TickerTile } from './HoldingsList'
import { chartRanges } from '../../lib/investmentChartRanges'
import { splitUnrealisedGain } from '../../lib/investmentGainSplit'
import { FundPriceChart } from './FundPriceChart'

type Holding = InvestmentPortfolio['holdings'][number]

const figure = (value: number | undefined, currency: string, masked: boolean) =>
  masked ? '••••' : value === undefined ? 'Unavailable' : formatCurrencyVal(value, currency)

/**
 * Everything about one fund in one place: what it has done, what it cost, and what
 * it has paid out. Opened from a holding row on the investments page.
 */
export function HoldingDetailSheet({ holding, appCurrency, masked, portfolioUpdatedAt, onClose }: {
  holding: Holding | null
  appCurrency: string
  masked: boolean
  portfolioUpdatedAt?: string
  onClose: () => void
}) {
  const [range, setRange] = useState<InvestmentRange>('1y')
  const [history, setHistory] = useState<InstrumentHistory | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const instrumentId = holding?.instrumentId
  // Focus lands on the sheet itself, not on the first explanation button, whose tooltip would
  // otherwise open over the figures the moment the sheet appears.
  const initialFocusRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!instrumentId) return
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    fetchInstrumentHistory(instrumentId, range, controller.signal)
      .then(value => setHistory(value))
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return
        setError(cause instanceof Error ? cause.message : 'Could not load this fund’s history')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [instrumentId, portfolioUpdatedAt, range])

  // Keep the previous fund's chart from flashing into the next one's sheet.
  useEffect(() => { setHistory(null) }, [instrumentId])

  // The fund is priced in its own currency but your money is counted in yours, so
  // every figure is tagged. Without the tag the two sets look contradictory: the
  // price can fall while your gain rises, purely because the exchange rate moved.
  const foreign = holding !== null && holding.currency.toUpperCase() !== appCurrency.toUpperCase()
  const gainSplit = holding === null ? undefined : splitUnrealisedGain(holding, appCurrency)
  // Worth calling out only when the exchange rate is the larger force of the two.
  const dominatedByCurrency = gainSplit !== undefined &&
    Math.abs(gainSplit.currency) > Math.abs(gainSplit.price)

  const units = holding === null ? '' : new Intl.NumberFormat(undefined, { maximumFractionDigits: 8 }).format(holding.units)
  const exact = (value: number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 8 }).format(value)
  const rows = holding === null ? [] : [
    { label: 'Units', value: masked ? '••••' : units, hint: 'How many units you hold.' },
    { label: `Latest price (${holding.currency})`, value: figure(holding.latestPriceNative, holding.currency, masked), hint: 'The most recent price on record, in the fund’s own currency.' },
    { label: `Avg price paid (${holding.currency})`, value: figure(holding.averageCostNative, holding.currency, masked), hint: `Your average cost for one unit, in the fund’s own currency.` },
    ...(foreign ? [{ label: `Value in ${holding.currency}`, value: figure(holding.valueNative, holding.currency, masked), hint: 'What these units are worth in the fund’s own currency, before the exchange rate.' }] : []),
    {
      label: `Gain on paper (${appCurrency})`,
      value: figure(holding.unrealisedProfitLossApp, appCurrency, masked),
      tone: holding.unrealisedProfitLossApp,
      hint: foreign
        ? `Profit or loss you have not locked in yet, in ${appCurrency}. It moves with the price and with the ${holding.currency}/${appCurrency} exchange rate.`
        : 'Profit or loss you have not locked in yet, because you still hold these units.',
    },
    { label: `Latest value move (${appCurrency})`, value: figure(holding.dailyChangeApp, appCurrency, masked), tone: holding.dailyChangeApp, hint: 'Move between its two latest saved prices and exchange rates. It may be from an earlier market day.' },
    { label: `Already banked (${appCurrency})`, value: figure(holding.realisedProfitLossApp, appCurrency, masked), tone: holding.realisedProfitLossApp, hint: 'Profit or loss locked in on units you have sold, after fees and taxes.' },
    { label: `Dividends (${appCurrency})`, value: figure(holding.netDividendsApp, appCurrency, masked), hint: 'Payouts this fund has paid you, after any tax withheld.' },
  ]
  const toneClass = (value?: number) => masked || value === undefined
    ? 'text-foreground'
    : value >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'

  return (
    <BottomSheet
      isOpen={holding !== null}
      onClose={onClose}
      maxWidthClassName="max-w-2xl"
      initialFocusRef={initialFocusRef}
      title={holding === null ? '' : <span className="flex min-w-0 items-center gap-3"><TickerTile symbol={holding.symbol} /><span className="flex min-w-0 flex-col"><span className="text-section">{holding.symbol}</span><span className="truncate text-caption font-normal text-muted-foreground">{holding.name}</span></span></span>}
      ariaLabel={holding === null ? 'Fund details' : `Details for ${holding.symbol}`}
      description={holding === null ? undefined : `Held in ${holding.accountName}${history?.firstBoughtOn ? ` · first bought ${history.firstBoughtOn}` : ''}`}
    >
      {holding !== null && (
        <div ref={initialFocusRef} tabIndex={-1} className="space-y-5 outline-none">
          <div>
            <p className="text-label text-muted-foreground">Latest value ({appCurrency})</p>
            {holding.valueApp === undefined
              ? <p className="mt-1 text-title text-muted-foreground">{holding.latestPriceNative === undefined ? 'No price yet' : 'Exchange rate missing'}</p>
              : <AmountText value={holding.valueApp} currency={appCurrency} isMasked={masked} className="mt-1 text-display text-foreground" />}
            {!masked && holding.unrealisedProfitLossApp !== undefined && (
              <p className="mt-1 text-label text-muted-foreground">
                <span className={`font-semibold tabular-nums ${toneClass(holding.unrealisedProfitLossApp)}`}>
                  {holding.unrealisedProfitLossApp > 0 ? '+' : ''}{formatCurrencyVal(holding.unrealisedProfitLossApp, appCurrency)} · {(holding.unrealisedPercent ?? 0).toFixed(1)}%
                </span> on paper
              </p>
            )}
          </div>

          <dl className="grid divide-y divide-border/50 rounded-control bg-surface-2/70 px-4 sm:grid-cols-2 sm:gap-x-6 sm:divide-y-0">
            {rows.map(row => (
              <div key={row.label} className="flex min-h-11 items-center justify-between gap-3 py-2 sm:border-b sm:border-border/50 sm:[&:nth-last-child(-n+2)]:border-b-0">
                <dt className="flex min-w-0 items-center gap-0.5 text-label text-muted-foreground">
                  <span className="truncate">{row.label}</span>
                  <InfoHint label={row.label} text={row.hint} />
                </dt>
                <dd className={`shrink-0 text-right text-label font-semibold tabular-nums ${toneClass(row.tone)}`}>{row.value}</dd>
              </div>
            ))}
          </dl>

          <div>
            {/* One scrolling line rather than a wrapping block: seven buttons wrapped
                to two ragged rows on a phone. */}
            <div className="no-scrollbar -mx-1 flex gap-0.5 overflow-x-auto rounded-full bg-surface-2 p-1 sm:mx-0 sm:w-fit" role="group" aria-label="Price history range">
              {chartRanges.map(item => (
                <Button
                  key={item.value}
                  type="button"
                  variant="tertiary"
                  size="sm"
                  onClick={() => setRange(item.value)}
                  aria-pressed={range === item.value}
                  className={`shrink-0 px-3 ${range === item.value ? 'bg-card text-foreground shadow-xs hover:bg-card dark:bg-surface-3' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {item.label}
                </Button>
              ))}
            </div>
            {/* Mirrors the portfolio chart: the previous range stays on screen under
                a spinner rather than collapsing to an empty box on every switch. */}
            <div className="relative mt-4">
              {loading && (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                  <span className="flex items-center gap-2 rounded-full bg-card px-3.5 py-1.5 text-caption font-medium text-muted-foreground shadow-(--app-shadow-overlay)">
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> Loading…
                  </span>
                </div>
              )}
              {error !== null ? (
                <p className="text-caption text-red-600 dark:text-red-400">{error}</p>
              ) : history === null ? (
                <div className="h-40" />
              ) : (
                <div className={loading ? 'select-none opacity-50 transition-opacity duration-200' : 'transition-opacity duration-200'} aria-hidden={loading}>
                  <FundPriceChart history={history} masked={masked} />
                </div>
              )}
            </div>
            {foreign && gainSplit !== undefined && (
              <p className="mt-3 rounded-control bg-surface-2/70 p-3 text-caption leading-relaxed text-muted-foreground">
                Of your {figure(holding.unrealisedProfitLossApp, appCurrency, masked)} gain on paper,{' '}
                <b className={masked ? '' : toneClass(gainSplit.price)}>
                  {figure(gainSplit.price, appCurrency, masked)}
                </b>{' '}
                came from the fund’s price and{' '}
                <b className={masked ? '' : toneClass(gainSplit.currency)}>
                  {figure(gainSplit.currency, appCurrency, masked)}
                </b>{' '}
                from the {holding.currency}/{appCurrency} exchange rate
                {dominatedByCurrency ? ' — most of this move is the exchange rate, not the fund' : ''}.
              </p>
            )}
          </div>

          <details className="group rounded-control bg-surface-2/70">
            <summary className="flex min-h-11 cursor-pointer select-none items-center justify-between gap-2 px-4 text-label font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50">
              How this was worked out
              <ChevronDown className="size-4 shrink-0 transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className="space-y-2 border-t border-border/50 px-4 py-3 text-caption text-muted-foreground">
              <p className="break-words font-medium tabular-nums text-foreground">
                {masked
                  ? 'Hidden while balances are hidden'
                  : holding.latestPriceNative === undefined
                    ? 'Closing price unavailable'
                    : `${units} × ${exact(holding.latestPriceNative)} ${holding.currency}${foreign
                      ? ` × ${holding.fxRate === undefined ? 'missing FX' : exact(holding.fxRate)} = ${holding.valueApp === undefined ? 'incomplete' : formatCurrencyVal(holding.valueApp, appCurrency)}`
                      : ''}`}
              </p>
              <p>Price from {holding.priceSource ?? 'no source on record'} · {holding.priceDate ?? 'no date'}</p>
              {holding.fxSource && <p>Exchange rate from {holding.fxSource} · {holding.fxDate ?? 'no date'}</p>}
            </div>
          </details>
        </div>
      )}
    </BottomSheet>
  )
}
