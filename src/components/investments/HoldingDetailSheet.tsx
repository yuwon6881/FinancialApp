import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { InstrumentHistory, InvestmentPortfolio, InvestmentRange } from '../../types'
import { fetchInstrumentHistory } from '../../lib/api'
import { formatCurrencyVal } from '../../lib/utils'
import { BottomSheet } from '../ui/BottomSheet'
import { Button } from '../ui/Button'
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
export function HoldingDetailSheet({ holding, appCurrency, masked, onClose }: {
  holding: Holding | null
  appCurrency: string
  masked: boolean
  onClose: () => void
}) {
  const [range, setRange] = useState<InvestmentRange>('1y')
  const [history, setHistory] = useState<InstrumentHistory | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const instrumentId = holding?.instrumentId

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
  }, [instrumentId, range])

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

  const rows = holding === null ? [] : [
    { label: `Latest value (${appCurrency})`, value: figure(holding.valueApp, appCurrency, masked), hint: 'Value of these units using the latest saved price and exchange rate.' },
    { label: 'Units', value: masked ? '••••' : new Intl.NumberFormat(undefined, { maximumFractionDigits: 8 }).format(holding.units), hint: 'How many units you hold.' },
    { label: `Avg price paid (${holding.currency})`, value: figure(holding.averageCostNative, holding.currency, masked), hint: `Your average cost for one unit, in the fund’s own currency.` },
    { label: `Latest price (${holding.currency})`, value: figure(holding.latestPriceNative, holding.currency, masked), hint: 'The most recent price on record, in the fund’s own currency.' },
    {
      label: `Gain on paper (${appCurrency})`,
      value: figure(holding.unrealisedProfitLossApp, appCurrency, masked),
      tone: holding.unrealisedProfitLossApp,
      hint: foreign
        ? `Profit or loss you have not locked in yet, in ${appCurrency}. It moves with the price and with the ${holding.currency}/${appCurrency} exchange rate.`
        : 'Profit or loss you have not locked in yet, because you still hold these units.',
    },
    { label: `Already banked (${appCurrency})`, value: figure(holding.realisedProfitLossApp, appCurrency, masked), tone: holding.realisedProfitLossApp, hint: 'Profit or loss locked in on units you have sold, after fees and taxes.' },
    { label: `Dividends (${appCurrency})`, value: figure(holding.netDividendsApp, appCurrency, masked), hint: 'Payouts this fund has paid you, after any tax withheld.' },
    { label: `Latest value move (${appCurrency})`, value: figure(holding.dailyChangeApp, appCurrency, masked), tone: holding.dailyChangeApp, hint: 'Move between its two latest saved prices and exchange rates. It may be from an earlier market day.' },
  ]

  return (
    <BottomSheet
      isOpen={holding !== null}
      onClose={onClose}
      maxWidthClassName="max-w-2xl"
      title={holding === null ? '' : <span className="flex flex-col"><span className="text-base font-bold">{holding.symbol}</span><span className="text-xs font-normal text-muted-foreground">{holding.name}</span></span>}
      ariaLabel={holding === null ? 'Fund details' : `Details for ${holding.symbol}`}
      description={holding === null ? undefined : `Held in ${holding.accountName}${history?.firstBoughtOn ? ` · first bought ${history.firstBoughtOn}` : ''}`}
    >
      {holding !== null && (
        <div className="space-y-5">
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            {rows.map(row => (
              <div key={row.label} className="rounded-xl border border-border/50 bg-muted/20 p-2.5 sm:p-3">
                <dt className="text-xs leading-tight text-muted-foreground">{row.label}</dt>
                <dd className={`mt-1 break-words text-sm font-bold ${row.tone === undefined ? 'text-foreground' : row.tone >= 0 ? 'text-emerald-500' : 'text-orange-500'}`}>
                  {row.value}
                </dd>
                <p className="mt-1 text-xs leading-snug text-muted-foreground">{row.hint}</p>
              </div>
            ))}
          </dl>

          <div className="rounded-xl border border-border/50 bg-muted/20 p-3 sm:p-4">
            {/* One scrolling line rather than a wrapping block: seven buttons wrapped
                to two ragged rows on a phone. */}
            <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto rounded-xl bg-muted/40 p-1 sm:mx-0 sm:justify-end" role="group" aria-label="Price history range">
              {chartRanges.map(item => (
                <Button
                  key={item.value}
                  type="button"
                  variant="unstyled"
                  onClick={() => setRange(item.value)}
                  aria-pressed={range === item.value}
                  className={`cursor-pointer whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${range === item.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {item.label}
                </Button>
              ))}
            </div>
            {/* Mirrors the portfolio chart: the previous range stays on screen under
                a spinner rather than collapsing to an empty box on every switch. */}
            <div className="relative mt-4">
              {loading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                  <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/80 px-4 py-2 shadow-sm backdrop-blur-sm">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    <span className="text-xs font-semibold text-muted-foreground">Loading…</span>
                  </div>
                </div>
              )}
              {error !== null ? (
                <p className="text-xs text-orange-500">{error}</p>
              ) : history === null ? (
                <div className="h-40" />
              ) : (
                <div className={loading ? 'select-none blur-md transition-[filter] duration-200' : 'transition-[filter] duration-200'} aria-hidden={loading}>
                  <FundPriceChart history={history} masked={masked} />
                </div>
              )}
            </div>
            {foreign && (
              <div className="mt-3 rounded-lg bg-background/50 p-2.5 text-xs leading-relaxed text-muted-foreground">
                <p>
                  Prices use {holding.currency}; gains use {appCurrency}, so they may differ.
                </p>
                {gainSplit !== undefined && (
                  <p className="mt-1.5">
                    Of your {figure(holding.unrealisedProfitLossApp, appCurrency, masked)} gain on paper,{' '}
                    <b className={gainSplit.price >= 0 ? 'text-emerald-500' : 'text-orange-500'}>
                      {figure(gainSplit.price, appCurrency, masked)}
                    </b>{' '}
                    came from the fund’s price and{' '}
                    <b className={gainSplit.currency >= 0 ? 'text-emerald-500' : 'text-orange-500'}>
                      {figure(gainSplit.currency, appCurrency, masked)}
                    </b>{' '}
                    from the {holding.currency}/{appCurrency} exchange rate
                    {dominatedByCurrency ? ' — most of this move is the exchange rate, not the fund' : ''}.
                  </p>
                )}
              </div>
            )}
          </div>

          <details className="rounded-xl border border-border/50 bg-muted/20 p-3">
            <summary className="cursor-pointer select-none text-xs font-bold text-muted-foreground outline-none">
              How this was worked out
            </summary>
            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
              <p>Prices in {holding.currency}, converted to {appCurrency} where the two differ.</p>
              <p>Price from {holding.priceSource ?? 'no source on record'} · {holding.priceDate ?? 'no date'}</p>
              {holding.fxSource && <p>Exchange rate from {holding.fxSource} · {holding.fxDate ?? 'no date'}</p>}
              <p>To see this fund’s buys, sells and dividends, filter the activity list on the investments page by {holding.symbol}.</p>
            </div>
          </details>
        </div>
      )}
    </BottomSheet>
  )
}
