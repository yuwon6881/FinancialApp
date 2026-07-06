import React, { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, useDragControls, type PanInfo } from 'framer-motion'
import { useDialog } from '../../lib/useDialog'
import { useIsMobile } from '../../lib/useIsMobile'
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
  const isMobile = useIsMobile(640)

  // When the sheet's content fits without scrolling we set `touch-action: none`
  // so the browser never claims a downward drag as a scroll -- that lets the
  // *entire* panel be dragged to dismiss as smoothly as the grab handle, rather
  // than the body feeling dead (the browser was eating those gestures via the
  // `touch-action: pan-y` the panel needs only when it actually scrolls).
  const [panelCanScroll, setPanelCanScroll] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    const el = panelRef.current
    if (!el) return
    const measure = () => {
      const scrolls = el.scrollHeight - el.clientHeight > 1
      setPanelCanScroll(prev => (prev === scrolls ? prev : scrolls))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    Array.from(el.children).forEach(child => ro.observe(child))
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [isOpen, children])

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

  // Instagram-style swipe-to-dismiss from *anywhere* on the sheet -- buttons,
  // inputs, dropdowns, all of it. Nothing is excluded: a tap still works (a
  // drag only engages once the finger actually moves), and a short downward
  // pull dismisses. The only nuance is scrolling: a downward pull only becomes
  // a dismiss when the scroll container under the finger is already at its top;
  // otherwise the gesture scrolls, and a clearly horizontal gesture is left to
  // whatever it's on (e.g. a swipeable row).
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
    // back button, and we don't want to hijack text selection with a drag.
    if (e.pointerType === 'mouse') return
    gestureRef.current = { startX: e.clientX, startY: e.clientY, decided: 'none' }
  }

  const handlePanelPointerMove = (e: React.PointerEvent) => {
    const gesture = gestureRef.current
    if (!gesture || dragActiveRef.current || gesture.decided !== 'none') return
    const dy = e.clientY - gesture.startY
    const dx = e.clientX - gesture.startX
    // Engage as soon as the finger clearly starts moving.
    if (Math.abs(dy) < 3 && Math.abs(dx) < 3) return
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
            // Mobile: a pure slide-up (no scale/opacity) so the entrance always
            // reads as a slide, never a fade. Desktop keeps the gentle zoom.
            initial={isMobile ? { y: "100%" } : { y: "100%", scale: 0.95, opacity: 0 }}
            animate={isMobile ? { y: 0 } : { y: 0, scale: 1, opacity: 1 }}
            exit={isMobile ? { y: "100%" } : { y: "100%", scale: 0.95, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 34, mass: 0.9 }}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            // A real linear travel range (top locked at rest, a long free run
            // downward) so the sheet tracks the finger 1:1 the whole way. The
            // previous {top:0,bottom:0}+elastic put *all* downward motion "beyond
            // constraints", so framer's rubber-band dampening made it stiffer the
            // further you pulled -- the "stuck after a bit" feeling.
            dragConstraints={{ top: 0, bottom: 2000 }}
            dragElastic={0.12}
            dragMomentum={false}
            // Wide constraints keep the travel linear; snap-to-origin springs the
            // sheet back to rest when a drag doesn't reach the dismiss threshold
            // (without it, a short pull would just stay parked mid-screen).
            dragSnapToOrigin
            dragTransition={{ bounceStiffness: 320, bounceDamping: 34 }}
            onDragStart={() => { dragActiveRef.current = true }}
            onDragEnd={(_e, info: PanInfo) => {
              dragActiveRef.current = false
              gestureRef.current = null
              // Very easy to dismiss: a small downward pull or any soft flick
              // lets go of the sheet.
              if (info.velocity.y > 120 || info.offset.y > 36) {
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
            // Only allow the browser to own vertical panning when the sheet
            // genuinely scrolls; otherwise none, so framer gets every gesture
            // and the whole panel drags smoothly (see panelCanScroll above).
            style={{ touchAction: panelCanScroll ? 'pan-y' : 'none' }}
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
