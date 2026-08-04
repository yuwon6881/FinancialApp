import { useRef, useState } from 'react'
import type { ForecastPoint } from '../../../lib/investmentForecast'
import { bandPolygon, seriesBounds, xAt, yAt } from '../../../lib/chartSeries'
import { formatCurrencyVal } from '../../../lib/utils'

export function InvestmentForecastChart({
  points,
  target,
  currency,
  masked,
}: {
  points: ForecastPoint[]
  /** `null` until the user asks for a target, so an unchosen line is never drawn — and,
   * because the target shares this y-scale, never squashes the real forecast either. */
  target: number | null
  currency: string
  masked: boolean
}) {
  const width = 720
  const height = 240
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const bounds = seriesBounds(
    points.flatMap(point => [point.lower, point.median, point.upper]).concat(target ?? []),
  )
  const geometry = { width, height, min: bounds.min, max: bounds.max }
  const x = (index: number) => xAt(index, points.length, width)
  const y = (value: number) => yAt(value, geometry)
  const line = (key: 'lower' | 'median' | 'upper') => points
    .map((point, index) => `${x(index)},${y(point[key])}`)
    .join(' ')
  const band = bandPolygon(points.map(point => point.upper), points.map(point => point.lower), geometry)
  const ending = points.at(-1)
  const money = (value: number) => formatCurrencyVal(value, currency)
  const summary = ending
    ? `After ${ending.year} years, the middle estimate is ${money(ending.median)}. The range of possible outcomes is ${money(ending.lower)} to ${money(ending.upper)}.`
    : 'Forecast data is not available.'
  const selectNearest = (clientX: number) => {
    if (!svgRef.current || points.length === 0 || masked) return
    const rect = svgRef.current.getBoundingClientRect()
    const index = Math.round(((clientX - rect.left) / rect.width) * (points.length - 1))
    setHoveredIndex(Math.max(0, Math.min(points.length - 1, index)))
  }
  const hovered = hoveredIndex === null ? null : points[hoveredIndex] ?? null
  const hoveredX = hoveredIndex ?? 0

  return (
    <div className="mt-5 min-w-0">
      <p className="sr-only">{masked ? 'Forecast amounts are hidden.' : summary}</p>
      <div
        className={`relative cursor-crosshair ${masked ? 'select-none blur-md pointer-events-none' : ''}`}
        aria-hidden={masked || undefined}
        onMouseMove={event => selectNearest(event.clientX)}
        onMouseLeave={() => setHoveredIndex(null)}
        onTouchStart={event => selectNearest(event.touches[0].clientX)}
        onTouchMove={event => selectNearest(event.touches[0].clientX)}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="h-48 w-full overflow-visible sm:h-60"
          role="img"
          aria-label={summary}
        >
          {/* Gridlines at the top and middle of the scale, so a height can be read rather than guessed. */}
          <line x1="0" x2={width} y1={y(bounds.max)} y2={y(bounds.max)} stroke="var(--border)" strokeWidth="1" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />
          <line x1="0" x2={width} y1={y((bounds.max + bounds.min) / 2)} y2={y((bounds.max + bounds.min) / 2)} stroke="var(--border)" strokeWidth="1" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />
          <polygon points={band} fill="var(--ledger-purple-500)" fillOpacity="0.12" />
          <polyline points={line('lower')} fill="none" stroke="var(--ledger-purple-500)" strokeOpacity="0.45" strokeWidth="1.5" strokeDasharray="5 5" vectorEffect="non-scaling-stroke" />
          <polyline points={line('upper')} fill="none" stroke="var(--ledger-purple-500)" strokeOpacity="0.45" strokeWidth="1.5" strokeDasharray="5 5" vectorEffect="non-scaling-stroke" />
          <polyline points={line('median')} fill="none" stroke="var(--ledger-purple-500)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          {target !== null && (
            <line x1="0" x2={width} y1={y(target)} y2={y(target)} stroke="var(--ledger-pending-500)" strokeWidth="2" strokeDasharray="8 6" vectorEffect="non-scaling-stroke" />
          )}
          {hovered && (
            <>
              <line x1={x(hoveredX)} x2={x(hoveredX)} y1="0" y2={height} stroke="var(--border)" strokeWidth="1" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
              <circle cx={x(hoveredX)} cy={y(hovered.median)} r="5" fill="var(--ledger-purple-500)" stroke="var(--card)" strokeWidth="3" vectorEffect="non-scaling-stroke" />
            </>
          )}
        </svg>
        <span className="pointer-events-none absolute left-0 top-0 rounded bg-card/70 px-1 text-[10px] font-semibold text-muted-foreground">{masked ? '••••' : money(bounds.max)}</span>
        <span className="pointer-events-none absolute bottom-0 left-0 rounded bg-card/70 px-1 text-[10px] font-semibold text-muted-foreground">{masked ? '••••' : money(bounds.min)}</span>
        {hovered && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute z-20 w-40 rounded-xl border border-border/60 bg-card/95 p-2 text-center shadow-xl backdrop-blur-md"
            style={{ left: `clamp(0px, calc(${points.length <= 1 ? 50 : hoveredX / (points.length - 1) * 100}% - 80px), calc(100% - 160px))`, top: 4 }}
          >
            <b className="block text-[10px] text-muted-foreground">{hovered.year === 0 ? 'Today' : `In ${hovered.year} years`}</b>
            <span className="mt-0.5 block text-xs font-black text-violet-500">{money(hovered.median)}</span>
            <span className="block text-[9px] text-muted-foreground">Could be {money(hovered.lower)} to {money(hovered.upper)}</span>
          </div>
        )}
      </div>
      <div className="mt-1 flex justify-between text-[10px] font-semibold text-muted-foreground">
        <span>Today</span>
        <span>{Math.round((ending?.year ?? 0) / 2)} years</span>
        <span>In {ending?.year ?? 0} years</span>
      </div>
      {/* Swatches carry the same tokens as the marks above: a legend in a different
          hue from its own line is worse than no legend at all. */}
      <div className="mt-3 flex flex-wrap gap-4 text-[10px] font-semibold text-muted-foreground">
        <span><i className="mr-1 inline-block size-2 rounded-full align-middle" style={{ backgroundColor: 'var(--ledger-purple-500)' }} /> Middle estimate</span>
        <span><i className="mr-1 inline-block w-4 border-t border-dashed align-middle opacity-60" style={{ borderColor: 'var(--ledger-purple-500)' }} /> Range of possible outcomes</span>
        {target !== null && (
          <span><i className="mr-1 inline-block w-4 border-t-2 border-dashed align-middle" style={{ borderColor: 'var(--ledger-pending-500)' }} /> Your target</span>
        )}
      </div>
      <div className="sr-only">
        <table>
          <caption>Investment forecast data</caption>
          <thead><tr><th>Year</th><th>Lower outcome</th><th>Middle estimate</th><th>Upper outcome</th></tr></thead>
          <tbody>{points.map(point => (
            <tr key={point.year}>
              <td>{point.year}</td>
              <td>{masked ? 'Hidden' : money(point.lower)}</td>
              <td>{masked ? 'Hidden' : money(point.median)}</td>
              <td>{masked ? 'Hidden' : money(point.upper)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  )
}
