import { useCallback, useRef, useState } from 'react'

/**
 * Keeps the page where it is when a tab swaps its panel for a shorter (or still-loading) one.
 * Without it the document shrinks under the reader, the browser clamps the scroll position, and
 * the page appears to jump up. The panel area keeps at least the height that reaches the bottom
 * of the viewport from where it starts, so the tab row stays exactly where it was clicked.
 */
export function usePanelSwitchHold<T>(onChange: (value: T) => void) {
  const areaRef = useRef<HTMLDivElement | null>(null)
  const [minHeight, setMinHeight] = useState<number | undefined>(undefined)
  const change = useCallback((value: T) => {
    const area = areaRef.current
    if (area) setMinHeight(Math.max(0, Math.ceil(window.innerHeight - area.getBoundingClientRect().top)))
    onChange(value)
  }, [onChange])
  return { areaRef, style: minHeight === undefined ? undefined : { minHeight }, change }
}
