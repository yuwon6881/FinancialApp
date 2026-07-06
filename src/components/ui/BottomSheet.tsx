import React, { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, useDragControls, type PanInfo } from 'framer-motion'
import { useDialog } from '../../lib/useDialog'
import { lockBodyScroll, unlockBodyScroll } from '../../lib/scrollLock'

interface BottomSheetProps {
  isOpen: boolean
  title: React.ReactNode
  children: React.ReactNode
  onClose: () => void
  maxWidthClassName?: string
  footer?: React.ReactNode
  /** Accessible name when `title` is not plain text. */
  ariaLabel?: string
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  title,
  children,
  onClose,
  maxWidthClassName = 'max-w-md',
  footer,
  ariaLabel
}) => {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => {
    if (!isOpen) return
    // Ref-counted so overlapping locks (nested sheets, or a view that also
    // locks for this same modal) compose safely -- see lib/scrollLock.ts.
    lockBodyScroll()
    return () => unlockBodyScroll()
  }, [isOpen])

  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // useId() is stable for a given component instance, including across
  // React StrictMode's dev-only synchronous mount->cleanup->remount
  // double-invoke -- so it can't distinguish "my own pushed entry is still
  // on top" from "a different (remounted) effect run pushed an
  // identically-named entry". Suffix with a counter that increments on
  // every actual effect invocation instead, so each run gets a genuinely
  // unique id even when produced by the same component instance.
  const instanceCounterRef = useRef(0)

  useEffect(() => {
    if (!isOpen) return

    const modalId = `modal-${titleId}-${++instanceCounterRef.current}`
    // Push a dummy history state so back button pops it instead of exiting the PWA
    window.history.pushState({ modalId }, '')

    const handlePopState = () => {
      onCloseRef.current()
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
      // Deferred to the next tick: under StrictMode's synchronous
      // mount->cleanup->remount double-invoke, calling history.back()
      // immediately here would race the *new* instance's pushState
      // (already issued by the time this runs). history.back() only
      // resolves asynchronously, so its popstate event could otherwise end
      // up delivered to the new instance's freshly-attached listener,
      // immediately closing a modal that just opened.
      setTimeout(() => {
        if (window.history.state?.modalId === modalId) {
          window.history.back()
        }
      }, 0)
    }
  }, [isOpen])

  useDialog({ isOpen, onClose, ref: panelRef })

  const backdropMouseDownRef = useRef(false)
  const dragControls = useDragControls()

  // Instagram-style swipe-to-dismiss from anywhere on the sheet (including over
  // an unfocused text input) while still letting inner scroll regions scroll. A
  // downward drag only becomes a dismiss when the scroll container under the
  // finger is already at its top; otherwise the gesture is left to native
  // scrolling. Interactive controls (buttons, links, selects, sliders) and any
  // region explicitly opting out with `data-no-drag` keep their own gestures.
  // Note text inputs are deliberately NOT excluded so the sheet can still be
  // dismissed with a finger resting on a field that hasn't been focused yet.
  const NO_DRAG_SELECTOR =
    'button, a, select, input[type="range"], [role="button"], [role="slider"], [data-no-drag="true"], [data-no-sheet-drag]'
  const gestureRef = useRef<{ startX: number; startY: number; decided: 'none' | 'scroll' | 'drag' } | null>(null)
  const dragActiveRef = useRef(false)

  // Walk from the touched element up to the panel and report whether the first
  // scrollable ancestor is pinned to its top (so a downward pull should dismiss
  // rather than scroll). No scrollable ancestor => treat as "at top".
  const scrollableAtTop = (target: HTMLElement | null, boundary: HTMLElement): boolean => {
    let node: HTMLElement | null = target
    while (node && node !== boundary.parentElement) {
      const oy = getComputedStyle(node).overflowY
      if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight - node.clientHeight > 1) {
        return node.scrollTop <= 0
      }
      if (node === boundary) break
      node = node.parentElement
    }
    return true
  }

  const handlePanelPointerDown = (e: React.PointerEvent) => {
    // Swipe-to-dismiss is a touch affordance; a mouse can use the backdrop /
    // back button / close controls, and we don't want to hijack text selection.
    if (e.pointerType === 'mouse') return
    const target = e.target as HTMLElement
    if (target.closest(NO_DRAG_SELECTOR)) {
      gestureRef.current = null
      return
    }
    gestureRef.current = { startX: e.clientX, startY: e.clientY, decided: 'none' }
  }

  const handlePanelPointerMove = (e: React.PointerEvent) => {
    const gesture = gestureRef.current
    if (!gesture || dragActiveRef.current || gesture.decided !== 'none') return
    const dy = e.clientY - gesture.startY
    const dx = e.clientX - gesture.startX
    if (Math.abs(dy) < 5 && Math.abs(dx) < 5) return
    // A clearly horizontal gesture belongs to something else (e.g. a swipeable
    // row) -- bow out and let it run for the rest of this touch.
    if (Math.abs(dx) > Math.abs(dy)) {
      gesture.decided = 'scroll'
      return
    }
    const panel = panelRef.current
    if (dy > 0 && panel && scrollableAtTop(e.target as HTMLElement, panel)) {
      gesture.decided = 'drag'
      dragControls.start(e)
    } else {
      // Upward, or downward while the content under the finger can still scroll
      // up: leave it to native scrolling for the rest of this gesture. The user
      // must lift and pull again once at the top to dismiss.
      gesture.decided = 'scroll'
    }
  }

  const clearGesture = () => {
    gestureRef.current = null
  }

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onMouseDown={(e: React.MouseEvent) => {
            backdropMouseDownRef.current = e.target === e.currentTarget
          }}
          onClick={(e: React.MouseEvent) => {
            if (e.target === e.currentTarget && backdropMouseDownRef.current) {
              onClose()
            }
            backdropMouseDownRef.current = false
          }}
          className="sheet-backdrop fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        >
          <motion.div
            key="sheet"
            ref={panelRef}
            initial={{ y: "100%", scale: 0.95, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: "100%", scale: 0.95, opacity: 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            // Lock upward drag at rest (top: 0) but let a downward drag track the
            // finger 1:1 (bottom elastic 1) so the sheet feels "grabbed" rather
            // than rubber-banded -- the earlier 0.5 made it move half as far as
            // the finger, which read as stiff/hard to dismiss.
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 1 }}
            dragMomentum={false}
            onDragStart={() => { dragActiveRef.current = true }}
            onDragEnd={(_e, info: PanInfo) => {
              dragActiveRef.current = false
              gestureRef.current = null
              // Easy to dismiss: a short pull (~a quarter of the way) or any
              // gentle downward flick lets go of the sheet.
              if (info.velocity.y > 250 || info.offset.y > 64) {
                onClose()
              }
            }}
            onPointerDown={handlePanelPointerDown}
            onPointerMove={handlePanelPointerMove}
            onPointerUp={clearGesture}
            onPointerCancel={clearGesture}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-label={ariaLabel}
            tabIndex={-1}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            className={`sheet-panel w-full ${maxWidthClassName} bg-card border border-border/80 rounded-2xl shadow-2xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto focus:outline-none`}
          >
            <div
              style={{ touchAction: 'none' }}
              className="pb-3 shrink-0"
            >
              <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full mx-auto mb-2 shrink-0" />
              <div className="flex items-center justify-between border-b border-border/40 pb-3">
                <div id={titleId} className="min-w-0 text-base font-bold text-foreground">{title}</div>
              </div>
            </div>
            {children}
            {footer && <div className="border-t border-border/40 pt-4">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
