import { m, useReducedMotion } from 'framer-motion'
import type { InstrumentHistory } from '../../types'
import { polylinePoints, seriesBounds, yAt } from '../../lib/chartSeries'
import { formatCurrencyVal } from '../../lib/utils'

const WIDTH = 720
const HEIGHT = 200

/**
 * One fund's price over the chosen period, with the price the owner actually paid
 * drawn across it — the comparison that answers "am I up on this?" at a glance.
 */
export function FundPriceChart({ history, masked }: { history: InstrumentHistory; masked: boolean }) {
  const reduceMotion = useReducedMotion()
  const prices = history.points.map(point => point.price)
  const money = (value: number) => formatCurrencyVal(value, history.currency)

  if (prices.length < 2) {
    return (
      <p className="rounded-xl border border-border/50 bg-muted/20 p-4 text-xs text-muted-foreground">
        There is not enough price history stored for this fund yet. Prices arrive when you refresh
        them on the investments page; funds you track by hand never have a price line.
      </p>
    )
  }

  // Tracked on the price's own scale, not from zero: a fund moving between 400 and
  // 420 would otherwise draw as a flat line pinned to the top of the box.
  const bounds = seriesBounds([...prices, history.averageCostNative], false)
  const geometry = { width: WIDTH, height: HEIGHT, min: bounds.min, max: bounds.max }
  const first = prices[0]
  const last = prices[prices.length - 1]
  const change = last - first
  const changePercent = first === 0 ? undefined : (change / first) * 100
  const low = Math.min(...prices)
  const high = Math.max(...prices)
  const paidLine = history.averageCostNative === undefined ? undefined : yAt(history.averageCostNative, geometry)
  const paidComparison = history.averageCostNative === undefined ? undefined : last - history.averageCostNative
  const rising = change >= 0
  const summary = `${history.symbol} moved from ${money(first)} on ${history.points[0].date} to ${money(last)} on ${history.points[prices.length - 1].date}${changePercent === undefined ? '' : `, a change of ${changePercent.toFixed(1)} percent`}.`

  return (
    <section aria-labelledby="fund-price-title">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h3 id="fund-price-title" className="text-xs font-bold text-foreground">Price history</h3>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            One unit, in {history.currency}.
          </p>
        </div>
        <div className="shrink-0 text-right">
          <strong className={`block text-sm ${rising ? 'text-emerald-500' : 'text-orange-500'}`}>
            {masked ? '••••' : `${rising ? '+' : '−'}${money(Math.abs(change))}`}
          </strong>
          <span className="text-[10px] text-muted-foreground">
            {changePercent === undefined ? 'over this period' : masked ? 'Change hidden over this period' : `${rising ? '+' : ''}${changePercent.toFixed(1)}% over this period`}
          </span>
        </div>
      </div>

      {/* "Over this period" measures from the start of the window, which is not the
          question most people are asking — they want the price against what they
          themselves paid. Both are shown so neither is mistaken for the other. */}
      {paidComparison !== undefined && (
        <p className="mt-2 text-[10px] text-muted-foreground">
          The latest price is{' '}
          <b className={paidComparison >= 0 ? 'text-emerald-500' : 'text-orange-500'}>
            {masked ? '••••' : `${money(Math.abs(paidComparison))} ${paidComparison >= 0 ? 'above' : 'below'}`}
          </b>{' '}
          what you paid on average.
        </p>
      )}

      <p className="sr-only">{masked ? 'Fund price history values are hidden.' : summary}</p>
      <div className={`mt-3 ${masked ? 'select-none blur-md' : ''}`} aria-hidden={masked}>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          className="h-40 w-full overflow-visible"
          role="img"
          aria-label={masked ? 'Fund price history values hidden' : summary}
        >
          <defs>
            <linearGradient id="fundPriceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--ledger-purple-500)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--ledger-purple-500)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <m.polygon
            points={`0,${HEIGHT} ${polylinePoints(prices, geometry)} ${WIDTH},${HEIGHT}`}
            fill="url(#fundPriceGradient)"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          />
          <m.polyline
            points={polylinePoints(prices, geometry)}
            fill="none"
            stroke="var(--ledger-purple-500)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="nonScalingStroke"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          />
          {paidLine !== undefined && (
            <line
              x1="0"
              x2={WIDTH}
              y1={paidLine}
              y2={paidLine}
              stroke="var(--ledger-pending-500)"
              strokeWidth="2"
              strokeDasharray="7 6"
              vectorEffect="nonScalingStroke"
            />
          )}
        </svg>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-semibold text-muted-foreground">
        <span><i className="mr-1 inline-block size-2 rounded-full bg-violet-500" /> Price</span>
        {history.averageCostNative !== undefined && (
          <span><i className="mr-1 inline-block w-4 border-t-2 border-dashed border-amber-500 align-middle" /> What you paid on average</span>
        )}
        <span>Lowest {masked ? '••••' : money(low)}</span>
        <span>Highest {masked ? '••••' : money(high)}</span>
      </div>

      <div className="sr-only">
        <table>
          <caption>Price history for {history.symbol}</caption>
          <thead><tr><th>Date</th><th>Price</th></tr></thead>
          <tbody>
            {history.points.map(point => (
              <tr key={point.date}><td>{point.date}</td><td>{masked ? 'Hidden' : point.price}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
