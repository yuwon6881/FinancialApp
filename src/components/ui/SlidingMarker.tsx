import { m } from 'framer-motion'
import { SPRING } from '../../lib/animations'
import { cn } from '../../lib/utils'
import type { MarkerBox } from './useSlidingMarker'

/**
 * The marker itself: `fill` covers the selected option (a segmented pill); `underline` is a bar
 * along the row's bottom edge, inset from the option's sides. Render it before the options so
 * they paint above it.
 */
export function SlidingMarker({ box, shape, className }: {
  box: MarkerBox | null
  shape: 'fill' | 'underline'
  className?: string
}) {
  if (!box) return null
  const inset = shape === 'underline' ? 6 : 0
  return (
    <m.span
      aria-hidden="true"
      data-sliding-marker=""
      initial={false}
      animate={shape === 'fill'
        ? { x: box.left, y: box.top, width: box.width, height: box.height }
        : { x: box.left + inset, width: Math.max(0, box.width - inset * 2) }}
      transition={SPRING.snappy}
      className={cn(
        'pointer-events-none absolute left-0',
        shape === 'fill' ? 'top-0' : '-bottom-px h-0.5',
        className,
      )}
    />
  )
}
