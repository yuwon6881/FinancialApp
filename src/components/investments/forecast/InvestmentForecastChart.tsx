import type { ForecastPoint } from '../../lib/investmentForecast'
import { seriesBounds, xAt, yAt } from '../../lib/chartSeries'
import { formatCurrencyVal } from '../../lib/utils'

export function InvestmentForecastChart({
  points,
  target,
  currency,
  masked,
}: {
  points: ForecastPoint[]
  target: number
  currency: string
  masked: boolean
}) {
  const width = 720
  const height = 240
  const bounds = seriesBounds(points.flatMap(point => [point.lower, point.median, point.upper, target]))
  const geometry = { width, height, min: bounds.min, max: bounds.max }
  const x = (index: number) => xAt(index, points.length, width)
  const y = (value: number) => yAt(value, geometry)
  const line = (key: 'lower' | 'median' | 'upper') => points
    .map((point, index) => `${x(index)},${y(point[key])}`)
    .join(' ')
  const band = [
    ...points.map((point, index) => `${x(index)},${y(point.upper)}`),
    ...points.map((_, index) => `${x(points.length - index - 1)},${y(points[points.length - index - 1].lower)}`),
  ].join(' ')
  const ending = points.at(-1)
  const summary = ending
    ? `After ${ending.year} years, the middle estimate is ${formatCurrencyVal(ending.median, currency)}. The broad range is ${formatCurrencyVal(ending.lower, currency)} to ${formatCurrencyVal(ending.upper, currency)}.`
    : 'Forecast data is not available.'

  return (
    <div className="mt-5 min-w-0">
      <p className="sr-only">{masked ? 'Forecast amounts are hidden.' : summary}</p>
      <div className={masked ? 'select-none blur-md' : undefined} aria-hidden={masked || undefined}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="h-48 w-full overflow-visible sm:h-60"
          role="img"
          aria-label={summary}
        >
          <polygon points={band} fill="var(--ledger-purple-500)" fillOpacity="0.12" />
          <polyline points={line('lower')} fill="none" stroke="var(--ledger-purple-500)" strokeOpacity="0.45" strokeWidth="1.5" strokeDasharray="5 5" vectorEffect="non-scaling-stroke" />
          <polyline points={line('upper')} fill="none" stroke="var(--ledger-purple-500)" strokeOpacity="0.45" strokeWidth="1.5" strokeDasharray="5 5" vectorEffect="non-scaling-stroke" />
          <polyline points={line('median')} fill="none" stroke="var(--ledger-purple-500)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <line x1="0" x2={width} y1={y(target)} y2={y(target)} stroke="var(--ledger-pending-500)" strokeWidth="2" strokeDasharray="8 6" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-[10px] font-semibold text-muted-foreground">
        <span><i className="mr-1 inline-block size-2 rounded-full bg-primary" /> Middle estimate</span>
        <span><i className="mr-1 inline-block w-4 border-t border-dashed border-primary align-middle opacity-60" /> Broad range</span>
        <span><i className="mr-1 inline-block w-4 border-t-2 border-dashed align-middle" style={{ borderColor: 'var(--ledger-pending-500)' }} /> Your target</span>
      </div>
      <div className="sr-only">
        <table>
          <caption>Investment forecast data</caption>
          <thead><tr><th>Year</th><th>Lower outcome</th><th>Middle estimate</th><th>Upper outcome</th></tr></thead>
          <tbody>{points.map(point => (
            <tr key={point.year}>
              <td>{point.year}</td>
              <td>{masked ? 'Hidden' : point.lower}</td>
              <td>{masked ? 'Hidden' : point.median}</td>
              <td>{masked ? 'Hidden' : point.upper}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  )
}
