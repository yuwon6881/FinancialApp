import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronsLeft } from 'lucide-react'
import { motion, useMotionValue, useAnimation, type PanInfo } from 'framer-motion'
import { cn } from '../../lib/utils'
import { useIsMobile } from '../../lib/useIsMobile'
import { triggerHaptic } from '../../lib/haptics'
import { setSwipeLocked } from '../../lib/swipeLock'

// Module-level registry so only a single row is ever open at a time.
let closeActiveRow: (() => void) | null = null

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
  const [open, setOpen] = useState(false)
  const x = useMotionValue(0)
  const controls = useAnimation()
  const suppressNextClick = useRef(false)

  const close = useCallback(() => {
    setOpen(false)
    controls.start({ x: 0, transition: { type: 'spring', stiffness: 750, damping: 42 } })
  }, [controls])

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
      if (closeActiveRow && closeActiveRow !== close) closeActiveRow()
      closeActiveRow = close
    } else if (closeActiveRow === close) {
      closeActiveRow = null
    }
    return () => {
      if (closeActiveRow === close) closeActiveRow = null
    }
  }, [open, close])

  // Collapse if the row becomes disabled or we leave mobile.
  useEffect(() => {
    if ((disabled || !isMobile) && open) close()
  }, [disabled, isMobile, open, close])

  const handleDragStart = () => {
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

    const currentX = x.get()
    const shouldOpen = currentX < -actionsWidth / 2 || info.velocity.x < -200

    if (shouldOpen) {
      if (!open) triggerHaptic(10)
      setOpen(true)
      controls.start({ x: -actionsWidth, transition: { type: 'spring', stiffness: 750, damping: 42 } })
    } else {
      setOpen(false)
      controls.start({ x: 0, transition: { type: 'spring', stiffness: 750, damping: 42 } })
    }
  }

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
    <div id={id} className={cn('relative overflow-hidden', className)}>
      {/* Action drawer sitting behind the content */}
      <div
        className="absolute inset-y-0 right-0 flex items-stretch [&_button]:min-w-[44px] [&_button]:min-h-[44px] [&_a]:min-w-[44px] [&_a]:min-h-[44px]"
        style={{ width: actionsWidth }}
        aria-hidden={!open}
        onClickCapture={closeForAction}
        onPointerDown={handleActionPointerDown}
        onPointerUp={handleActionPointerUp}
      >
        {actions}
      </div>

      {/* Sliding content surface */}
      <motion.div
        drag={disabled ? false : 'x'}
        dragConstraints={{ left: -actionsWidth, right: 0 }}
        dragElastic={0.1}
        dragDirectionLock
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        animate={controls}
        style={{ x, touchAction: 'manipulation' }}
        onClick={() => {
          if (suppressNextClick.current) return
          if (open) close()
        }}
        className={cn('relative bg-card', contentClassName)}
      >
        {children}

        {/* Subtle swipe affordance shown only when closed */}
        {hint && !open && (
          <div className="pointer-events-none absolute bottom-1 right-1 text-muted-foreground/30 swipe-hint">
            <ChevronsLeft className="size-3.5" />
          </div>
        )}
      </motion.div>
    </div>
  )
}
