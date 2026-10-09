import { useId } from 'react'
import { cn } from '../../lib/utils'

interface SparklineProps {
  values: number[]
  width?: number
  height?: number
  /** Stroke colour as a CSS colour or variable. Defaults to the chart line colour. */
  color?: string
  /** Fills the area under the line with a fading tint of the stroke. */
  area?: boolean
  className?: string
}

/**
 * A word-sized trend line. Decorative by design (`aria-hidden`): the figure it sits beside carries
 * the meaning, so a sparkline must never be the only place a number is stated.
 */
export function Sparkline({
  values,
  width = 96,
  height = 28,
  color = 'var(--chart-line)',
  area = true,
  className,
}: SparklineProps) {
  const gradientId = useId()
  const finite = values.filter(Number.isFinite)
  if (finite.length < 2) return null
  const min = Math.min(...finite)
  const max = Math.max(...finite)
  const span = max - min || 1
  const pad = 2
  const step = (width - pad * 2) / (finite.length - 1)
  const points = finite.map((value, index) => {
    const x = pad + index * step
    const y = pad + (height - pad * 2) * (1 - (value - min) / span)
    return [x, y] as const
  })
  const line = points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
  const fill = `${line} L${points[points.length - 1][0].toFixed(2)},${height} L${points[0][0].toFixed(2)},${height} Z`
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      className={cn('shrink-0 overflow-visible', className)}
    >
      {area && (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={fill} fill={`url(#${gradientId})`} />
        </>
      )}
      <path d={line} fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r={2.5} fill={color} />
    </svg>
  )
}
