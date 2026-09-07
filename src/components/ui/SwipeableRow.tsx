import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { animate, m, useMotionValue, useReducedMotion, type PanInfo } from 'framer-motion'
import { cn } from '../../lib/utils'
import { useIsCompact } from '../../lib/breakpoints'
import { triggerHaptic } from '../../lib/haptics'
import {
  clearSwipeRowCloser,
  closeOpenSwipeableRow,
  registerSwipeRowCloser,
  setSwipeLocked,
} from '../../lib/swipeLock'
import { resolveSwipeTarget } from './swipeableRowMath'

interface SwipeableRowProps {
  children: React.ReactNode
  actions: React.ReactNode
  desktopActions?: React.ReactNode
  actionsWidth?: number
  className?: string
  contentClassName?: string
  disabled?: boolean
  hint?: boolean
  id?: string
}

export const SwipeableRow: React.FC<SwipeableRowProps> = ({
  children,
  actions,
  desktopActions,
  actionsWidth = 132,
  className,
  contentClassName,
  disabled = false,
  id,
}) => {
  const isMobile = useIsCompact()
  const reduceMotion = useReducedMotion()
  const [open, setOpen] = useState(false)
  const [isRevealed, setIsRevealed] = useState(false)
  const x = useMotionValue(0)
  const settleAnimationRef = useRef<{ stop: () => void } | null>(null)
  const suppressNextClick = useRef(false)
  const actionDrawerRef = useRef<HTMLDivElement>(null)
  const focusActionsOnOpenRef = useRef(false)
  const generatedActionsId = useId().replace(/:/g, '')
  const actionsId = id ? `${id}-actions` : `swipe-row-actions-${generatedActionsId}`

  const transition = useMemo(
    () => (reduceMotion
      ? { duration: 0 }
      : { type: 'spring' as const, stiffness: 500, damping: 40, mass: 1 }),
    [reduceMotion],
  )

  const stopSettle = useCallback(() => {
    settleAnimationRef.current?.stop()
    settleAnimationRef.current = null
    x.stop()
  }, [x])

  const settle = useCallback((target: number) => {
    stopSettle()
    if (target !== 0) {
      setIsRevealed(true)
    }
    settleAnimationRef.current = animate(x, target, {
      ...transition,
      onComplete: () => {
        if (target === 0) {
          setIsRevealed(false)
        }
      },
    })
  }, [stopSettle, transition, x])

  const close = useCallback(() => {
    setOpen(false)
    settle(0)
    if (x.get() === 0) {
      setIsRevealed(false)
    }
  }, [settle, x])

  const openActions = useCallback((focusActions: boolean) => {
    if (disabled) return
    focusActionsOnOpenRef.current = focusActions
    if (!open) triggerHaptic(10)
    setIsRevealed(true)
    setOpen(true)
    settle(-actionsWidth)
  }, [actionsWidth, disabled, open, settle])

  useEffect(() => {
    if (!open || !focusActionsOnOpenRef.current) return
    focusActionsOnOpenRef.current = false
    const firstAction = actionDrawerRef.current?.querySelector<HTMLElement>(
      'button:not([disabled]), a[href], [role="button"]:not([aria-disabled="true"]), [tabindex]:not([tabindex="-1"])',
    )
    firstAction?.focus({ preventScroll: true })
  }, [open])

  useEffect(() => {
    if (!open) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      close()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [close, open])

  const closeForAction = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null
    if (!target?.closest?.('button, a, [role="button"], [data-swipe-action]')) return
    close()

  }, [close])

  // Mobile browsers hold back the synthesized `click` event for a defensive
  // cooldown after any drag gesture on the page, so tapping an action button
  // right after swiping can take an extra tap before the native click fires.
  // Pointer events aren't subject to that delay, so drive the tap ourselves.
  const actionTapStart = useRef<{ x: number; y: number; target: HTMLElement | null } | null>(null)

  const handleActionPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'touch') return
    const target = (e.target as HTMLElement).closest('button, a, [role="button"], [data-swipe-action]') as HTMLElement | null
    actionTapStart.current = { x: e.clientX, y: e.clientY, target }
  }, [])

  const handleActionPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const start = actionTapStart.current
    if (!start || e.pointerType !== 'touch') return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y

    // If dragging right horizontally, dynamically pull the card closed
    if (dx > 5 && dx > Math.abs(dy)) {
      stopSettle()
      x.set(Math.min(0, -actionsWidth + dx))
    }
  }, [actionsWidth, stopSettle, x])

  const handleActionPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const start = actionTapStart.current
    actionTapStart.current = null
    if (!start || e.pointerType !== 'touch') return

    const dx = e.clientX - start.x
    const dy = e.clientY - start.y

    // If user swiped right by more than 25px, close the row
    if (dx > 25 && dx > Math.abs(dy)) {
      close()
      return
    }

    // If user started swiping right but released early, bounce back to open
    if (dx > 5 && dx > Math.abs(dy)) {
      settle(-actionsWidth)
      return
    }

    // Clean tap on an action button
    if (Math.hypot(dx, dy) <= 10 && start.target) {
      start.target.click()
    }
  }, [actionsWidth, close, settle])

  const handleActionPointerCancel = useCallback(() => {
    if (actionTapStart.current) {
      actionTapStart.current = null
      settle(-actionsWidth)
    }
  }, [actionsWidth, settle])

  // Keep only one row open at a time across the whole app.
  useEffect(() => {
    if (open) {
      closeOpenSwipeableRow()
      registerSwipeRowCloser(close)
    } else {
      clearSwipeRowCloser(close)
    }
    return () => {
      clearSwipeRowCloser(close)
    }
  }, [open, close])

  // Collapse if the row becomes disabled or we leave mobile.
  useEffect(() => {
    if ((disabled || !isMobile) && open) close()
  }, [disabled, isMobile, open, close])

  useEffect(() => () => {
    setSwipeLocked(false)
    stopSettle()
  }, [stopSettle])

  const handleDragStart = () => {
    stopSettle()
    setIsRevealed(true)
    setSwipeLocked(true)
  }

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    setSwipeLocked(false)

    // A real drag can make the browser dispatch a trailing synthetic click on
    // this element once the gesture ends; swallow just that one click, not
    // any tap that happens to land while the settle animation is still running.
    if (Math.hypot(info.offset.x, info.offset.y) > 5) {
      suppressNextClick.current = true
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          suppressNextClick.current = false
        })
      })
    }

    const target = resolveSwipeTarget({
      currentX: x.get(),
      actionsWidth,
      velocityX: info.velocity.x,
    })
    if (target < 0) {
      openActions(false)
    } else {
      close()
    }
  }

  const handleDragCancel = useCallback(() => {
    setSwipeLocked(false)
    close()
  }, [close])

  // Desktop: keep actions inline at the trailing edge.
  if (!isMobile) {
    return (
      <div id={id} className={cn('bg-card', className)}>
        <div className={cn('flex items-center gap-3', contentClassName)}>
          <div className="min-w-0 flex-1">{children}</div>
          {/* `empty:hidden` so a row that renders its own inline actions and passes
              `desktopActions={false}` does not still pay this slot's gap as dead trailing space. */}
          <div className="shrink-0 flex items-center gap-1.5 empty:hidden">{desktopActions ?? actions}</div>
        </div>
      </div>
    )
  }

  return (
    <div id={id} className="relative isolate w-full overflow-hidden rounded-2xl bg-card">
      {/* Action drawer sitting behind the content */}
      <div
        ref={actionDrawerRef}
        id={actionsId}
        role="group"
        aria-label="Row actions"
        // A tray of tiles, not one slab of colour. The drawer used to butt three full-bleed
        // rectangles against each other and against the card's own rounded edge, so a revealed row
        // showed square corners inside a rounded list and no seam between the actions. The padding
        // lets the card colour frame the tiles, the gap separates them, and `[&>*]` rounds whatever
        // a call site passes so no caller has to know it is sitting in a drawer.
        className="absolute inset-y-0 right-0 z-0 flex items-stretch gap-1.5 overflow-hidden rounded-r-2xl p-1.5 [&>*]:rounded-xl [&>*]:shadow-xs [&_button]:min-w-[44px] [&_button]:min-h-[44px] [&_a]:min-w-[44px] [&_a]:min-h-[44px]"
        style={{
          width: actionsWidth,
          touchAction: 'pan-y',
          opacity: isRevealed || open ? 1 : 0,
          pointerEvents: isRevealed || open ? 'auto' : 'none',
        }}
        inert={!open}
        onClickCapture={closeForAction}
        onPointerDown={handleActionPointerDown}
        onPointerMove={handleActionPointerMove}
        onPointerUp={handleActionPointerUp}
        onPointerCancel={handleActionPointerCancel}
      >
        {actions}
      </div>

      {/* The card surface moves as one piece. The outer element is only the stationary
          clipping viewport for the drawer, so the card border, shadow and contents
          cannot visibly separate during the drag or its settle bounce. This must stay
          opaque: it is what hides the drawer while the row is closed. */}
      <m.div
        data-swipe-content
        className={cn('relative z-10 isolate w-full overflow-hidden', className, contentClassName, 'bg-card')}
        drag={disabled ? false : 'x'}
        dragConstraints={{ left: -actionsWidth, right: 0 }}
        dragElastic={0}
        // The explicit open/close spring is the only settle animation. Letting
        // Framer's default momentum continue after release can race that spring
        // on medium-width mouse layouts and strand the card between positions.
        dragMomentum={false}
        dragDirectionLock
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onPointerCancel={handleDragCancel}
        style={{ touchAction: 'pan-y', willChange: 'transform', x, backgroundColor: 'var(--card)' }}
        onClick={() => {
          if (suppressNextClick.current) return
          if (open) close()
        }}
      >
        {children}
      </m.div>
    </div>
  )
}
