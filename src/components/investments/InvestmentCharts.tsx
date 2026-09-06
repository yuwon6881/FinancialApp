import { useRef, useState } from 'react'
import { m, useReducedMotion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import type { InvestmentPortfolio, InvestmentRange } from '../../types'
import { polylinePoints, seriesBounds, xAt, yAt } from '../../lib/chartSeries'
import { chartRanges } from '../../lib/investmentChartRanges'
import { cn, formatCurrencyVal } from '../../lib/utils'
import { Button } from '../ui/Button'
import { ResponsiveChartFrame } from '../ui/ResponsiveChartFrame'
import { panelClass } from '../ui/panelStyles'

export type { AllocationMode, AllocationFilter } from '../../lib/investmentHoldingFilter'


const money = (value: number, currency: string) =>
  formatCurrencyVal(value, currency)

export function ValueChart({ portfolio, masked, range, isFetching, onRangeChange }: {
  portfolio: InvestmentPortfolio
  masked: boolean
  range: InvestmentRange
  isFetching?: boolean
  onRangeChange: (value: InvestmentRange) => void
}) {
  const reduceMotion = useReducedMotion()
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const width = 720
  const height = 240
  const bounds = seriesBounds(portfolio.chart.flatMap(point => [point.totalValue, point.netDeposits]))
  const geometry = { width, height, min: bounds.min, max: bounds.max }
  const x = (index: number) => xAt(index, portfolio.chart.length, width)
  const y = (value: number) => yAt(value, geometry)
  const line = (key: 'totalValue' | 'netDeposits') =>
    polylinePoints(portfolio.chart.map(point => point[key]), geometry)
  const latest = portfolio.chart.at(-1)
  const hasAnyMarketValue = portfolio.chart.some(point => point.totalValue !== undefined)
  const selectNearest = (clientX: number) => {
    if (!svgRef.current || portfolio.chart.length === 0 || masked) return
    const rect = svgRef.current.getBoundingClientRect()
    const index = Math.round(((clientX - rect.left) / rect.width) * (portfolio.chart.length - 1))
    setHoveredIndex(Math.max(0, Math.min(portfolio.chart.length - 1, index)))
  }
  const summary = latest
    ? `Latest total portfolio value: ${masked || latest.totalValue === undefined ? 'hidden or incomplete' : money(latest.totalValue, portfolio.appCurrency)}; net deposits ${masked || latest.netDeposits === undefined ? 'hidden or incomplete' : money(latest.netDeposits, portfolio.appCurrency)}.`
    : 'No chart data is available.'

  return (
    <section aria-labelledby="value-chart-title" className={cn(panelClass, 'min-w-0 p-5')}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="value-chart-title" className="text-section text-foreground">Portfolio value</h2>
          <p className="mt-1 text-xs text-muted-foreground">Your investments plus cash, over time.</p>
        </div>
        <div className="flex max-w-full flex-wrap gap-1 self-start rounded-xl bg-muted/40 p-1" role="group" aria-label="Chart range">
          {chartRanges.map(item => (
            <Button
              key={item.value}
              type="button"
              variant="tertiary"
              onClick={() => onRangeChange(item.value)}
              className={`cursor-pointer whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${range === item.value ? 'bg-background hover:bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              aria-pressed={range === item.value}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </div>
      <p className="sr-only">{summary}</p>
      {portfolio.chart.length === 0 ? (
        <div className="flex h-60 items-center justify-center text-xs text-muted-foreground">Add some activity to start the history.</div>
      ) : !hasAnyMarketValue ? (
        <div className="flex h-60 flex-col items-center justify-center gap-2 text-center text-xs text-muted-foreground">
          <span className="text-amber-500 font-semibold">Chart unavailable</span>
          <span className="max-w-xs">Some prices are missing. Try "Update prices" or check the investment's market-data mapping.</span>
        </div>
      ) : (
        <div className="relative mt-5">
          {isFetching && (
            <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
              <div className="flex items-center gap-2 rounded-lg bg-background/80 px-4 py-2 shadow-sm backdrop-blur-sm border border-border/50">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground">Loading…</span>
              </div>
            </div>
          )}
          <ResponsiveChartFrame
            className={`relative cursor-crosshair ${masked || isFetching ? 'select-none blur-md pointer-events-none transition-[filter,opacity] duration-200' : 'transition-[filter,opacity] duration-200'}`}
            aria-hidden={masked}
            onMouseMove={event => selectNearest(event.clientX)}
            onMouseLeave={() => setHoveredIndex(null)}
            onTouchStart={event => selectNearest(event.touches[0].clientX)}
            onTouchMove={event => selectNearest(event.touches[0].clientX)}
          >
            <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} className="h-full w-full overflow-visible" role="img" aria-label={summary}>
              <defs>
                <linearGradient id="investmentValueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--ledger-purple-500)" stopOpacity="0.24" />
                  <stop offset="100%" stopColor="var(--ledger-purple-500)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <m.polygon
                key={`investment-area-${range}`}
                points={`0,${height} ${line('totalValue')} ${width},${height}`}
                fill="url(#investmentValueGradient)"
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.45 }}
              />
              <m.polyline key={`investment-total-${range}`} points={line('totalValue')} fill="none" stroke="var(--ledger-purple-500)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="nonScalingStroke" initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.45 }} />
              <m.polyline key={`investment-deposits-${range}`} points={line('netDeposits')} fill="none" stroke="var(--ledger-pending-500)" strokeWidth="2" strokeDasharray="7 6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="nonScalingStroke" initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.45, delay: 0.08 }} />
              {hoveredIndex !== null && portfolio.chart[hoveredIndex]?.totalValue !== undefined && (
                <>
                  <line x1={x(hoveredIndex)} x2={x(hoveredIndex)} y1="0" y2={height} stroke="var(--border)" strokeWidth="1" strokeDasharray="3 4" vectorEffect="nonScalingStroke" />
                  <circle cx={x(hoveredIndex)} cy={y(portfolio.chart[hoveredIndex].totalValue!)} r="5" fill="var(--ledger-purple-500)" stroke="var(--card)" strokeWidth="3" vectorEffect="nonScalingStroke" />
                </>
              )}
            </svg>
            {hoveredIndex !== null && portfolio.chart[hoveredIndex] && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute z-20 w-36 rounded-xl border border-border/60 bg-card/95 p-2 text-center shadow-xl backdrop-blur-md"
                style={{ left: `clamp(0px, calc(${portfolio.chart.length <= 1 ? 50 : hoveredIndex / (portfolio.chart.length - 1) * 100}% - 72px), calc(100% - 144px))`, top: 4 }}
              >
                <b className="block text-xs text-muted-foreground">{portfolio.chart[hoveredIndex].date}</b>
                <span className="mt-0.5 block text-xs font-black text-violet-500">
                  {portfolio.chart[hoveredIndex].totalValue === undefined ? 'Incomplete' : money(portfolio.chart[hoveredIndex].totalValue!, portfolio.appCurrency)}
                </span>
                <span className="block text-xs text-muted-foreground">
                  Deposits {portfolio.chart[hoveredIndex].netDeposits === undefined ? 'incomplete' : money(portfolio.chart[hoveredIndex].netDeposits!, portfolio.appCurrency)}
                </span>
              </div>
            )}
          </ResponsiveChartFrame>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-4 text-xs font-semibold text-muted-foreground">
        <span><i className="mr-1 inline-block size-2 rounded-full bg-violet-500" /> Total value</span>
        <span><i className="mr-1 inline-block w-4 border-t-2 border-dashed border-amber-500 align-middle" /> Net deposits</span>
      </div>
      <div className="sr-only">
        <table>
          <caption>Portfolio value chart data</caption>
          <thead><tr><th>Date</th><th>Total value</th><th>Net deposits</th></tr></thead>
          <tbody>{portfolio.chart.map(point => <tr key={point.date}><td>{point.date}</td><td>{masked ? 'Hidden' : point.totalValue}</td><td>{masked ? 'Hidden' : point.netDeposits}</td></tr>)}</tbody>
        </table>
      </div>
    </section>
  )
}
