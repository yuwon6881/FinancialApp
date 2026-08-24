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

// The x-axis rail divides its width evenly between the points, so a twelve-cycle year leaves each
// label about 21px at 320px -- "Jan 2026" clipped to "Ja". Those points all sit inside the one year
// the footer already names, so the axis drops the year and the month alone fits. Short ranges keep
// it: they can straddle a year boundary and have the room.
const axisLabel = (point: TrendPoint, pointCount: number) =>
  pointCount > 6 ? point.month : trendLabel(point)

const buildSmoothSpline = (positions: Array<{ x: number; y: number }>) => {
  if (positions.length === 0) return ''
  if (positions.length === 1) return `M ${positions[0].x},${positions[0].y}`
  if (positions.length === 2) return `M ${positions[0].x},${positions[0].y} L ${positions[1].x},${positions[1].y}`

  let d = `M ${positions[0].x.toFixed(1)},${positions[0].y.toFixed(1)}`
  for (let i = 0; i < positions.length - 1; i++) {
    const p0 = positions[i === 0 ? 0 : i - 1]
    const p1 = positions[i]
    const p2 = positions[i + 1]
    const p3 = positions[i + 2 < positions.length ? i + 2 : i + 1]

    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6

    d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`
  }
  return d
}

export function TrendLineChart({ dashboardData, growthBalance }: { dashboardData: DashboardData | null; growthBalance: number }) {
  const reduceMotion = useReducedMotion()
  const prefs = useAppPrefs()
  const { currency, formatSensitive } = prefs
  const hideSensitive = prefs.maskPassiveFinancialFigures ?? prefs.hideSensitive
  const [range, setRange] = useState<TrendRange>('yearly')
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const points = range === '3month'
    ? dashboardData?.last3TrendPoints || []
    : range === '6month'
      ? dashboardData?.last6TrendPoints || []
      : dashboardData?.trendPoints || []

  const positions = useMemo(() => points.map((_, index) => chartPosition(points, index)), [points])
  const splinePath = useMemo(() => buildSmoothSpline(positions), [positions])
  const fillPath = useMemo(() => {
    if (positions.length <= 1) return ''
    return `${splinePath} L ${positions[positions.length - 1].x.toFixed(1)},105 L ${positions[0].x.toFixed(1)},105 Z`
  }, [splinePath, positions])

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
            <h3 className="text-base font-bold text-foreground">Growth ledger balance</h3>
            <p className="text-xs text-muted-foreground">Growth balance carried across budget cycles</p>
          </div>
          <div className="flex size-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
            <TrendingUp className="size-4" />
          </div>
        </div>
        <div role="group" aria-label="Trend range" className="flex items-center bg-muted/40 rounded-lg p-0.5 border border-border/40 text-xs mb-3 w-fit">
          {(['3month', '6month', 'yearly'] as const).map(value => (
            <Button variant="unstyled" key={value} type="button" onClick={() => setRange(value)} aria-pressed={range === value} aria-label={value === '3month' ? 'Last 3 months' : value === '6month' ? 'Last 6 months' : 'Full year'} className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-2.5 py-1 text-xs font-bold transition cursor-pointer sm:min-h-8 sm:min-w-8 ${range === value ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}>
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
          {splinePath ? (
            <>
              <svg ref={svgRef} role="img" aria-label={chartSummary} className="w-full h-[120px] overflow-visible" viewBox="0 0 500 120" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="growthGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-line)" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="var(--chart-line)" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                {hoveredIndex !== null && positions[hoveredIndex] && (
                  <line
                    x1={positions[hoveredIndex].x}
                    x2={positions[hoveredIndex].x}
                    y1={15}
                    y2={105}
                    stroke="var(--chart-line)"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                    strokeOpacity="0.5"
                    aria-hidden="true"
                  />
                )}
                {points.length > 1 && fillPath && <m.path
                  key={`fill-${range}`}
                  d={fillPath}
                  fill="url(#growthGradient)"
                  initial={reduceMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: reduceMotion ? 0 : 0.4, ease: 'easeInOut' }}
                />}
                {points.length > 1 && <m.path
                  key={`line-${range}`}
                  d={splinePath}
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
              {positions.map((position, index) => {
                const isHovered = hoveredIndex === index
                const point = points[index]
                return (
                  <m.span
                    key={`${range}-${point?.cycleKey || point?.month || index}-${index}`}
                    initial={reduceMotion ? false : { scale: 0, opacity: 0 }}
                    animate={{ scale: isHovered ? 1.5 : 1, opacity: 1 }}
                    transition={{ duration: reduceMotion ? 0 : 0.2, ease: 'easeOut', delay: reduceMotion ? 0 : index * 0.03 }}
                    aria-hidden="true"
                    className={`absolute rounded-full shadow-xs transition-colors duration-150 ${isHovered ? 'size-2 bg-blue-500 ring-2 ring-background' : 'size-1.5 bg-blue-500/80'}`}
                    style={{ left: `calc(${position.left}% - ${isHovered ? 4 : 3}px)`, top: `calc(${position.top}% - ${isHovered ? 4 : 3}px)` }}
                  />
                )
              })}
              {hoveredIndex !== null && points[hoveredIndex] && (() => {
                const point = points[hoveredIndex]
                const position = positions[hoveredIndex]
                return (
                  <div
                    aria-hidden="true"
                    className="absolute z-20 bg-card/95 backdrop-blur-md border border-border/80 rounded-xl p-2 shadow-xl text-center"
                    style={{ left: `clamp(4px, calc(${position.left}% - 55px), calc(100% - 114px))`, top: `clamp(4px, calc(${position.top}% - 50px), calc(100% - 46px))`, width: 110 }}
                  >
                    <b className="block text-[11px] font-semibold text-muted-foreground">{trendLabel(point)}</b>
                    <span className="text-xs font-black tabular-nums text-blue-500">
                      {hideSensitive ? SENSITIVE_AMOUNT_MASK : formatCurrencyVal(point.balance, currency)}
                    </span>
                  </div>
                )
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
        <div aria-hidden="true" className="flex px-[3%] mt-1.5">{points.map((point, index) => <span key={point.cycleKey || `${point.month}-${index}`} className="flex-1 min-w-0 text-center truncate text-[11px] text-muted-foreground font-medium">{axisLabel(point, points.length)}</span>)}</div>
      </div>
      <div className="border-t border-border/50 pt-3 mt-3 flex justify-between text-xs text-muted-foreground">
        <span>{range === '3month' ? 'Last 3 cycles' : range === '6month' ? 'Last 6 cycles' : `${dashboardData?.setting.selectedYear || new Date().getFullYear()} full year`}</span>
        <span className="font-medium">Growth Savings: <strong className="font-bold text-foreground tabular-nums">{formatSensitive(growthBalance)}</strong></span>
      </div>
    </div>
  )
}
