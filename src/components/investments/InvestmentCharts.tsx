import { useMemo, useRef, useState } from 'react'
import { m, useReducedMotion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import type { InvestmentPortfolio, InvestmentRange } from '../../types'
import { buildSleeveIndex, sleeveOf } from '../../lib/investmentAllocation'
import { formatCurrencyVal } from '../../lib/utils'
import { Button } from '../ui/Button'
import { CustomSelect } from '../ui/CustomSelect'
import { InteractiveDoughnutChart } from '../ui/InteractiveDoughnutChart'

export type AllocationMode = 'sleeve' | 'asset' | 'account' | 'instrument'
export type AllocationFilter = { mode: AllocationMode; key: string } | null

const ranges: Array<{ value: InvestmentRange; label: string }> = [
  { value: '1m', label: '1M' },
  { value: '3m', label: '3M' },
  { value: '6m', label: '6M' },
  { value: '1y', label: '1Y' },
  { value: 'all', label: 'All' },
]

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
  const values = portfolio.chart.flatMap(point => [point.totalValue, point.netDeposits]).filter((value): value is number => value !== undefined)
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const width = 720
  const height = 240
  const x = (index: number) => portfolio.chart.length <= 1 ? width / 2 : index / (portfolio.chart.length - 1) * width
  const y = (value: number) => height - ((value - min) / (max - min || 1)) * (height - 20) - 10
  const line = (key: 'totalValue' | 'netDeposits') =>
    portfolio.chart
      .map((point, index) => point[key] === undefined ? null : `${x(index)},${y(point[key]!)}`)
      .filter(Boolean)
      .join(' ')
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
    <section aria-labelledby="value-chart-title" className="app-panel min-w-0 rounded-2xl border border-border/60 bg-card/92 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="value-chart-title" className="text-base font-bold text-foreground">Portfolio value</h2>
          <p className="mt-1 text-xs text-muted-foreground">Your investments plus cash, over time.</p>
        </div>
        <div className="flex max-w-full flex-wrap gap-1 self-start rounded-xl bg-muted/40 p-1" role="group" aria-label="Chart range">
          {ranges.map(item => (
            <Button
              key={item.value}
              type="button"
              variant="unstyled"
              onClick={() => onRangeChange(item.value)}
              className={`cursor-pointer whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${range === item.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
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
          <div
            className={`relative cursor-crosshair ${masked || isFetching ? 'select-none blur-md pointer-events-none transition-[filter,opacity] duration-200' : 'transition-[filter,opacity] duration-200'}`}
            aria-hidden={masked}
            onMouseMove={event => selectNearest(event.clientX)}
            onMouseLeave={() => setHoveredIndex(null)}
            onTouchStart={event => selectNearest(event.touches[0].clientX)}
            onTouchMove={event => selectNearest(event.touches[0].clientX)}
          >
            <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-48 w-full overflow-visible sm:h-60" role="img" aria-label={summary}>
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
                <b className="block text-[10px] text-muted-foreground">{portfolio.chart[hoveredIndex].date}</b>
                <span className="mt-0.5 block text-xs font-black text-violet-500">
                  {portfolio.chart[hoveredIndex].totalValue === undefined ? 'Incomplete' : money(portfolio.chart[hoveredIndex].totalValue!, portfolio.appCurrency)}
                </span>
                <span className="block text-[9px] text-muted-foreground">
                  Deposits {portfolio.chart[hoveredIndex].netDeposits === undefined ? 'incomplete' : money(portfolio.chart[hoveredIndex].netDeposits!, portfolio.appCurrency)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-4 text-[10px] font-semibold text-muted-foreground">
        <span><i className="mr-1 inline-block size-2 rounded-full bg-violet-500" /> Total value</span>
        <span><i className="mr-1 inline-block w-4 border-t-2 border-dashed border-amber-500 align-middle" /> Net deposits</span>
      </div>
      <table className="sr-only">
        <caption>Portfolio value chart data</caption>
        <thead><tr><th>Date</th><th>Total value</th><th>Net deposits</th></tr></thead>
        <tbody>{portfolio.chart.map(point => <tr key={point.date}><td>{point.date}</td><td>{masked ? 'Hidden' : point.totalValue}</td><td>{masked ? 'Hidden' : point.netDeposits}</td></tr>)}</tbody>
      </table>
    </section>
  )
}

export function AllocationChart({ portfolio, masked, selected, onSelect }: {
  portfolio: InvestmentPortfolio
  masked: boolean
  selected: AllocationFilter
  onSelect: (value: AllocationFilter) => void
}) {
  const [mode, setMode] = useState<AllocationMode>('sleeve')
  const sleeveIndex = useMemo(() => buildSleeveIndex(portfolio.instruments), [portfolio.instruments])
  // Each group carries the string a person reads (`label`) and the one the holdings
  // filter matches on (`filterKey`) — for funds those differ, so keep them apart
  // rather than parsing the label back apart later.
  const groups = useMemo(() => {
    const map = new Map<string, { label: string; filterKey: string; value: number }>()
    const add = (label: string, filterKey: string, value: number) => {
      const existing = map.get(label)
      map.set(label, { label, filterKey, value: (existing?.value ?? 0) + value })
    }
    portfolio.holdings.forEach(holding => {
      const sleeve = sleeveOf(holding, sleeveIndex)
      const [label, filterKey] = mode === 'sleeve'
        ? [sleeve.label, sleeve.key]
        : mode === 'asset' ? [holding.type, holding.type]
          : mode === 'account' ? [holding.accountName, holding.accountName]
            : [`${holding.symbol} · ${holding.name}`, holding.symbol]
      add(label, filterKey, holding.valueApp ?? 0)
    })
    portfolio.cashBalances.forEach(balance => {
      if (balance.amountApp === undefined || balance.amountApp <= 0) return
      const label = mode === 'account' ? balance.accountName : 'Cash'
      add(label, label, balance.amountApp)
    })
    return [...map.values()].sort((a, b) => b.value - a.value)
  }, [portfolio.holdings, portfolio.cashBalances, mode, sleeveIndex])
  const total = groups.reduce((sum, group) => sum + group.value, 0)
  const colors = [
    'var(--ledger-purple-500)',
    'var(--ledger-sky-500)',
    'var(--ledger-pending-500)',
    'var(--ledger-expense-500)',
    'var(--ledger-income-500)',
    'var(--ledger-blue-500)',
    'var(--ledger-wishlist-500)',
    'var(--ledger-neutral-500)',
  ]
  const slices = groups.map((group, index) => ({
    key: group.label,
    label: group.label,
    value: group.value,
    color: colors[index % colors.length],
  }))
  const allocationModeOptions: Array<{ value: AllocationMode; label: string }> = [
    { value: 'sleeve', label: 'Basket in your plan' },
    { value: 'instrument', label: 'Individual fund' },
    { value: 'asset', label: 'Kind of investment' },
    { value: 'account', label: 'Account' },
  ]
  const selectedLabel = selected?.mode === mode
    ? groups.find(group => group.filterKey === selected.key)?.label
    : undefined
  const selectSlice = (label: string) => {
    if (label === 'Cash' && mode !== 'account') {
      onSelect(null)
      return
    }
    const filterKey = groups.find(group => group.label === label)?.filterKey ?? label
    onSelect(selected?.mode === mode && selected.key === filterKey ? null : { mode, key: filterKey })
  }

  return (
    <section aria-labelledby="allocation-title" className="app-panel min-w-0 flex flex-col rounded-2xl border border-border/60 bg-card/92 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0"><h2 id="allocation-title" className="text-base font-bold text-foreground">Where your money sits</h2><p className="mt-1 text-xs text-muted-foreground">Everything you hold, including cash. Pick a slice to see just those investments below.</p></div>
        <div className="w-full shrink-0 sm:w-auto">
          <CustomSelect
            value={mode}
            onChange={value => { setMode(value as AllocationMode); onSelect(null) }}
            options={allocationModeOptions}
            ariaLabel="Group by"
            className="w-full sm:w-auto"
            align="right"
          />
        </div>
      </div>
      <div className="mt-5 flex w-full min-w-0 flex-1 flex-col items-center justify-center gap-6 overflow-hidden sm:flex-row lg:flex-col lg:justify-start">
        {groups.length > 0 ? (
          <InteractiveDoughnutChart
            key={mode}
            slices={slices}
            ariaLabel={groups.map(group => `${group.label} ${total ? (group.value / total * 100).toFixed(1) : 0}%`).join(', ')}
            centerLabel="Total"
            centerValue={money(total, portfolio.appCurrency)}
            formatValue={value => money(value, portfolio.appCurrency)}
            masked={masked}
            selectedKey={selectedLabel}
            onActivate={slice => selectSlice(slice.label)}
            chartClassName="mx-auto aspect-square w-full max-w-52 sm:mx-0 sm:w-48 lg:mx-auto lg:w-56 lg:max-w-56"
            legendClassName="w-full min-w-0 flex-1 overflow-hidden space-y-1 lg:flex-none"
          />
        ) : <p className="text-xs text-muted-foreground">Add prices to see what you hold.</p>}
      </div>
      {selectedLabel && <p className="mt-3 text-[10px] text-muted-foreground">Showing only {selectedLabel} below. Pick the slice again to show everything.</p>}
    </section>
  )
}

export function PerformanceBars({ portfolio, masked }: { portfolio: InvestmentPortfolio; masked: boolean }) {
  const reduceMotion = useReducedMotion()
  const holdings = [...portfolio.holdings].filter(value => value.unrealisedPercent !== undefined).sort((a, b) => (b.unrealisedPercent ?? 0) - (a.unrealisedPercent ?? 0))
  const scale = Math.max(...holdings.map(value => Math.abs(value.unrealisedPercent ?? 0)), 1)

  return (
    <section aria-labelledby="performance-title" className="app-panel rounded-2xl border border-border/60 bg-card/92 p-5">
      <h2 id="performance-title" className="text-base font-bold text-foreground">Holding performance</h2>
      <p className="mt-1 text-xs text-muted-foreground">Unrealised percentage gain or loss, ranked.</p>
      <div className="mt-4 space-y-3">
        {holdings.map(holding => {
          const positive = (holding.unrealisedPercent ?? 0) >= 0
          const ratio = Math.abs(holding.unrealisedPercent ?? 0) / scale
          return (
            <div key={`${holding.accountId}-${holding.instrumentId}`} className="grid grid-cols-[64px_minmax(0,1fr)_52px] items-center gap-3 text-xs">
              <span className="truncate font-bold text-foreground">{holding.symbol}</span>
              <div className="relative h-3 rounded-full bg-muted">
                <div className="absolute left-1/2 top-0 h-full w-px bg-border" />
                <m.div
                  className={`absolute top-0 h-full w-1/2 rounded-full ${positive ? 'origin-left bg-emerald-500' : 'right-1/2 origin-right bg-orange-500'}`}
                  initial={reduceMotion ? false : { scaleX: 0 }}
                  animate={{ scaleX: ratio }}
                  transition={{ duration: 0.55, ease: 'easeOut' }}
                  style={positive ? { left: '50%' } : undefined}
                />
              </div>
              <span className="text-right font-bold">{masked ? '••' : `${(holding.unrealisedPercent ?? 0).toFixed(1)}%`}</span>
            </div>
          )
        })}
        {holdings.length === 0 && <p className="text-xs text-muted-foreground">Prices and cost basis are needed for performance.</p>}
      </div>
    </section>
  )
}
