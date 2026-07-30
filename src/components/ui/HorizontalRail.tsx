import { useCallback, useEffect, useRef, type ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface HorizontalRailProps {
  children: ReactNode
  className?: string
  /** Describes the rail for screen readers, e.g. "Commitments". */
  label: string
}

/**
 * A single-row, horizontally scrollable strip with no visible scrollbar.
 *
 * Used for the Rewards page's commitment and reward rows: they grow sideways instead of pushing the
 * page down forever, so the whole picture stays on one screen no matter how many items exist.
 *
 * Desktop gets vertical wheel movement translated into horizontal scrolling, because a trackpad or
 * mouse over a horizontal strip otherwise does nothing. That translation is deliberately conditional
 * -- once the rail reaches an end, the event is left alone so the page keeps scrolling normally
 * instead of the pointer feeling stuck.
 */
export function HorizontalRail({ children, className, label }: HorizontalRailProps) {
  const railRef = useRef<HTMLDivElement>(null)

  const handleWheel = useCallback((event: WheelEvent) => {
    const rail = railRef.current
    if (!rail) return

    // A genuinely horizontal gesture (shift+wheel, or a trackpad swipe) already works natively.
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return

    const maxScroll = rail.scrollWidth - rail.clientWidth
    if (maxScroll <= 0) return

    const atStart = rail.scrollLeft <= 0
    const atEnd = rail.scrollLeft >= maxScroll - 1
    // Hand the gesture back to the page at either end, so the rail never traps the pointer.
    if ((event.deltaY < 0 && atStart) || (event.deltaY > 0 && atEnd)) return

    event.preventDefault()
    rail.scrollLeft += event.deltaY
  }, [])

  useEffect(() => {
    const rail = railRef.current
    if (!rail) return
    // Non-passive so preventDefault actually suppresses the page scroll.
    rail.addEventListener('wheel', handleWheel, { passive: false })
    return () => rail.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  return (
    <div
      ref={railRef}
      role="group"
      aria-label={label}
      className={cn(
        'no-scrollbar flex gap-3 overflow-x-auto overscroll-x-contain scroll-smooth',
        // Padding rather than margin so the first and last card are not clipped by the scroll box,
        // and cards snap to the left edge as the rail moves.
        'snap-x snap-mandatory pb-1',
        className,
      )}
    >
      {children}
    </div>
  )
}
