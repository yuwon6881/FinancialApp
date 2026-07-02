import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

interface UseDialogOptions {
  isOpen: boolean
  onClose: () => void
  /** Ref to the dialog panel that should trap focus. */
  ref: React.RefObject<HTMLElement | null>
  /**
   * Guard for the Escape key. Return false to swallow this Escape (e.g. an
   * open autocomplete inside the dialog should consume the first Escape).
   * Defaults to always allowing close.
   */
  canClose?: () => boolean
  /** Skip auto-focusing the first element (when the panel manages its own focus). */
  autoFocus?: boolean
}

/**
 * Accessibility behaviour shared by every modal dialog:
 *  - marks the panel as a focus trap (Tab / Shift+Tab cycle within it)
 *  - moves focus into the dialog on open and restores it to the trigger on close
 *  - closes on Escape (respecting an optional guard so nested widgets win first)
 *
 * The keydown listener runs on `document` in the bubble phase, so React's own
 * onKeyDown handlers inside the dialog run first and can pre-empt the Escape.
 */
export function useDialog({ isOpen, onClose, ref, canClose, autoFocus = true }: UseDialogOptions) {
  const previouslyFocused = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)
  const canCloseRef = useRef(canClose)

  useEffect(() => {
    onCloseRef.current = onClose
    canCloseRef.current = canClose
  })

  useEffect(() => {
    if (!isOpen) return

    previouslyFocused.current = document.activeElement as HTMLElement | null

    const focusTimer = window.setTimeout(() => {
      const panel = ref.current
      if (!panel || !autoFocus) return
      // Respect an element that already grabbed focus (e.g. autoFocus input).
      if (panel.contains(document.activeElement) && document.activeElement !== panel) return
      const focusables = panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ;(focusables[0] ?? panel).focus()
    }, 40)

    const handleKeyDown = (e: KeyboardEvent) => {
      const panel = ref.current
      if (!panel) return

      if (e.key === 'Escape') {
        if (canCloseRef.current && !canCloseRef.current()) return
        e.preventDefault()
        onCloseRef.current()
        return
      }

      if (e.key !== 'Tab') return
      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
        .filter(el => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement)
      if (focusables.length === 0) {
        e.preventDefault()
        panel.focus()
        return
      }
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement as HTMLElement

      if (e.shiftKey) {
        if (active === first || !panel.contains(active)) {
          e.preventDefault()
          last.focus()
        }
      } else if (active === last || !panel.contains(active)) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', handleKeyDown)
      const prev = previouslyFocused.current
      if (prev && typeof prev.focus === 'function' && document.contains(prev)) {
        prev.focus()
      }
    }
  }, [isOpen, ref, autoFocus])
}
