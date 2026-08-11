import { m, useReducedMotion } from 'framer-motion'
import { TrendingUp } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import type { DashboardData, TrendPoint } from '../../types'
import { formatCurrencyVal, SENSITIVE_AMOUNT_MASK } from '../../lib/utils'
import { useAppPrefs } from '../../contexts/AppContext'
import { Button } from '../ui/Button'

type TrendRange = '3month' | '6month' | 'yearly'

const chartPosition = (points: TrendPoint[], index: number) => {
  const min = Math.min(...points.map(point => point.balance), 0)
  const max = Math.max(...points.map(point => point.balance), 1000)
  const x = points.length === 1 ? 250 : 15 + (index / (points.length - 1)) * 470
  const y = 105 - ((points[index].balance - min) / (max - min || 1)) * 90
  return { x, y, left: (x / 500) * 100, top: (y / 120) * 75 + 25 }
}

const trendLabel = (point: TrendPoint) => {
  const year = point.cycleKey?.slice(0, 4) ?? ''
  return year ? `${point.month} ${year}` : point.month
}

export function TrendLineChart({ dashboardData, growthBalance }: { dashboardData: DashboardData | null; growthBalance: number }) {
  const reduceMotion = useReducedMotion()
  const { hideSensitive, currency, formatSensitive } = useAppPrefs()
  const [range, setRange] = useState<TrendRange>('yearly')
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const points = range === '3month'
    ? dashboardData?.last3TrendPoints || []
    : range === '6month'
      ? dashboardData?.last6TrendPoints || []
      : dashboardData?.trendPoints || []
  const polyline = useMemo(() => points.map((_, index) => {
      const position = chartPosition(points, index)
      return `${position.x},${position.y}`
    }).join(' '), [points])

  const rangeLabel = range === '3month' ? 'last 3 cycles' : range === '6month' ? 'last 6 cycles' : 'full year'
  const chartSummary = points.length > 0
    ? `Growth ledger balance over the ${rangeLabel}, from ${trendLabel(points[0])} at ${formatSensitive(points[0].balance)} to ${trendLabel(points[points.length - 1])} at ${formatSensitive(points[points.length - 1].balance)}.`
    : 'Growth balance trend. No data points available yet.'

  const selectNearest = (clientX: number) => {
    if (!svgRef.current || points.length === 0) return
    const rect = svgRef.current.getBoundingClientRect()
    const index = points.length === 1 ? 0 : Math.round(((clientX - rect.left) / rect.width) * (points.length - 1))
    setHoveredIndex(Math.max(0, Math.min(points.length - 1, index)))
  }

  return (
    <div className="app-panel p-6 rounded-2xl bg-card/92 border border-border/60 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">Growth ledger balance</h3>
            <p className="text-[10px] text-muted-foreground">Growth balance carried across budget cycles</p>
          </div>
          <TrendingUp className="size-4 text-blue-500" />
        </div>
        <div role="group" aria-label="Trend range" className="flex items-center bg-muted/40 rounded-lg p-0.5 border border-border/40 text-[9px] mb-3 w-fit">
          {(['3month', '6month', 'yearly'] as const).map(value => (
            <Button variant="unstyled" key={value} type="button" onClick={() => setRange(value)} aria-pressed={range === value} aria-label={value === '3month' ? 'Last 3 months' : value === '6month' ? 'Last 6 months' : 'Full year'} className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-2 py-0.5 font-bold transition cursor-pointer sm:min-h-8 sm:min-w-8 ${range === value ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}>
              {value === '3month' ? '3M' : value === '6month' ? '6M' : 'Year'}
            </Button>
          ))}
        </div>
        {hideSensitive && <p className="sr-only">Growth balance trend values are hidden.</p>}
        <div
          aria-hidden={hideSensitive || undefined}
          onMouseMove={event => selectNearest(event.clientX)}
          onMouseLeave={() => setHoveredIndex(null)}
          onTouchStart={event => selectNearest(event.touches[0].clientX)}
          onTouchMove={event => selectNearest(event.touches[0].clientX)}
          className={`h-40 flex flex-col justify-end w-full relative mt-2 cursor-pointer ${hideSensitive ? 'blur-xs pointer-events-none' : ''}`}
        >
          {polyline ? (
            <>
              <svg ref={svgRef} role="img" aria-label={chartSummary} className="w-full h-[120px] overflow-visible" viewBox="0 0 500 120" preserveAspectRatio="none">
                <defs><linearGradient id="growthGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-line)" stopOpacity="0.25" /><stop offset="100%" stopColor="var(--chart-line)" stopOpacity="0" /></linearGradient></defs>
                {/* d/points are set as static attributes and only opacity is
                    animated. Animating the path data numerically makes framer-motion
                    interpolate between path strings; when the point count changes
                    (range switch or re-render on navigation) the two paths have
                    different segment counts and it emits a malformed `d`
                    ("Expected number" SVG error). Fading in avoids that entirely. */}
                {/* Keyed by range so a timeframe switch remounts the fill/line and
                    replays the fade-in with the new shape, rather than snapping. */}
                {points.length > 1 && <m.path
                  key={`fill-${range}`}
                  d={`M 15,105 L ${polyline} L 485,105 Z`}
                  fill="url(#growthGradient)"
                  initial={reduceMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: reduceMotion ? 0 : 0.4, ease: 'easeInOut' }}
                />}
                {points.length > 1 && <m.polyline
                  key={`line-${range}`}
                  points={polyline}
                  fill="none"
                  stroke="var(--chart-line)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={reduceMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: reduceMotion ? 0 : 0.4, ease: 'easeInOut' }}
                />}
              </svg>
              {points.map((point, index) => {
                const position = chartPosition(points, index)
                return (
                  <m.span
                    // Keyed by range and positioned statically via `style`. Previously
                    // `layout` + a spring on left/top made the dots overshoot and bounce
                    // into place on every timeframe switch. Remounting per range and
                    // easing only scale/opacity gives a smooth staggered fade-in with no
                    // position morph, so the dots land cleanly with the redrawn line.
                    key={`${range}-${point.cycleKey || point.month}-${index}`}
                    initial={reduceMotion ? false : { scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: reduceMotion ? 0 : 0.3, ease: 'easeOut', delay: reduceMotion ? 0 : index * 0.03 }}
                    aria-hidden="true"
                    className="absolute size-1.5 rounded-full bg-blue-500/80 shadow-xs"
                    style={{ left: `calc(${position.left}% - 3px)`, top: `calc(${position.top}% - 3px)` }}
                  />
                )
              })}
              {hoveredIndex !== null && points[hoveredIndex] && (() => {
                const point = points[hoveredIndex]
                const position = chartPosition(points, hoveredIndex)
                return <div aria-hidden="true" className="absolute z-20 bg-card border rounded-xl p-1.5 shadow-xl text-center" style={{ left: `clamp(4px, calc(${position.left}% - 50px), calc(100% - 104px))`, top: `clamp(4px, calc(${position.top}% - 46px), calc(100% - 40px))`, width: 100 }}><b className="block text-[9px]">{trendLabel(point)}</b><span className="text-[10px] font-black text-blue-500">{hideSensitive ? SENSITIVE_AMOUNT_MASK : formatCurrencyVal(point.balance, currency)}</span></div>
              })()}
              {/* Screen-reader-only data table: the SVG scrubber is pointer-only, so expose the
                  underlying points as a real table for assistive tech and keyboard users. */}
              {!hideSensitive && <div className="sr-only">
                <table>
                  <caption>{chartSummary}</caption>
                  <thead>
                    <tr><th scope="col">Cycle</th><th scope="col">Growth balance</th></tr>
                  </thead>
                  <tbody>
                    {points.map((point, index) => (
                      <tr key={index}>
                        <th scope="row">{trendLabel(point)}</th>
                        <td>{formatSensitive(point.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>}
            </>
          ) : <div className="text-xs text-muted-foreground pb-12 text-center">Calculating trend points...</div>}
        </div>
        <div aria-hidden="true" className="flex px-[3%] mt-1">{points.map((point, index) => <span key={point.cycleKey || `${point.month}-${index}`} className="flex-1 min-w-0 text-center truncate text-[9px] text-muted-foreground font-bold">{trendLabel(point)}</span>)}</div>
      </div>
      <div className="border-t border-border/50 pt-3 mt-3 flex justify-between text-[10px] text-muted-foreground">
        <span>{range === '3month' ? 'Last 3 cycles' : range === '6month' ? 'Last 6 cycles' : `${dashboardData?.setting.selectedYear || new Date().getFullYear()} full year`}</span>
        <span>Growth Savings: {formatSensitive(growthBalance)}</span>
      </div>
    </div>
  )
}
