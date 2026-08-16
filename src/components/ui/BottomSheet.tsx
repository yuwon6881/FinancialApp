import React, { useEffect, useLayoutEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { m, AnimatePresence, useDragControls, useReducedMotion, type PanInfo } from 'framer-motion'
import { useDialog } from '../../lib/useDialog'
import { useIsMobile } from '../../lib/useIsMobile'
import { lockBodyScroll, unlockBodyScroll } from '../../lib/scrollLock'
import { Z_LAYERS } from '../../lib/zLayers'
import { motionSafeScrollBehavior } from '../../lib/motionPreference'

interface BottomSheetProps {
  isOpen: boolean
  title: React.ReactNode
  headerActions?: React.ReactNode
  children: React.ReactNode
  onClose: () => void
  /** Optional safe focus target for sheets whose first control opens a popover on focus. */
  initialFocusRef?: React.RefObject<HTMLElement | null>
  maxWidthClassName?: string
  footer?: React.ReactNode
  description?: React.ReactNode
  /** Accessible name when `title` is not plain text. */
  ariaLabel?: string
  ariaDescribedBy?: string
  layerClassName?: string
  backdropClassName?: string
  panelClassName?: string
}

const openModalIds: string[] = []
let suppressModalPopState = false

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  title,
  headerActions,
  children,
  onClose,
  initialFocusRef,
  maxWidthClassName = 'max-w-md',
  footer,
  description,
  ariaLabel,
  ariaDescribedBy,
  layerClassName = Z_LAYERS.sheet,
  backdropClassName = '',
  panelClassName = '',
}) => {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const isMobile = useIsMobile()
  const reduceMotion = useReducedMotion()

  // Pace the slide by measured height so a tall sheet and a short sheet travel
  // at roughly the same perceived *speed*. A fixed duration makes a near-
  // viewport-height sheet cover its much larger travel so fast it reads as a
  // fade. Measured in a layout effect -- before the browser paints -- so the
  // correct duration is already in place for the entrance's first frame.
  //
  // The slide itself is driven purely by framer's initial -> animate on mount
  // (see the `sheet-enter` motion.div). We deliberately do NOT gate it behind
  // an extra state flag flipped on a later requestAnimationFrame: that gate
  // raced React's render scheduling against framer's animation clock, so the
  // entrance only actually played on a minority of opens -- the rest jumped
  // straight to the shown state and looked like an instant fade. framer's
  // `initial` already gives every open a below-the-viewport starting point
  // (both on a fresh mount and when AnimatePresence re-adds the child as
  // `isOpen` toggles), so no gate is needed.
  const [slideDuration, setSlideDuration] = useState(0.5)

  useLayoutEffect(() => {
    if (!isOpen) return
    const el = panelRef.current
    if (!el) return
    const h = el.offsetHeight || el.scrollHeight || window.innerHeight
    setSlideDuration(Math.min(0.5, Math.max(0.25, h / 1500)))
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    // Ref-counted so overlapping locks (nested sheets, or a view that also
    // locks for this same modal) compose safely -- see lib/scrollLock.ts.
    lockBodyScroll()
    return () => unlockBodyScroll()
  }, [isOpen])

  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  // useId() is stable for a given component instance, including across
  // React StrictMode's dev-only synchronous mount->cleanup->remount
  // double-invoke -- so it can't distinguish "my own pushed entry is still
  // on top" from "a different (remounted) effect run pushed an
  // identically-named entry". Suffix with a counter that increments on
  // every actual effect invocation instead, so each run gets a genuinely
  // unique id even when produced by the same component instance.
  const instanceCounterRef = useRef(0)
  const activeModalIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!isOpen) return

    const modalId = `modal-${titleId}-${++instanceCounterRef.current}`
    activeModalIdRef.current = modalId
    openModalIds.push(modalId)
    // Push a dummy history state so back button pops it instead of exiting the PWA
    window.history.pushState({ modalId }, '')

    const handlePopState = () => {
      if (suppressModalPopState || openModalIds.at(-1) !== modalId) return
      onCloseRef.current()
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
      const stackIndex = openModalIds.lastIndexOf(modalId)
      if (stackIndex >= 0) openModalIds.splice(stackIndex, 1)
      if (activeModalIdRef.current === modalId) activeModalIdRef.current = null
      // Deferred to the next tick: under StrictMode's synchronous
      // mount->cleanup->remount double-invoke, calling history.back()
      // immediately here would race the *new* instance's pushState
      // (already issued by the time this runs). history.back() only
      // resolves asynchronously, so its popstate event could otherwise end
      // up delivered to the new instance's freshly-attached listener,
      // immediately closing a modal that just opened.
      setTimeout(() => {
        if (window.history.state?.modalId === modalId) {
          suppressModalPopState = true
          window.addEventListener('popstate', () => {
            setTimeout(() => { suppressModalPopState = false }, 0)
          }, { once: true, capture: true })
          window.history.back()
        }
      }, 0)
    }
  }, [isOpen])

  useDialog({
    isOpen,
    onClose,
    ref: panelRef,
    initialFocusRef,
    isActive: () => openModalIds.at(-1) === activeModalIdRef.current,
  })

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

  // Non-passive touch listener: the reliable half of the gesture. A sheet that
  // scrolls carries `touch-action: pan-y`, so the browser would otherwise claim
  // a downward swipe as a scroll (firing pointercancel) and the drag never
  // engaged over the content -- which is exactly why scrollable modals like the
  // ledger filter felt impossible to swipe away. Here we watch the raw touch
  // stream and, the instant we recognise a downward dismiss from the top,
  // preventDefault() so the browser lets go and framer's drag (started in
  // handlePanelPointerMove) can take over. Native scrolling is untouched: we
  // never preventDefault a scroll or a horizontal gesture.
  useEffect(() => {
    const el = panelRef.current
    if (!isOpen || !el) return
    let sx = 0
    let sy = 0
    let decided: 'none' | 'scroll' | 'drag' = 'none'
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) { decided = 'scroll'; return }
      sx = e.touches[0].clientX
      sy = e.touches[0].clientY
      decided = 'none'
    }
    const onMove = (e: TouchEvent) => {
      if (decided === 'scroll' || e.touches.length !== 1) return
      const t = e.touches[0]
      const dx = t.clientX - sx
      const dy = t.clientY - sy
      if (decided === 'none') {
        if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return
        if (Math.abs(dx) > Math.abs(dy)) { decided = 'scroll'; return }
        decided = dy > 0 && scrollableAtTop(t.target as HTMLElement, el) ? 'drag' : 'scroll'
      }
      if (decided === 'drag' && e.cancelable) e.preventDefault()
    }
    const reset = () => { decided = 'none' }
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', reset)
    el.addEventListener('touchcancel', reset)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', reset)
      el.removeEventListener('touchcancel', reset)
    }
  }, [isOpen])

  // When mobile virtual keyboards open, ensure the focused input is scrolled into view
  useEffect(() => {
    const el = panelRef.current
    if (!isOpen || !el) return
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null
      if (!target || !['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      window.setTimeout(() => {
        if (!target.isConnected) return
        if (typeof target.scrollIntoView !== 'function') return
        target.scrollIntoView({ block: 'nearest', behavior: motionSafeScrollBehavior() })
      }, 120)
    }
    el.addEventListener('focusin', handleFocusIn)
    return () => el.removeEventListener('focusin', handleFocusIn)
  }, [isOpen])

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <m.div
          key="backdrop"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduceMotion ? undefined : { opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.2 }}
          onMouseDown={(e: React.MouseEvent) => {
            backdropMouseDownRef.current = e.target === e.currentTarget
          }}
          onClick={(e: React.MouseEvent) => {
            if (e.target === e.currentTarget && backdropMouseDownRef.current) {
              onClose()
            }
            backdropMouseDownRef.current = false
          }}
          className={`sheet-backdrop fixed inset-0 ${layerClassName} flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm ${backdropClassName}`}
        >
          {/* Entrance/exit slide lives on this OUTER wrapper, deliberately kept
              separate from the drag below. framer's drag gesture takes ownership
              of the element's `y` transform, which was stepping on the entrance
              `y` keyframes and making a tall sheet appear to fade in rather than
              slide. Two elements => two independent `y` transforms => the slide
              always plays. The entrance is a plain framer initial -> animate:
              `initial` starts the sheet below the viewport and it animates to
              rest at a height-paced duration, deterministically, on every open. */}
          <m.div
            key="sheet-enter"
            initial={reduceMotion ? false : isMobile ? { y: "100%" } : { y: "100%", scale: 0.95, opacity: 0 }}
            animate={isMobile ? { y: 0 } : { y: 0, scale: 1, opacity: 1 }}
            exit={reduceMotion ? undefined : isMobile ? { y: "100%" } : { y: "100%", scale: 0.95, opacity: 0 }}
            transition={{ type: "tween", ease: [0.22, 1, 0.36, 1], duration: reduceMotion ? 0 : slideDuration }}
            className={`sheet-enter w-full ${maxWidthClassName}`}
          >
          <m.div
            key="sheet"
            ref={panelRef}
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
            aria-labelledby={ariaLabel ? undefined : titleId}
            aria-label={ariaLabel}
            aria-describedby={ariaDescribedBy ?? (description ? descriptionId : undefined)}
            tabIndex={-1}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            // pan-y lets inner content scroll natively; the non-passive
            // touchmove listener above preventDefaults only the dismiss gesture,
            // so the drag still engages reliably over scrollable content.
            className={`touch-pan-y sheet-panel no-scrollbar w-full bg-card border border-border/80 rounded-2xl shadow-2xl p-4 sm:p-6 flex flex-col gap-4 max-h-[90vh] overflow-x-hidden overflow-y-auto focus:outline-none ${panelClassName}`}
          >
            <div
              className="touch-none pb-3 shrink-0"
            >
              {isMobile && <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full mx-auto mb-2 shrink-0" />}
              <div className="flex min-h-9 items-center justify-between gap-3 border-b border-border/40 pb-3">
                <div className="min-w-0">
                  <h2 id={titleId} className="text-base font-bold text-foreground">{title}</h2>
                  {description && (
                    <div id={descriptionId} className="mt-1 text-xs font-normal leading-relaxed text-muted-foreground">
                      {description}
                    </div>
                  )}
                </div>
                {headerActions && <div className="flex shrink-0 items-center gap-1.5">{headerActions}</div>}
              </div>
            </div>
            {children}
            {footer && <div className="border-t border-border/40 pt-4">{footer}</div>}
          </m.div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
