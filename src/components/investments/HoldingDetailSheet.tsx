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

  // Every figure is in the fund's own currency, so a move in the exchange rate can never make the
  // fund look better or worse than its price did. Only the headline also reads in your currency,
  // at today's rate, so it adds up with the rest of the portfolio.
  const foreign = holding !== null && holding.currency.toUpperCase() !== appCurrency.toUpperCase()

  const units = holding === null ? '' : new Intl.NumberFormat(undefined, { maximumFractionDigits: 8 }).format(holding.units)
  const exact = (value: number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 8 }).format(value)
  const rows = holding === null ? [] : [
    { label: 'Units', value: masked ? '••••' : units, hint: 'How many units you hold.' },
    { label: 'Latest price', value: figure(holding.latestPriceNative, holding.currency, masked), hint: 'The most recent price on record.' },
    { label: 'Avg price paid', value: figure(holding.averageCostNative, holding.currency, masked), hint: 'Your average cost for one unit, including fees.' },
    { label: 'You paid', value: figure(holding.costBasisNative, holding.currency, masked), hint: 'What the units you still hold cost you, including fees.' },
    {
      label: 'Gain on paper',
      value: figure(holding.unrealisedProfitLossNative, holding.currency, masked),
      tone: holding.unrealisedProfitLossNative,
      hint: 'Profit or loss you have not locked in yet, because you still hold these units.',
    },
    { label: 'Latest value move', value: figure(holding.dailyChangeNative, holding.currency, masked), tone: holding.dailyChangeNative, hint: 'Move between its two latest saved prices. It may be from an earlier market day.' },
    { label: 'Already banked', value: figure(holding.realisedProfitLossNative, holding.currency, masked), tone: holding.realisedProfitLossNative, hint: 'Profit or loss locked in on units you have sold, after fees and taxes.' },
    { label: 'Dividends', value: figure(holding.netDividendsNative, holding.currency, masked), hint: 'Payouts this fund has paid you, after any tax withheld.' },
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
        <div className="space-y-5">
          {/* A focus target already in view, so opening the sheet neither scrolls it nor opens a hint. */}
          <div ref={initialFocusRef} tabIndex={-1} className="h-0 outline-none" />
          <div>
            <p className="text-label text-muted-foreground">Latest value</p>
            {holding.valueNative === undefined
              ? <p className="mt-1 text-title text-muted-foreground">No price yet</p>
              : <AmountText value={holding.valueNative} currency={holding.currency} isMasked={masked} className="mt-1 text-display text-foreground" />}
            {!masked && holding.unrealisedProfitLossNative !== undefined && (
              <p className="mt-1 text-label text-muted-foreground">
                <span className={`font-semibold tabular-nums ${toneClass(holding.unrealisedProfitLossNative)}`}>
                  {holding.unrealisedProfitLossNative > 0 ? '+' : ''}{formatCurrencyVal(holding.unrealisedProfitLossNative, holding.currency)} · {(holding.unrealisedPercent ?? 0).toFixed(1)}%
                </span> on paper
              </p>
            )}
            {foreign && holding.valueNative !== undefined && (
              <p className="mt-1 text-label text-muted-foreground">
                {holding.valueApp === undefined
                  ? `Waiting on today's ${holding.currency}/${appCurrency} rate`
                  : <>About {figure(holding.valueApp, appCurrency, masked)} at today’s rate</>}
              </p>
            )}
          </div>

          <dl className="grid divide-y divide-foreground/10 rounded-control inset-group px-4 sm:grid-cols-2 sm:gap-x-6 sm:divide-y-0">
            {rows.map(row => (
              <div key={row.label} className="flex min-h-11 items-center justify-between gap-3 py-0.5 sm:border-b sm:border-foreground/10 sm:[&:nth-last-child(-n+2)]:border-b-0">
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
            {foreign && (
              <p className="mt-3 rounded-control inset-group p-3 text-caption leading-relaxed text-muted-foreground">
                Every figure here is in {holding.currency}, the fund’s own currency, so it shows what the fund did
                and the exchange rate never moves it. Your portfolio totals convert it at today’s rate.
              </p>
            )}
          </div>

          <details className="group rounded-control inset-group">
            <summary className="flex min-h-11 cursor-pointer select-none items-center justify-between gap-2 px-4 text-label font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50">
              How this was worked out
              <ChevronDown className="size-4 shrink-0 transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className="space-y-2 border-t border-foreground/10 px-4 py-3 text-caption text-muted-foreground">
              <p className="break-words font-medium tabular-nums text-foreground">
                {masked
                  ? 'Hidden while balances are hidden'
                  : holding.latestPriceNative === undefined
                    ? 'Closing price unavailable'
                    : `${units} × ${exact(holding.latestPriceNative)} ${holding.currency}${foreign
                      ? ` × ${holding.fxRate === undefined ? 'no rate today' : exact(holding.fxRate)} = ${holding.valueApp === undefined ? 'incomplete' : formatCurrencyVal(holding.valueApp, appCurrency)}`
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
