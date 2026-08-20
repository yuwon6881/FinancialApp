import { useEffect, useRef } from 'react'
import { motionSafeScrollBehavior } from '../../lib/motionPreference'

const HIGHLIGHT_CLASS = 'search-target-highlight'

/**
 * Scrolls a just-navigated-to element into view and flashes the shared highlight ring.
 *
 * Every "take me to *that* one" jump uses this (a subscription card opened from the
 * dashboard, the category watch card opening Reports) so arriving somewhere always
 * looks the same. A brief mount delay lets the destination view finish mounting and
 * rendering its base state before the ring transition smoothly animates in; when the
 * target is not there (filtered out, not rendered) the highlight state is cleared.
 */
export function useHighlightedElement(elementId: string | null, onClear?: () => void) {
  const onClearRef = useRef(onClear)
  useEffect(() => {
    onClearRef.current = onClear
  })

  useEffect(() => {
    if (!elementId) return
    let clearTimer: ReturnType<typeof setTimeout> | undefined
    let applyTimer: ReturnType<typeof setTimeout> | undefined
    let pollInterval: ReturnType<typeof setInterval> | undefined
    let applied = false
    const startTime = Date.now()

    const triggerHighlight = (el: HTMLElement) => {
      applied = true
      if (pollInterval) clearInterval(pollInterval)
      // Allow destination view layout and un-highlighted base styles to paint first,
      // so scrollIntoView and CSS transition-all smoothly animate the highlight in.
      applyTimer = setTimeout(() => {
        // `inline: center` is required for records in Rewards/Commitments rails. The default
        // nearest-edge behavior was browser-dependent and could leave a searched card clipped at
        // the far end even though the page itself had scrolled vertically to the section.
        el.scrollIntoView({ behavior: motionSafeScrollBehavior(), block: 'center', inline: 'center' })
        el.classList.add(HIGHLIGHT_CLASS)
        clearTimer = setTimeout(() => {
          el.classList.remove(HIGHLIGHT_CLASS)
          onClearRef.current?.()
        }, 2600)
      }, 100)
    }

    const tryHighlight = () => {
      const el = document.getElementById(elementId)
      if (el) {
        triggerHighlight(el)
        return true
      }
      // If element not rendered after 3.5s, stop polling and clear
      if (Date.now() - startTime > 3500) {
        if (pollInterval) clearInterval(pollInterval)
        onClearRef.current?.()
        return true
      }
      return false
    }

    if (!tryHighlight()) {
      pollInterval = setInterval(tryHighlight, 100)
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval)
      if (applyTimer) clearTimeout(applyTimer)
      if (clearTimer) clearTimeout(clearTimer)
      if (applied) {
        document.getElementById(elementId)?.classList.remove(HIGHLIGHT_CLASS)
      }
    }
  }, [elementId])
}
