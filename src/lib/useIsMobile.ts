import { useEffect, useState } from 'react'

/**
 * Returns true when the viewport is below the given breakpoint (default: Tailwind's `md` = 768px).
 * Used to enable touch-only affordances (e.g. swipe-to-reveal) on the mobile PWA while
 * keeping the full desktop layout intact.
 */
export function useIsMobile(breakpoint = 768): boolean {
  // Phrased as the negation of Tailwind's own `md:` query (`min-width: 768px`) rather
  // than `max-width: 767px`, so the two agree at fractional viewport widths. At 767.5px
  // `max-width: 767px` is false while Tailwind still applies the mobile branch — using
  // that form made JS render the desktop tree while CSS displayed the mobile one.
  const query = `(min-width: ${breakpoint}px)`

  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return !window.matchMedia(query).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mql = window.matchMedia(query)
    const handler = (e: MediaQueryListEvent) => setIsMobile(!e.matches)
    // Sync immediately in case the breakpoint changed between renders
    setIsMobile(!mql.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [query])

  return isMobile
}
