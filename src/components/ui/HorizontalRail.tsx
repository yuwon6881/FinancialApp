import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Button } from './Button'
import { motionSafeScrollBehavior } from '../../lib/motionPreference'

interface HorizontalRailProps {
  children: ReactNode
  className?: string
  /** Describes the rail for screen readers, e.g. "Commitments". */
  label: string
  /** Adds desktop previous/next controls when the rail actually overflows. */
  showControls?: boolean
}

/**
 * A single-row, horizontally scrollable strip with no visible scrollbar.
 *
 * Used for the Rewards page's commitment and reward rows: they grow sideways instead of pushing the
 * page down forever, so the whole picture stays on one screen no matter how many items exist.
 *
 * The vertical gesture belongs to the page once the rail reaches an edge. While there is still
 * horizontal content in the wheel's direction, a native non-passive listener consumes vertical
 * wheel input and moves the rail sideways. Touch input remains entirely native, so a horizontal
 * finger swipe scrolls the rail and a vertical swipe continues scrolling the page.
 */
export function HorizontalRail({ children, className, label, showControls = false }: HorizontalRailProps) {
  const wheelSurfaceRef = useRef<HTMLDivElement>(null)
  const railRef = useRef<HTMLDivElement>(null)
  const [scrollState, setScrollState] = useState({ canScrollBack: false, canScrollForward: false })

  const updateScrollState = useCallback(() => {
    const rail = railRef.current
    if (!rail) return
    const maxScrollLeft = Math.max(0, rail.scrollWidth - rail.clientWidth)
    setScrollState({
      canScrollBack: rail.scrollLeft > 1,
      canScrollForward: rail.scrollLeft < maxScrollLeft - 1,
    })
  }, [])

  const handleWheel = useCallback((event: WheelEvent) => {
    const rail = railRef.current
    if (!rail) return

    // A mouse wheel normally reports deltaY, while a trackpad can report deltaX. Prefer the
    // dominant axis so both desktop input styles move the same rail.
    const rawDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
    if (rawDelta === 0) return
    const deltaMultiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rail.clientWidth : 1
    const delta = rawDelta * deltaMultiplier

    const maxScrollLeft = Math.max(0, rail.scrollWidth - rail.clientWidth)
    if (maxScrollLeft === 0) return

    const atStart = rail.scrollLeft <= 0
    const atEnd = rail.scrollLeft >= maxScrollLeft - 1
    // Leave the event untouched at either edge so the page can continue scrolling in the same
    // direction instead of trapping the pointer inside the rail.
    const canConsumeWheel = delta < 0 ? !atStart : !atEnd
    if (!canConsumeWheel) return

    rail.scrollLeft = Math.max(0, Math.min(maxScrollLeft, rail.scrollLeft + delta))
    updateScrollState()
    // React's delegated wheel event can be passive in the browser. This listener is explicitly
    // non-passive so consuming horizontal rail movement never logs a preventDefault warning.
    if (event.cancelable) event.preventDefault()
  }, [updateScrollState])

  useEffect(() => {
    const wheelSurface = wheelSurfaceRef.current
    if (!wheelSurface) return
    // Capture the event before a card or button can handle it. This is important for real mouse
    // wheels: the pointer is usually over a nested card control, while the rail owns the scroll.
    const options: AddEventListenerOptions = { passive: false, capture: true }
    wheelSurface.addEventListener('wheel', handleWheel, options)
    return () => wheelSurface.removeEventListener('wheel', handleWheel, options)
  }, [handleWheel])

  useEffect(() => {
    const rail = railRef.current
    if (!rail) return

    updateScrollState()
    rail.addEventListener('scroll', updateScrollState, { passive: true })
    window.addEventListener('resize', updateScrollState)

    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(updateScrollState)
    resizeObserver?.observe(rail)
    Array.from(rail.children).forEach(child => resizeObserver?.observe(child))

    return () => {
      rail.removeEventListener('scroll', updateScrollState)
      window.removeEventListener('resize', updateScrollState)
      resizeObserver?.disconnect()
    }
  }, [children, updateScrollState])

  const scrollByPage = useCallback((direction: -1 | 1) => {
    const rail = railRef.current
    if (!rail) return
    rail.scrollBy({
      left: direction * Math.max(240, rail.clientWidth * 0.8),
      behavior: motionSafeScrollBehavior(),
    })
  }, [])

  return (
    <div ref={wheelSurfaceRef} className="group/horizontal-rail relative min-w-0">
      <div
        ref={railRef}
        role="group"
        aria-label={label}
        className={cn(
          // No touch-action restriction: vertical finger gestures must remain available to the page.
          // Desktop CSS disables snapping so small mouse-wheel ticks cannot be rolled back between
          // wide cards; touch devices retain the native proximity snap that already feels right.
          'horizontal-rail no-scrollbar flex w-full min-w-0 gap-3 overflow-x-auto overscroll-x-contain',
          'snap-x snap-proximity pb-1',
          className,
        )}
      >
        {children}
      </div>

      {showControls && scrollState.canScrollBack && (
        <Button
          variant="outline"
          size="icon"
          type="button"
          onClick={() => scrollByPage(-1)}
          aria-label={`Scroll ${label} left`}
          className="horizontal-rail-control absolute left-2 top-1/2 z-10 size-8 -translate-y-1/2 rounded-full bg-card/95 shadow-lg backdrop-blur-sm"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Button>
      )}
      {showControls && scrollState.canScrollForward && (
        <Button
          variant="outline"
          size="icon"
          type="button"
          onClick={() => scrollByPage(1)}
          aria-label={`Scroll ${label} right`}
          className="horizontal-rail-control absolute right-2 top-1/2 z-10 size-8 -translate-y-1/2 rounded-full bg-card/95 shadow-lg backdrop-blur-sm"
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      )}
    </div>
  )
}
