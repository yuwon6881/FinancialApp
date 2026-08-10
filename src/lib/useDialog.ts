import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
]
const FOCUSABLE_SELECTOR = FOCUSABLE_SELECTORS.join(',')
const FLOATING_FOCUSABLE_SELECTOR = FOCUSABLE_SELECTORS
  .map(selector => `[data-floating-overlay] ${selector}`)
  .join(',')

const isMobileLayout = () =>
  typeof window !== 'undefined' && window.matchMedia('(max-width: 639px), (pointer: coarse)').matches

const isTextEntryElement = (el: Element) => el.tagName === 'INPUT' || el.tagName === 'TEXTAREA'

const getDialogFocusables = (panel: HTMLElement): HTMLElement[] => {
  const inPanel = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
  // Dropdowns and calendars are portalled outside the panel to escape overflow,
  // but they are still logically part of the dialog and must stay in its Tab loop.
  const inFloatingLayers = Array.from(
    document.querySelectorAll<HTMLElement>(FLOATING_FOCUSABLE_SELECTOR),
  )
  return [...inPanel, ...inFloatingLayers]
}

interface UseDialogOptions {
  isOpen: boolean
  onClose: () => void
  /** Ref to the dialog panel that should trap focus. */
  ref: React.RefObject<HTMLElement | null>
  /** Optional safe focus target for dialogs whose first control opens a popover on focus. */
  initialFocusRef?: React.RefObject<HTMLElement | null>
  /**
   * Guard for the Escape key. Return false to swallow this Escape (e.g. an
   * open autocomplete inside the dialog should consume the first Escape).
   * Defaults to always allowing close.
   */
  canClose?: () => boolean
  /** Skip auto-focusing the first element (when the panel manages its own focus). */
  autoFocus?: boolean
  /** Ignore keyboard handling while a newer dialog is layered above this one. */
  isActive?: () => boolean
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
export function useDialog({ isOpen, onClose, ref, initialFocusRef, canClose, autoFocus = true, isActive }: UseDialogOptions) {
  const previouslyFocused = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)
  const canCloseRef = useRef(canClose)
  const isActiveRef = useRef(isActive)

  useEffect(() => {
    onCloseRef.current = onClose
    canCloseRef.current = canClose
    isActiveRef.current = isActive
  })

  useEffect(() => {
    if (!isOpen) return

    previouslyFocused.current = document.activeElement as HTMLElement | null

    const focusTimer = window.setTimeout(() => {
      if (isActiveRef.current && !isActiveRef.current()) return
      const panel = ref.current
      if (!panel || !autoFocus) return
      // Respect an element that already grabbed focus (e.g. autoFocus input).
      if (panel.contains(document.activeElement) && document.activeElement !== panel) return
      const focusables = getDialogFocusables(panel)
      const target = initialFocusRef?.current ?? focusables[0] ?? panel
      // On mobile, focusing a text field pops the on-screen keyboard immediately,
      // while the sheet is still mid-entrance-animation and the body scroll-lock
      // is still settling. The viewport resize this triggers races the CSS
      // transition, producing a brief flash where the backdrop/panel disappear.
      // Buttons don't open a keyboard, so they're safe to auto-focus everywhere.
      if (isMobileLayout() && isTextEntryElement(target)) {
        panel.focus({ preventScroll: true })
        return
      }
      target.focus()
    }, 40)

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isActiveRef.current && !isActiveRef.current()) return
      const panel = ref.current
      if (!panel) return

      if (e.key === 'Escape') {
        if (canCloseRef.current && !canCloseRef.current()) {
          e.preventDefault()
          return
        }
        e.preventDefault()
        onCloseRef.current()
        return
      }

      if (e.key !== 'Tab') return
      const focusables = getDialogFocusables(panel)
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
        if (active === first || (!panel.contains(active) && !active.closest('[data-floating-overlay]'))) {
          e.preventDefault()
          last.focus()
        }
      } else if (active === last || (!panel.contains(active) && !active.closest('[data-floating-overlay]'))) {
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
  }, [isOpen, ref, initialFocusRef, autoFocus])
}
