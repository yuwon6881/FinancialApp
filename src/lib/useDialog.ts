import { useEffect, useRef } from 'react'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

/**
 * Accessibility behaviour shared by every modal/dialog:
 *  - Escape closes it.
 *  - Focus is moved into the panel on open and trapped (Tab / Shift+Tab cycle).
 *  - Focus returns to the element that opened it on close.
 *
 * Attach the returned ref to the dialog panel element and spread the standard
 * dialog ARIA attributes yourself (role="dialog" aria-modal="true").
 */
export function useDialog<T extends HTMLElement = HTMLDivElement>(
  isOpen: boolean,
  onClose: () => void,
) {
  const panelRef = useRef<T | null>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)

  // Keep the latest onClose without making it an effect dependency, so passing
  // an inline callback doesn't re-run focus/listener setup on every render.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!isOpen) return
    const panel = panelRef.current

    // Remember what was focused so we can restore it when the dialog closes.
    restoreFocusRef.current = document.activeElement as HTMLElement | null

    // Move focus into the dialog (first field, else the panel itself). Defer a
    // frame so lazily-mounted content and autofocus refs settle first.
    const focusTimer = window.setTimeout(() => {
      if (!panel) return
      if (panel.contains(document.activeElement)) return
      const first = panel.querySelector<HTMLElement>(FOCUSABLE)
      ;(first ?? panel).focus?.()
    }, 30)

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab' || !panel) return
      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        el => el.offsetParent !== null || el === document.activeElement,
      )
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', handleKeyDown, true)
      // Restore focus to the opener (guard against elements that have gone away).
      const el = restoreFocusRef.current
      if (el && document.contains(el)) el.focus?.()
    }
  }, [isOpen])

  return panelRef
}
