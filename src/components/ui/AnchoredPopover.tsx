import React, { forwardRef, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type PopoverAlign = 'left' | 'right'
type PopoverSide = 'auto' | 'top' | 'bottom'

interface Position {
  top: number
  left: number
  maxHeight: number
  anchorWidth: number
  side: 'top' | 'bottom'
}

interface AnchoredPopoverProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  open: boolean
  anchorRef: React.RefObject<HTMLElement | null>
  children: React.ReactNode
  align?: PopoverAlign
  side?: PopoverSide
  gap?: number
  matchAnchorWidth?: boolean
  minWidth?: number
  viewportPadding?: number
}

/**
 * A viewport-aware floating layer.
 *
 * The layer is portalled to document.body so modal/card overflow cannot clip it.
 * It follows its anchor while any ancestor scrolls, flips toward the roomier side,
 * and constrains its own height to the visible viewport.
 */
export const AnchoredPopover = forwardRef<HTMLDivElement, AnchoredPopoverProps>(({
  open,
  anchorRef,
  children,
  align = 'left',
  side = 'auto',
  gap = 6,
  matchAnchorWidth = false,
  minWidth = 0,
  viewportPadding = 8,
  className = '',
  style,
  ...props
}, forwardedRef) => {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const [position, setPosition] = useState<Position | null>(null)

  const setPanelRef = useCallback((node: HTMLDivElement | null) => {
    panelRef.current = node
    if (typeof forwardedRef === 'function') forwardedRef(node)
    else if (forwardedRef) forwardedRef.current = node
  }, [forwardedRef])

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current
    const panel = panelRef.current
    if (!anchor || !panel) return

    const anchorRect = anchor.getBoundingClientRect()
    const panelRect = panel.getBoundingClientRect()
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth
    const viewportHeight = window.visualViewport?.height || window.innerHeight
    const maxPanelWidth = Math.max(0, viewportWidth - viewportPadding * 2)
    const measuredWidth = panel.scrollWidth || panelRect.width || anchorRect.width
    const panelWidth = Math.min(
      Math.max(matchAnchorWidth ? anchorRect.width : measuredWidth, minWidth),
      maxPanelWidth,
    )

    const roomAbove = Math.max(0, anchorRect.top - gap - viewportPadding)
    const roomBelow = Math.max(0, viewportHeight - anchorRect.bottom - gap - viewportPadding)
    const measuredHeight = panel.scrollHeight || panelRect.height

    let openAbove: boolean
    if (side === 'top') openAbove = measuredHeight <= roomAbove || roomAbove >= roomBelow
    else if (side === 'bottom') openAbove = measuredHeight > roomBelow && roomAbove > roomBelow
    else openAbove = measuredHeight > roomBelow && roomAbove > roomBelow

    const availableHeight = Math.max(48, openAbove ? roomAbove : roomBelow)
    const visibleHeight = Math.min(measuredHeight || availableHeight, availableHeight)
    const top = openAbove
      ? Math.max(viewportPadding, anchorRect.top - gap - visibleHeight)
      : Math.min(anchorRect.bottom + gap, viewportHeight - viewportPadding - visibleHeight)

    const preferredLeft = align === 'right'
      ? anchorRect.right - panelWidth
      : anchorRect.left
    const left = Math.min(
      Math.max(preferredLeft, viewportPadding),
      Math.max(viewportPadding, viewportWidth - viewportPadding - panelWidth),
    )

    setPosition({
      top,
      left,
      maxHeight: availableHeight,
      anchorWidth: Math.min(Math.max(anchorRect.width, minWidth), maxPanelWidth),
      side: openAbove ? 'top' : 'bottom',
    })
  }, [align, anchorRef, gap, matchAnchorWidth, minWidth, side, viewportPadding])

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null)
      return
    }
    updatePosition()
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return

    const handleViewportChange = () => updatePosition()
    window.addEventListener('scroll', handleViewportChange, true)
    window.addEventListener('resize', handleViewportChange)
    window.visualViewport?.addEventListener('resize', handleViewportChange)
    window.visualViewport?.addEventListener('scroll', handleViewportChange)

    const observer = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(handleViewportChange)
    if (anchorRef.current) observer?.observe(anchorRef.current)
    if (panelRef.current) observer?.observe(panelRef.current)

    return () => {
      window.removeEventListener('scroll', handleViewportChange, true)
      window.removeEventListener('resize', handleViewportChange)
      window.visualViewport?.removeEventListener('resize', handleViewportChange)
      window.visualViewport?.removeEventListener('scroll', handleViewportChange)
      observer?.disconnect()
    }
  }, [anchorRef, open, updatePosition])

  if (!open) return null

  return createPortal(
    <div
      {...props}
      ref={setPanelRef}
      data-floating-overlay=""
      data-side={position?.side}
      className={className}
      style={{
        ...style,
        position: 'fixed',
        top: position?.top ?? 0,
        left: position?.left ?? 0,
        width: matchAnchorWidth && position ? position.anchorWidth : style?.width,
        maxWidth: `calc(100vw - ${viewportPadding * 2}px)`,
        maxHeight: position?.maxHeight,
        visibility: position ? 'visible' : 'hidden',
      }}
    >
      {children}
    </div>,
    document.body,
  )
})

AnchoredPopover.displayName = 'AnchoredPopover'
