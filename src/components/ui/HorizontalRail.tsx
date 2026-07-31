import { useCallback, useRef, type ReactNode } from 'react'
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
 * The vertical gesture belongs to the page, never to the rail. A rail sits in the middle of a
 * scrolling page, so anything that claims the wheel or a vertical swipe strands the reader on it --
 * which is why this does not translate wheel-down into scroll-right and does not restrict
 * touch-action. Horizontal movement reaches the rail through the browser's own handling: a trackpad
 * swipe, shift+wheel, and touch drag all work natively. A plain mouse gets click-drag, which only
 * suppresses the click it lands on after travelling far enough to be unambiguously a drag.
 */
export function HorizontalRail({ children, className, label }: HorizontalRailProps) {
  const railRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ pointerId: number; startX: number; startScrollLeft: number; moved: boolean } | null>(null)

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
        // No touch-action restriction: pan-x would have told the browser this element only handles
        // horizontal gestures, but the browser reads that as "vertical does nothing here" rather
        // than "pass vertical to the page", so a finger dragging up over the rail went nowhere.
        'no-scrollbar flex gap-3 overflow-x-auto overscroll-x-contain',
        // Proximity, not mandatory: mandatory snapping cancels a free drag mid-flight and
        // yanks back to the nearest card, which is most of what made desktop scrolling feel stuck.
        'snap-x snap-proximity pb-1',
        className,
      )}
    >
      {children}
    </div>
  )
}
