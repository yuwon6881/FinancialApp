import { useCallback, useEffect, useRef, type ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface HorizontalRailProps {
  children: ReactNode
  className?: string
  /** Describes the rail for screen readers, e.g. "Commitments". */
  label: string
}

/** Pointer travel, in px, past which a drag stops counting as a click on the card underneath. */
const DRAG_CLICK_THRESHOLD = 6

/**
 * A single-row, horizontally scrollable strip with no visible scrollbar.
 *
 * Used for the Rewards page's commitment and reward rows: they grow sideways instead of pushing the
 * page down forever, so the whole picture stays on one screen no matter how many items exist.
 *
 * Touch scrolls natively. Desktop has neither a scrollbar nor a touch surface, so it gets two
 * affordances: vertical wheel movement translated into horizontal scrolling, and click-drag on the
 * rail background. Both are deliberately conditional -- the wheel hands the gesture back to the page
 * once the rail reaches an end, so the pointer never feels trapped, and a drag only suppresses the
 * click it lands on after travelling far enough to be unambiguous.
 */
export function HorizontalRail({ children, className, label }: HorizontalRailProps) {
  const railRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ pointerId: number; startX: number; startScrollLeft: number; moved: boolean } | null>(null)

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
    // Deliberately not scrollBy({ behavior: 'smooth' }): a wheel emits a burst of events, and each
    // smooth animation restarts from the last *animated* position rather than the target, so the
    // burst fights itself and the rail crawls. Direct assignment tracks the wheel one-to-one.
    rail.scrollLeft += event.deltaY
  }, [])

  useEffect(() => {
    const rail = railRef.current
    if (!rail) return
    // Non-passive so preventDefault actually suppresses the page scroll.
    rail.addEventListener('wheel', handleWheel, { passive: false })
    return () => rail.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    // Touch and pen already scroll natively; hijacking them would break momentum and snapping.
    if (event.pointerType !== 'mouse' || event.button !== 0) return
    const rail = railRef.current
    if (!rail || rail.scrollWidth <= rail.clientWidth) return
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startScrollLeft: rail.scrollLeft, moved: false }
  }, [])

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    const rail = railRef.current
    if (!drag || !rail || drag.pointerId !== event.pointerId) return

    const travel = event.clientX - drag.startX
    if (!drag.moved) {
      if (Math.abs(travel) < DRAG_CLICK_THRESHOLD) return
      drag.moved = true
      // Capture only once the gesture is unmistakably a drag, so a plain click still reaches the card.
      rail.setPointerCapture(event.pointerId)
      // Without this a drag paints a text selection across every card it passes over.
      rail.style.userSelect = 'none'
    }
    rail.scrollLeft = drag.startScrollLeft - travel
  }, [])

  const endDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    const rail = railRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    if (drag.moved && rail) {
      if (rail.hasPointerCapture(event.pointerId)) rail.releasePointerCapture(event.pointerId)
      rail.style.userSelect = ''
    }
    // A completed drag is left set until the click that follows pointerup has been swallowed by
    // handleClickCapture. A cancelled one is cleared here, because no click follows it -- leaving it
    // set would make the rail eat the next genuine click on a card.
    if (!drag.moved || event.type === 'pointercancel') dragRef.current = null
  }, [])

  const handleClickCapture = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (dragRef.current?.moved) {
      event.preventDefault()
      event.stopPropagation()
    }
    dragRef.current = null
  }, [])

  return (
    <div
      ref={railRef}
      role="group"
      aria-label={label}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onClickCapture={handleClickCapture}
      className={cn(
        'no-scrollbar flex gap-3 overflow-x-auto overscroll-x-contain',
        // touch-pan-x keeps the browser's own momentum scrolling on mobile while letting a vertical
        // swipe fall through to the page.
        'touch-pan-x',
        // Proximity, not mandatory: mandatory snapping cancels a free wheel or drag mid-flight and
        // yanks back to the nearest card, which is most of what made desktop scrolling feel stuck.
        'snap-x snap-proximity pb-1',
        className,
      )}
    >
      {children}
    </div>
  )
}
