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
    let pollInterval: ReturnType<typeof setInterval> | undefined
    let applied = false
    const startTime = Date.now()

    const tryHighlight = () => {
      const el = document.getElementById(elementId)
      if (el) {
        applied = true
        if (pollInterval) clearInterval(pollInterval)
        el.scrollIntoView({ behavior: motionSafeScrollBehavior(), block: 'center' })
        el.classList.add(...HIGHLIGHT_CLASSES)
        clearTimer = setTimeout(() => {
          el.classList.remove(...HIGHLIGHT_CLASSES)
          onClear?.()
        }, 2600)
        return true
      }
      // If element not rendered after 3.5s, stop polling and clear
      if (Date.now() - startTime > 3500) {
        if (pollInterval) clearInterval(pollInterval)
        onClear?.()
        return true
      }
      return false
    }

    // Attempt immediately, otherwise poll every 100ms
    if (!tryHighlight()) {
      pollInterval = setInterval(tryHighlight, 100)
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval)
      if (clearTimer) clearTimeout(clearTimer)
      if (applied) {
        document.getElementById(elementId)?.classList.remove(...HIGHLIGHT_CLASSES)
      }
    }
  }, [elementId, onClear])
}
