import { useEffect } from 'react'
import { motionSafeScrollBehavior } from '../../lib/motionPreference'

const HIGHLIGHT_CLASSES = ['ring-2', 'ring-blue-500/60', 'ring-offset-2', 'ring-offset-background', 'bg-blue-500/[0.06]', 'shadow-lg']

/**
 * Scrolls a just-navigated-to element into view and flashes the shared highlight ring.
 *
 * Every "take me to *that* one" jump uses this (a subscription card opened from the
 * dashboard, the category watch card opening Reports) so arriving somewhere always
 * looks the same. The 350ms delay lets the destination view finish mounting before the
 * target is looked up; when the target is not there (filtered out, not rendered) the
 * highlight state is cleared rather than left pending forever.
 */
export function useHighlightedElement(elementId: string | null, onClear?: () => void) {
  useEffect(() => {
    if (!elementId) return
    let clearTimer: ReturnType<typeof setTimeout> | undefined
    const timer = setTimeout(() => {
      const el = document.getElementById(elementId)
      if (el) {
        el.scrollIntoView({ behavior: motionSafeScrollBehavior(), block: 'center' })
        el.classList.add(...HIGHLIGHT_CLASSES)
        clearTimer = setTimeout(() => {
          el.classList.remove(...HIGHLIGHT_CLASSES)
          onClear?.()
        }, 2600)
      } else {
        onClear?.()
      }
    }, 350)
    return () => {
      clearTimeout(timer)
      if (clearTimer) clearTimeout(clearTimer)
      document.getElementById(elementId)?.classList.remove(...HIGHLIGHT_CLASSES)
    }
  }, [elementId, onClear])
}
