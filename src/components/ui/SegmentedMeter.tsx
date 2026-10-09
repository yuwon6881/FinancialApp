import { cn } from '../../lib/utils'

interface MeterSegment {
  /** Any non-negative magnitude; segments are drawn in proportion to `total`. */
  value: number
  /** Fill as a CSS colour or variable. */
  color: string
  /** Name used in the accessible summary, e.g. "Spent". */
  label: string
}

interface SegmentedMeterProps {
  segments: MeterSegment[]
  /** The whole the segments are parts of. Defaults to their sum. */
  total?: number
  /** One sentence summarising the bar for assistive tech, e.g. "RM 320 spent and RM 80 pending of RM 900". */
  label: string
  size?: 'sm' | 'md' | 'lg'
  /** Optional marker drawn at a percentage of the track, e.g. today's position in the cycle. */
  markerPercent?: number
  markerLabel?: string
  className?: string
}

/**
 * A bar made of several fills -- spent plus pending against a budget, the four income buckets, a
 * rewards pool funding several goals. `Meter` covers the single-value case; this is the primitive
 * the audit recorded as missing, so the hand-rolled multi-fill bars can converge on one shape.
 *
 * It is an image, not a progressbar: there is more than one value, so the summary sentence in
 * `label` is what assistive tech reads.
 */
export function SegmentedMeter({
  segments,
  total,
  label,
  size = 'md',
  markerPercent,
  markerLabel,
  className,
}: SegmentedMeterProps) {
  const sum = segments.reduce((acc, segment) => acc + Math.max(0, segment.value), 0)
  const whole = Math.max(total ?? sum, sum, 0) || 1
  return (
    <div
      role="img"
      aria-label={label}
      className={cn(
        'relative flex w-full gap-0.5 overflow-hidden rounded-full bg-foreground/8 dark:bg-foreground/10',
        size === 'sm' ? 'h-1.5' : size === 'lg' ? 'h-3' : 'h-2',
        className,
      )}
    >
      {segments.map(segment => {
        const width = (Math.max(0, segment.value) / whole) * 100
        if (width <= 0) return null
        return (
          <span
            key={segment.label}
            className="h-full first:rounded-l-full last:rounded-r-full transition-[width] duration-700 ease-fluid"
            style={{ width: `${width}%`, backgroundColor: segment.color }}
          />
        )
      })}
      {markerPercent !== undefined && Number.isFinite(markerPercent) && (
        <span
          aria-hidden="true"
          title={markerLabel}
          className="absolute inset-y-0 w-0.5 -translate-x-1/2 rounded-full bg-foreground/70"
          style={{ left: `${Math.min(100, Math.max(0, markerPercent))}%` }}
        />
      )}
    </div>
  )
}
