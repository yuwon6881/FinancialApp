import { useEffect, useState } from 'react'

export const BREAKPOINTS = {
  medium: 640,
  expanded: 1024,
} as const

// Expanded navigation starts at 1024px, but its 224px rail leaves laptop viewports with less
// usable content than a dense table needs. Keep that separate from the three window-size classes:
// this threshold chooses data presentation, not navigation or touch behaviour.
export const DENSE_CONTENT_BREAKPOINT = 1280

export type SizeClass = 'compact' | 'medium' | 'expanded'

const mediaQuery = (breakpoint: number) => `(min-width: ${breakpoint}px)`

export function getSizeClass(width: number): SizeClass {
  if (width < BREAKPOINTS.medium) return 'compact'
  if (width < BREAKPOINTS.expanded) return 'medium'
  return 'expanded'
}

export function isDenseContentWidth(width: number): boolean {
  return width >= DENSE_CONTENT_BREAKPOINT
}

export function isCompactViewport(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return !window.matchMedia(mediaQuery(BREAKPOINTS.medium)).matches
}

function readSizeClass(): SizeClass {
  if (typeof window === 'undefined' || !window.matchMedia) return 'expanded'
  if (!window.matchMedia(mediaQuery(BREAKPOINTS.medium)).matches) return 'compact'
  if (!window.matchMedia(mediaQuery(BREAKPOINTS.expanded)).matches) return 'medium'
  return 'expanded'
}

/**
 * Returns the Material-style window size class used by both layout and behaviour.
 * Queries are phrased as the negation of the matching min-width query rather than
 * a max-width query, so JavaScript and Tailwind agree at fractional viewport widths.
 */
export function useSizeClass(): SizeClass {
  const [sizeClass, setSizeClass] = useState<SizeClass>(readSizeClass)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const medium = window.matchMedia(mediaQuery(BREAKPOINTS.medium))
    const expanded = window.matchMedia(mediaQuery(BREAKPOINTS.expanded))
    const sync = () => setSizeClass(readSizeClass())

    sync()
    medium.addEventListener('change', sync)
    expanded.addEventListener('change', sync)
    return () => {
      medium.removeEventListener('change', sync)
      expanded.removeEventListener('change', sync)
    }
  }, [])

  return sizeClass
}

export function useIsCompact(): boolean {
  return useSizeClass() === 'compact'
}

export function useIsExpanded(): boolean {
  return useSizeClass() === 'expanded'
}

function readDenseContent(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return true
  return window.matchMedia(mediaQuery(DENSE_CONTENT_BREAKPOINT)).matches
}

export function useIsDenseContent(): boolean {
  const [isDenseContent, setIsDenseContent] = useState(readDenseContent)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const query = window.matchMedia(mediaQuery(DENSE_CONTENT_BREAKPOINT))
    const sync = () => setIsDenseContent(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  return isDenseContent
}
