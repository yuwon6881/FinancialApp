import { useCallback, useMemo, useRef, useState } from 'react'
import { m, useReducedMotion } from 'framer-motion'
import { motionSafeScrollBehavior } from '../../lib/motionPreference'
import { revealWithinScrollParent } from '../../lib/scrollContainment'

export interface DoughnutSlice {
  key: string
  label: string
  value: number
  color: string
}

interface InteractiveDoughnutChartProps {
  slices: DoughnutSlice[]
  ariaLabel: string
  centerLabel: string
  centerValue: React.ReactNode
  formatValue: (value: number) => React.ReactNode
  masked?: boolean
  selectedKey?: string
  onActivate?: (slice: DoughnutSlice) => void
  chartClassName?: string
  legendClassName?: string
}

export function InteractiveDoughnutChart({
  slices,
  ariaLabel,
  centerLabel,
  centerValue,
  formatValue,
  masked = false,
  selectedKey,
  onActivate,
  chartClassName = 'size-48',
  legendClassName = '',
}: InteractiveDoughnutChartProps) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)
  const reduceMotion = useReducedMotion()
  const total = useMemo(() => slices.reduce((sum, slice) => sum + slice.value, 0), [slices])
  const chartSlices = useMemo(() => {
    const result = slices.reduce<{
      angle: number
      items: Array<DoughnutSlice & { percentage: number; startAngle: number; endAngle: number }>
    }>((accumulator, slice) => {
      const percentage = total > 0 ? slice.value / total : 0
      const endAngle = accumulator.angle + percentage * 360
      return {
        angle: endAngle,
        items: [...accumulator.items, {
          ...slice,
          percentage,
          startAngle: accumulator.angle,
          endAngle: Math.min(accumulator.angle + 359.99, endAngle),
        }],
      }
    }, { angle: 0, items: [] })
    return result.items
  }, [slices, total])
  const activeKey = hoveredKey ?? selectedKey ?? null
  const active = chartSlices.find(slice => slice.key === activeKey)

  const legendRefs = useRef(new Map<string, HTMLButtonElement | null>())

  /**
   * Hovering an arc highlights its legend row, which is invisible feedback when the legend is a
   * scrolling list and the row sits below the fold. Bring the row to the user rather than leaving
   * the highlight to happen off-screen.
   *
   * Only arc interaction triggers this. Hovering the legend itself already puts the pointer on the
   * row, and scrolling underneath a moving pointer would swap which row is hovered.
   */
  const hoverArc = useCallback((key: string) => {
    setHoveredKey(key)
    const target = legendRefs.current.get(key)
    if (target) revealWithinScrollParent(target, motionSafeScrollBehavior())
  }, [])

  const activateArc = (slice: DoughnutSlice) => {
    // Mouse users have already hovered the slice, while the first tap on a touch
    // screen reveals its details. A second tap performs the associated action.
    if (hoveredKey === slice.key || selectedKey === slice.key) onActivate?.(slice)
    else hoverArc(slice.key)
  }

  return (
    <>
      <div aria-hidden={masked || undefined} className={`relative shrink-0 ${chartClassName} ${masked ? 'pointer-events-none select-none blur-md' : ''}`}>
        <svg role="img" aria-label={masked ? `${centerLabel} values hidden` : ariaLabel} className="size-full overflow-visible" viewBox="0 0 200 200">
          {chartSlices.map((slice, index) => {
            const highlighted = activeKey === slice.key
            return (
              <m.path
                key={slice.key}
                d={getDoughnutPath(
                  100,
                  100,
                  highlighted ? 96 : 90,
                  highlighted ? 56 : 62,
                  slice.startAngle,
                  slice.endAngle,
                )}
                fill={slice.color}
                className="cursor-pointer stroke-card stroke-2 transition-all duration-200 hover:opacity-90 focus:outline-none"
                initial={reduceMotion ? false : { scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.4, ease: 'easeOut', delay: reduceMotion ? 0 : index * 0.04 }}
                style={{ transformOrigin: '100px 100px' }}
                tabIndex={masked ? -1 : 0}
                onMouseEnter={() => { if (!masked) hoverArc(slice.key) }}
                onMouseLeave={() => setHoveredKey(null)}
                onFocus={() => { if (!masked) hoverArc(slice.key) }}
                onBlur={() => setHoveredKey(null)}
                onClick={() => { if (!masked) activateArc(slice) }}
                onKeyDown={event => {
                  if (masked) return
                  if (event.key !== 'Enter' && event.key !== ' ') return
                  event.preventDefault()
                  onActivate?.(slice)
                }}
              />
            )
          })}
        </svg>
        {/* The hole is 62% of the box (rInner 62 / viewBox 100); cap the labels a
            little under that so long amounts never touch the ring. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex select-none flex-col items-center justify-center px-[19%] text-center">
          <span className="max-w-full truncate text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {active?.label ?? centerLabel}
          </span>
          <span className="max-w-full truncate text-lg font-black tracking-tight tabular-nums text-foreground">
            {masked ? '••••' : active ? `${(active.percentage * 100).toFixed(1)}%` : centerValue}
          </span>
        </div>
      </div>

      <div className={legendClassName}>
        {chartSlices.map(slice => (
          <m.button
            key={slice.key}
            ref={node => {
              if (node) legendRefs.current.set(slice.key, node)
              else legendRefs.current.delete(slice.key)
            }}
            layout
            type="button"
            aria-label={`${slice.label}: ${masked ? 'hidden' : `${formatValue(slice.value)}, ${(slice.percentage * 100).toFixed(1)}%`}`}
            aria-pressed={selectedKey === slice.key}
            className={`flex w-full min-w-0 cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring ${
              activeKey === slice.key ? 'bg-muted/60 ring-1 ring-border/50' : 'hover:bg-muted/30'
            }`}
            onMouseEnter={() => setHoveredKey(slice.key)}
            onMouseLeave={() => setHoveredKey(null)}
            onFocus={() => setHoveredKey(slice.key)}
            onBlur={() => setHoveredKey(null)}
            onClick={() => onActivate?.(slice)}
          >
            <span className="mr-2 flex min-w-0 flex-1 items-center gap-2">
              <span aria-hidden="true" className="size-2 shrink-0 rounded-full ring-1 ring-background" style={{ backgroundColor: slice.color }} />
              <span className="truncate font-bold text-foreground">{slice.label}</span>
            </span>
            <span className="shrink-0 font-bold tabular-nums text-foreground/90">
              {masked ? '••••' : <>{formatValue(slice.value)} ({(slice.percentage * 100).toFixed(1)}%)</>}
            </span>
          </m.button>
        ))}
      </div>
    </>
  )
}

function getDoughnutPath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startAngleDeg: number,
  endAngleDeg: number,
): string {
  const startAngleRad = ((startAngleDeg - 90) * Math.PI) / 180
  const endAngleRad = ((endAngleDeg - 90) * Math.PI) / 180
  const x1Outer = cx + rOuter * Math.cos(startAngleRad)
  const y1Outer = cy + rOuter * Math.sin(startAngleRad)
  const x2Outer = cx + rOuter * Math.cos(endAngleRad)
  const y2Outer = cy + rOuter * Math.sin(endAngleRad)
  const x1Inner = cx + rInner * Math.cos(startAngleRad)
  const y1Inner = cy + rInner * Math.sin(startAngleRad)
  const x2Inner = cx + rInner * Math.cos(endAngleRad)
  const y2Inner = cy + rInner * Math.sin(endAngleRad)
  const largeArcFlag = endAngleDeg - startAngleDeg > 180 ? 1 : 0

  return `M ${x1Outer} ${y1Outer} A ${rOuter} ${rOuter} 0 ${largeArcFlag} 1 ${x2Outer} ${y2Outer} L ${x2Inner} ${y2Inner} A ${rInner} ${rInner} 0 ${largeArcFlag} 0 ${x1Inner} ${y1Inner} Z`
}
