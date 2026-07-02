import React, { useRef, useState } from 'react'
import { triggerHaptic } from './haptics'

/**
 * Drag-to-dismiss for bottom-sheet modals. Spread `handlers` onto the sheet
 * panel and merge `style` into its style prop.
 *
 * Behaviour:
 *  - Only starts a drag when the sheet is scrolled to the top and the touch
 *    did NOT begin on an interactive control (input/button/etc.), so it never
 *    fights content scrolling or field interaction.
 *  - Tracks only downward movement; past the threshold it closes (with a
 *    haptic), otherwise it springs back.
 */
export function useSheetDrag(onClose: () => void, threshold = 120) {
  const [dragY, setDragY] = useState(0)
  const [snapping, setSnapping] = useState(false)
  const active = useRef(false)
  const startY = useRef(0)

  const onTouchStart = (e: React.TouchEvent<HTMLElement>) => {
    if (e.currentTarget.scrollTop > 0) return
    const target = e.target as HTMLElement
    if (target.closest('input, textarea, select, button, a, [role="button"], [data-no-drag]')) return
    active.current = true
    startY.current = e.touches[0].clientY
  }

  const onTouchMove = (e: React.TouchEvent<HTMLElement>) => {
    if (!active.current) return
    const delta = e.touches[0].clientY - startY.current
    setDragY(delta > 0 ? delta : 0)
  }

  const onTouchEnd = () => {
    if (!active.current) return
    active.current = false
    if (dragY > threshold) {
      triggerHaptic(12)
      onClose()
    } else if (dragY > 0) {
      // Spring back to place.
      setSnapping(true)
      setDragY(0)
      window.setTimeout(() => setSnapping(false), 240)
    }
  }

  const style: React.CSSProperties = {
    transform: dragY ? `translateY(${dragY}px)` : snapping ? 'translateY(0px)' : undefined,
    transition: snapping ? 'transform 0.24s cubic-bezier(0.22, 1, 0.36, 1)' : undefined,
  }

  return {
    handlers: { onTouchStart, onTouchMove, onTouchEnd },
    style,
  }
}
