import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { InstrumentHistory, InvestmentPortfolio, InvestmentRange } from '../../types'
import { fetchInstrumentHistory } from '../../lib/api'
import { formatCurrencyVal } from '../../lib/utils'
import { BottomSheet } from '../ui/BottomSheet'
import { Button } from '../ui/Button'
import { chartRanges } from '../../lib/investmentChartRanges'
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

  const rows = holding === null ? [] : [
    { label: 'Worth now', value: figure(holding.valueApp, appCurrency, masked), hint: 'What these units would be worth at the latest price.' },
    { label: 'Units', value: masked ? '••••' : new Intl.NumberFormat(undefined, { maximumFractionDigits: 8 }).format(holding.units), hint: 'How many units you hold.' },
    { label: 'Avg price paid', value: figure(holding.averageCostNative, holding.currency, masked), hint: 'Your average cost for one unit, across every purchase.' },
    { label: 'Latest price', value: figure(holding.latestPriceNative, holding.currency, masked), hint: 'The most recent price on record.' },
    { label: 'Gain on paper', value: figure(holding.unrealisedProfitLossApp, appCurrency, masked), tone: holding.unrealisedProfitLossApp, hint: 'Profit or loss you have not locked in yet, because you still hold these units.' },
    { label: 'Already banked', value: figure(holding.realisedProfitLossApp, appCurrency, masked), tone: holding.realisedProfitLossApp, hint: 'Profit or loss locked in on units you have sold, after fees and taxes.' },
    { label: 'Dividends', value: figure(holding.netDividendsApp, appCurrency, masked), hint: 'Payouts this fund has paid you, after any tax withheld.' },
    { label: 'Change today', value: figure(holding.dailyChangeApp, appCurrency, masked), tone: holding.dailyChangeApp, hint: 'How much its value moved since the previous price.' },
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
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {rows.map(row => (
              <div key={row.label} className="rounded-xl border border-border/50 bg-muted/20 p-3">
                <dt className="text-[10px] text-muted-foreground">{row.label}</dt>
                <dd className={`mt-1 break-words text-sm font-bold ${row.tone === undefined ? 'text-foreground' : row.tone >= 0 ? 'text-emerald-500' : 'text-orange-500'}`}>
                  {row.value}
                </dd>
                <p className="mt-1 text-[9px] leading-snug text-muted-foreground">{row.hint}</p>
              </div>
            ))}
          </dl>

          <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
            <div className="flex flex-wrap justify-end gap-1 rounded-xl bg-muted/40 p-1" role="group" aria-label="Price history range">
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
            <div className="mt-4">
              {loading && history === null ? (
                <div className="flex h-40 items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Loading…
                </div>
              ) : error !== null ? (
                <p className="text-xs text-orange-500">{error}</p>
              ) : history === null ? null : (
                <FundPriceChart history={history} masked={masked} />
              )}
            </div>
          </div>

          <details className="rounded-xl border border-border/50 bg-muted/20 p-3">
            <summary className="cursor-pointer select-none text-[10px] font-bold text-muted-foreground outline-none">
              How this was worked out
            </summary>
            <div className="mt-2 space-y-1 text-[10px] text-muted-foreground">
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
