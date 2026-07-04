import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronsLeft } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useIsMobile } from '../../lib/useIsMobile'
import { triggerHaptic } from '../../lib/haptics'
import { setSwipeLocked } from '../../lib/swipeLock'

// Module-level registry so only a single row is ever open at a time.
let closeActiveRow: (() => void) | null = null

interface SwipeableRowProps {
  /** Main record content (the part that slides). */
  children: React.ReactNode
  /** Action buttons revealed by swiping (styled for the full-height drawer). */
  actions: React.ReactNode
  /** Actions rendered inline on desktop / when disabled. Falls back to `actions` if omitted. */
  desktopActions?: React.ReactNode
  /** Total px width of the action drawer revealed on swipe. */
  actionsWidth?: number
  /** Classes for the outer card container (border, rounded, shadow). */
  className?: string
  /** Classes applied to the sliding content surface (padding / inner layout). */
  contentClassName?: string
  /** When true, swipe is disabled and actions are shown inline (e.g. row is syncing/editing). */
  disabled?: boolean
  /** Show the animated swipe affordance (default true). Set false on all but the first row of a list. */
  hint?: boolean
  id?: string
}

/**
 * Swipe-to-reveal row for the mobile PWA.
 *
 * On touch/mobile viewports the action buttons are hidden behind the record and
 * only revealed when the user swipes left. On desktop (>= md) the actions are
 * rendered inline at the trailing edge, preserving the original layout.
 */
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
  const [dragOffset, setDragOffset] = useState<number | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const drag = useRef({ startX: 0, startY: 0, dir: null as null | 'h' | 'v', active: false, baseOpen: false })

  const close = useCallback(() => setOpen(false), [])

  const closeForAction = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null
    if (!target?.closest?.('button, a, [role="button"], [data-swipe-action]')) return
    setOpen(false)
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
    if ((disabled || !isMobile) && open) setOpen(false)
  }, [disabled, isMobile, open])

  useEffect(() => {
    const el = contentRef.current
    if (!el || !isMobile || disabled) return

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      const t = e.touches[0]
      drag.current = { startX: t.clientX, startY: t.clientY, dir: null, active: true, baseOpen: open }
    }

    const onMove = (e: TouchEvent) => {
      const s = drag.current
      if (!s.active) return
      const t = e.touches[0]
      const dx = t.clientX - s.startX
      const dy = t.clientY - s.startY

      if (!s.dir) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return
        s.dir = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
        // Vertical gesture -> let the page scroll, bail out of this drag.
        if (s.dir === 'v') {
          s.active = false
          return
        }
        // Horizontal gesture claimed -> tell PullToRefresh to ignore any
        // vertical drift for the rest of this touch.
        setSwipeLocked(true)
      }
      if (s.dir !== 'h') return

      e.preventDefault()
      const base = s.baseOpen ? -actionsWidth : 0
      let next = base + dx
      if (next > 0) next = 0
      if (next < -actionsWidth) next = -actionsWidth
      setDragOffset(next)
    }

    const onEnd = () => {
      const s = drag.current
      setSwipeLocked(false)
      if (!s.active) {
        setDragOffset(null)
        return
      }
      s.active = false
      setDragOffset(prev => {
        if (prev === null) return null
        const shouldOpen = prev < -actionsWidth / 2
        if (shouldOpen && !open) triggerHaptic(10)
        setOpen(shouldOpen)
        return null
      })
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd, { passive: true })
    el.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [isMobile, disabled, open, actionsWidth])

  // Desktop (or disabled): keep actions inline at the trailing edge.
  if (!isMobile || disabled) {
    return (
      <div id={id} className={cn('bg-card', className)}>
        <div className={cn('flex items-center gap-3', contentClassName)}>
          <div className="min-w-0 flex-1">{children}</div>
          <div className="shrink-0 flex items-center gap-1.5">{desktopActions ?? actions}</div>
        </div>
      </div>
    )
  }

  const translate = dragOffset !== null ? dragOffset : open ? -actionsWidth : 0
  const dragging = dragOffset !== null

  return (
    <div id={id} className={cn('relative overflow-hidden', className)}>
      {/* Action drawer sitting behind the content */}
      <div
        className="absolute inset-y-0 right-0 flex items-stretch [&_button]:min-w-[44px] [&_button]:min-h-[44px] [&_a]:min-w-[44px] [&_a]:min-h-[44px]"
        style={{ width: actionsWidth }}
        aria-hidden={!open}
        onClickCapture={closeForAction}
      >
        {actions}
      </div>

      {/* Sliding content surface */}
      <div
        ref={contentRef}
        onClick={() => {
          if (open) setOpen(false)
        }}
        className={cn(
          'relative bg-card touch-pan-y',
          !dragging && 'transition-transform duration-300 ease-out',
          contentClassName,
        )}
        style={{ transform: `translateX(${translate}px)` }}
      >
        {children}

        {/* Subtle swipe affordance shown only when closed */}
        {hint && !open && !dragging && (
          <div className="pointer-events-none absolute bottom-1 right-1 text-muted-foreground/30 swipe-hint">
            <ChevronsLeft className="size-3.5" />
          </div>
        )}
      </div>
    </div>
  )
}
