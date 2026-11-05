import { useLayoutEffect, useRef, useState } from 'react'

export interface MarkerBox {
  left: number
  top: number
  width: number
  height: number
}

/**
 * Tracks where the selected option sits inside its row so a selection marker can slide to it.
 *
 * The box is the option's offset within the row, never its position on screen. A dialog that
 * re-centres because the newly selected view is taller moves the whole row; a marker measured on
 * screen (framer's shared `layoutId`) would carry that move and drift diagonally instead of
 * sliding sideways. The row must be the options' offset parent (`position: relative`).
 */
export function useSlidingMarker(activeIndex: number, count: number) {
  const rowRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Array<HTMLElement | null>>([])
  const [box, setBox] = useState<MarkerBox | null>(null)

  useLayoutEffect(() => {
    const measure = () => {
      const item = itemRefs.current[activeIndex]
      setBox(item && item.offsetWidth > 0
        ? { left: item.offsetLeft, top: item.offsetTop, width: item.offsetWidth, height: item.offsetHeight }
        : null)
    }
    measure()
    const row = rowRef.current
    if (!row || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(row)
    for (const item of itemRefs.current.slice(0, count)) if (item) observer.observe(item)
    return () => observer.disconnect()
  }, [activeIndex, count])

  return {
    rowRef,
    box,
    itemRef: (index: number) => (node: HTMLElement | null) => { itemRefs.current[index] = node },
  }
}
