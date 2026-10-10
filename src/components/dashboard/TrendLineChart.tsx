import { m, useReducedMotion } from 'framer-motion'
import { useMemo, useRef, useState } from 'react'
import type { DashboardData, TrendPoint } from '../../types'
import { cn, formatCurrencyVal, SENSITIVE_AMOUNT_MASK } from '../../lib/utils'
import { useAppPrefs } from '../../contexts/AppContext'
import { AmountText } from '../ui/AmountText'
import { SectionHeader } from '../ui/SectionHeader'
import { ReportSegmented } from '../reports/ReportSegmented'
import { ResponsiveChartFrame } from '../ui/ResponsiveChartFrame'
import { panelClass } from '../ui/panelStyles'

type TrendRange = '3month' | '6month' | 'yearly'

const RANGE_OPTIONS = [
  { value: '3month', label: '3M', ariaLabel: 'Last 3 months' },
  { value: '6month', label: '6M', ariaLabel: 'Last 6 months' },
  { value: 'yearly', label: 'Year', ariaLabel: 'Full year' },
] as const

const chartPosition = (points: TrendPoint[], index: number) => {
  const min = Math.min(...points.map(point => point.balance), 0)
  const max = Math.max(...points.map(point => point.balance), 1000)
  const x = points.length === 1 ? 250 : 15 + (index / (points.length - 1)) * 470
  const y = 105 - ((points[index].balance - min) / (max - min || 1)) * 90
  return { x, y, left: (x / 500) * 100, top: (y / 120) * 100 }
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
    <section id="report-section-growth" aria-labelledby="report-growth-heading" className="flex min-w-0 flex-col gap-3">
      <SectionHeader
        titleId="report-growth-heading"
        title="Growth ledger balance"
        description="How the Growth bucket has built up over time."
      />
      <div className={cn(panelClass, 'flex flex-1 flex-col p-4 sm:p-5')}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-label text-muted-foreground">Growth savings</p>
            <AmountText value={growthBalance} currency={currency} isMasked={hideSensitive} className="mt-0.5 text-title text-foreground" />
          </div>
          <ReportSegmented label="Trend range" value={range} onChange={setRange} options={RANGE_OPTIONS} />
        </div>
        {hideSensitive && <p className="sr-only">Growth balance trend values are hidden.</p>}
        <ResponsiveChartFrame
          density="compact"
          aria-hidden={hideSensitive || undefined}
          onMouseMove={event => selectNearest(event.clientX)}
          onMouseLeave={() => setHoveredIndex(null)}
          onTouchStart={event => selectNearest(event.touches[0].clientX)}
          onTouchMove={event => selectNearest(event.touches[0].clientX)}
          className={`mt-2 flex cursor-pointer flex-col justify-end ${hideSensitive ? 'blur-xs pointer-events-none' : ''}`}
        >
          {splinePath ? (
            <>
              <svg ref={svgRef} role="img" aria-label={chartSummary} className="h-full w-full overflow-visible" viewBox="0 0 500 120">
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
                  fill="var(--chart-line)"
                  fillOpacity={0.1}
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
                {positions.map((position, index) => {
                  const isHovered = hoveredIndex === index
                  const point = points[index]
                  return (
                    <m.circle
                      key={`${range}-${point?.cycleKey || point?.month || index}-${index}`}
                      cx={position.x}
                      cy={position.y}
                      r={isHovered ? 4.5 : 2.75}
                      className={isHovered ? 'fill-chart-line stroke-card stroke-2' : 'fill-chart-line'}
                      initial={reduceMotion ? false : { scale: 0, opacity: 0 }}
                      animate={{ scale: isHovered ? 1.3 : 1, opacity: 1 }}
                      transition={{ duration: reduceMotion ? 0 : 0.2, ease: 'easeOut', delay: reduceMotion ? 0 : index * 0.03 }}
                      aria-hidden="true"
                    />
                  )
                })}
              </svg>
              {hoveredIndex !== null && points[hoveredIndex] && (() => {
                const point = points[hoveredIndex]
                const position = positions[hoveredIndex]
                return (
                  <div
                    aria-hidden="true"
                    className="absolute z-20 rounded-overlay border border-border/80 bg-card p-2 text-center shadow-(--app-shadow-overlay)"
                    style={{ left: `clamp(4px, calc(${position.left}% - 55px), calc(100% - 114px))`, top: `clamp(4px, calc(${position.top}% - 50px), calc(100% - 46px))`, width: 110 }}
                  >
                    <b className="block text-caption font-medium text-muted-foreground">{trendLabel(point)}</b>
                    <span className="text-caption font-semibold tabular-nums text-foreground">
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
          ) : <div className="pb-12 text-center text-caption text-muted-foreground">Calculating trend points...</div>}
        </ResponsiveChartFrame>
        <div aria-hidden="true" className="mt-1.5 flex px-[3%]">{points.map((point, index) => <span key={point.cycleKey || `${point.month}-${index}`} className="min-w-0 flex-1 truncate text-center text-caption text-muted-foreground">{axisLabel(point, points.length)}</span>)}</div>
        <p className="mt-auto pt-3 text-caption text-muted-foreground">{range === '3month' ? 'Last 3 cycles' : range === '6month' ? 'Last 6 cycles' : `${dashboardData?.setting.selectedYear || new Date().getFullYear()} full year`}</p>
      </div>
    </section>
  )
}
