import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronsLeft, ChevronsRight } from 'lucide-react'
import { animate, m, useMotionValue, type PanInfo } from 'framer-motion'
import { cn } from '../../lib/utils'
import { useIsMobile } from '../../lib/useIsMobile'
import { prefersReducedMotion } from '../../lib/motionPreference'
import { triggerHaptic } from '../../lib/haptics'
import {
  clearSwipeRowCloser,
  closeOpenSwipeableRow,
  registerSwipeRowCloser,
  setSwipeLocked,
} from '../../lib/swipeLock'
import { Button } from './Button'
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
  hint = true,
  id,
}) => {
  const isMobile = useIsMobile()
  const reduceMotion = prefersReducedMotion()
  const [open, setOpen] = useState(false)
  const x = useMotionValue(0)
  const settleAnimationRef = useRef<{ stop: () => void } | null>(null)
  const suppressNextClick = useRef(false)
  const disclosureRef = useRef<HTMLButtonElement>(null)
  const actionDrawerRef = useRef<HTMLDivElement>(null)
  const focusActionsOnOpenRef = useRef(false)
  const generatedActionsId = useId().replace(/:/g, '')
  const actionsId = id ? `${id}-actions` : `swipe-row-actions-${generatedActionsId}`

  const transition = useMemo(
    () => (reduceMotion
      ? { duration: 0 }
      : { type: 'spring' as const, stiffness: 600, damping: 50, mass: 1 }),
    [reduceMotion],
  )

  const stopSettle = useCallback(() => {
    settleAnimationRef.current?.stop()
    settleAnimationRef.current = null
    x.stop()
  }, [x])

  const settle = useCallback((target: number) => {
    stopSettle()
    if (reduceMotion) {
      x.set(target)
      return
    }
    settleAnimationRef.current = animate(x, target, transition)
  }, [reduceMotion, stopSettle, transition, x])

  const close = useCallback(() => {
    setOpen(false)
    settle(0)
  }, [settle])

  const openActions = useCallback((focusActions: boolean) => {
    if (disabled) return
    focusActionsOnOpenRef.current = focusActions
    if (!open) triggerHaptic(10)
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
      window.requestAnimationFrame(() => disclosureRef.current?.focus({ preventScroll: true }))
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
  const actionTapStart = useRef<{ x: number; y: number; target: HTMLElement } | null>(null)

  const handleActionPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'touch') return
    const target = (e.target as HTMLElement).closest('button, a, [role="button"], [data-swipe-action]') as HTMLElement | null
    if (!target) return
    e.preventDefault()
    actionTapStart.current = { x: e.clientX, y: e.clientY, target }
  }, [])

  const handleActionPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const start = actionTapStart.current
    actionTapStart.current = null
    if (!start || e.pointerType !== 'touch') return
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) return
    start.target.click()
  }, [])

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
          <div className="shrink-0 flex items-center gap-1.5">{desktopActions ?? actions}</div>
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
        className="absolute inset-y-0 right-0 z-0 flex items-stretch [&_button]:min-w-[44px] [&_button]:min-h-[44px] [&_a]:min-w-[44px] [&_a]:min-h-[44px]"
        style={{ width: actionsWidth }}
        inert={!open}
        onClickCapture={closeForAction}
        onPointerDown={handleActionPointerDown}
        onPointerUp={handleActionPointerUp}
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

        {/* The first visible hint keeps the established swipe affordance. Every row
            still exposes the same control to keyboard and assistive technology. */}
        <Button
          ref={disclosureRef}
          variant="unstyled"
          type="button"
          disabled={disabled}
          aria-expanded={open}
          aria-controls={actionsId}
          aria-label={open ? 'Hide row actions' : 'Show row actions'}
          onClick={event => {
            event.stopPropagation()
            if (open) close()
            else openActions(true)
          }}
          className={cn(
            'absolute bottom-0 right-0 z-10 inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground/45 transition-opacity focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring',
            hint || open
              ? 'opacity-100'
              : 'pointer-events-none opacity-0 focus-visible:pointer-events-auto focus-visible:opacity-100',
          )}
        >
          {open
            ? <ChevronsRight className="size-3.5" aria-hidden="true" />
            : <ChevronsLeft className={cn('size-3.5', hint && 'swipe-hint')} aria-hidden="true" />}
        </Button>
      </m.div>
    </div>
  )
}
