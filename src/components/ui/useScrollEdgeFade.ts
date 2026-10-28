import { useCallback, useEffect, useState, type CSSProperties, type RefObject } from 'react'

export interface ScrollEdges {
  start: boolean
  end: boolean
}

export function scrollEdgeMask(edges: ScrollEdges, fadeSize = '4rem'): string | undefined {
  if (!edges.start && !edges.end) return undefined
  return `linear-gradient(to right, ${edges.start ? 'transparent' : '#000'}, #000 ${fadeSize}, #000 calc(100% - ${fadeSize}), ${edges.end ? 'transparent' : '#000'})`
}

/**
 * Fades edges of a horizontally scrollable container with a CSS mask when content
 * overflows, signalling to the user that more items can be scrolled into view.
 */
export function useScrollEdgeFade(
  ref: RefObject<HTMLElement | null>,
  contentKey: unknown,
  enabled = true,
): { edges: ScrollEdges; onScroll: () => void; style: CSSProperties | undefined } {
  const [edges, setEdges] = useState<ScrollEdges>({ start: false, end: false })

  const measureEdges = useCallback(() => {
    if (!enabled) return
    const rail = ref.current
    if (!rail) return
    const start = rail.scrollLeft > 1
    const end = rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 1
    setEdges(prev => (prev.start === start && prev.end === end ? prev : { start, end }))
  }, [enabled, ref])

  useEffect(() => {
    if (!enabled) {
      setEdges(prev => (!prev.start && !prev.end ? prev : { start: false, end: false }))
      return
    }
    measureEdges()
    const rail = ref.current
    const observer = rail && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measureEdges) : null
    if (rail) observer?.observe(rail)
    window.addEventListener('resize', measureEdges)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measureEdges)
    }
  }, [contentKey, enabled, measureEdges, ref])

  const mask = enabled ? scrollEdgeMask(edges) : undefined
  const style: CSSProperties | undefined = mask
    ? { maskImage: mask, WebkitMaskImage: mask }
    : undefined

  return {
    edges: enabled ? edges : { start: false, end: false },
    onScroll: measureEdges,
    style,
  }
}
