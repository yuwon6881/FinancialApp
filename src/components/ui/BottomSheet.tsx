import React, { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useDialog } from '../../lib/useDialog'

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
  const handleRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // Lock body scroll and handle popstate
  useEffect(() => {
    if (!isOpen) return

    const scrollY = window.scrollY
    const { body } = document
    const previousPosition = body.style.position
    const previousTop = body.style.top
    const previousLeft = body.style.left
    const previousRight = body.style.right
    const previousWidth = body.style.width
    const previousOverflow = body.style.overflow
    const previousPaddingRight = body.style.paddingRight
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth

    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.left = '0'
    body.style.right = '0'
    body.style.width = '100%'
    body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`
    }

    const modalId = `modal-${titleId}`
    window.history.pushState({ modalId }, '')

    const handlePopState = () => {
      onCloseRef.current()
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
      body.style.position = previousPosition
      body.style.top = previousTop
      body.style.left = previousLeft
      body.style.right = previousRight
      body.style.width = previousWidth
      body.style.overflow = previousOverflow
      body.style.paddingRight = previousPaddingRight
      window.scrollTo(0, scrollY)

      window.removeEventListener('popstate', handlePopState)
      if (window.history.state?.modalId === modalId) {
        window.history.back()
      }
    }
  }, [isOpen, titleId])

  useDialog({ isOpen, onClose, ref: panelRef })

  // Native non-passive touch drag-to-dismiss gesture handling
  useEffect(() => {
    if (!isOpen) return
    const panel = panelRef.current
    if (!panel) return

    let startY = 0
    let currentDeltaY = 0
    let isTracking = false
    let isDragging = false

    const onStart = (clientY: number, target: HTMLElement) => {
      startY = clientY
      currentDeltaY = 0
      const isAtTop = panel.scrollTop <= 0
      const isDragArea = !!target.closest('.sheet-drag-area')

      if (isAtTop || isDragArea) {
        isTracking = true
      } else {
        isTracking = false
      }
    }

    const onMove = (clientY: number, e: Event) => {
      if (!isTracking) return
      const deltaY = clientY - startY

      if (deltaY > 0) {
        if (e.cancelable) {
          e.preventDefault()
        }
        isDragging = true
        currentDeltaY = deltaY
        panel.style.transform = `translateY(${deltaY}px)`
        panel.style.transition = 'none'
      }
    }

    const onEnd = () => {
      if (!isTracking) return
      isTracking = false

      if (isDragging) {
        if (currentDeltaY > 70) {
          onCloseRef.current()
        } else {
          panel.style.transition = 'transform 250ms cubic-bezier(0.16, 1, 0.3, 1)'
          panel.style.transform = 'translateY(0)'
        }
      }
      isDragging = false
      currentDeltaY = 0
    }

    // Touch events with passive: false to allow e.preventDefault()
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        onStart(e.touches[0].clientY, e.target as HTMLElement)
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        onMove(e.touches[0].clientY, e)
      }
    }

    const handleTouchEnd = () => {
      onEnd()
    }

    // Pointer/Mouse events for desktop handle bar
    const handlePointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && (e.target as HTMLElement).closest('.sheet-drag-area')) {
        onStart(e.clientY, e.target as HTMLElement)
        window.addEventListener('pointermove', handlePointerMove)
        window.addEventListener('pointerup', handlePointerUp)
      }
    }

    const handlePointerMove = (e: PointerEvent) => {
      onMove(e.clientY, e)
    }

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      onEnd()
    }

    panel.addEventListener('touchstart', handleTouchStart, { passive: true })
    panel.addEventListener('touchmove', handleTouchMove, { passive: false })
    panel.addEventListener('touchend', handleTouchEnd, { passive: true })
    panel.addEventListener('touchcancel', handleTouchEnd, { passive: true })
    panel.addEventListener('pointerdown', handlePointerDown)

    return () => {
      panel.removeEventListener('touchstart', handleTouchStart)
      panel.removeEventListener('touchmove', handleTouchMove)
      panel.removeEventListener('touchend', handleTouchEnd)
      panel.removeEventListener('touchcancel', handleTouchEnd)
      panel.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [isOpen])

  const backdropMouseDownRef = useRef(false)

  if (!isOpen) return null

  return createPortal(
    <div
      onMouseDown={e => {
        backdropMouseDownRef.current = e.target === e.currentTarget
      }}
      onClick={e => {
        if (e.target === e.currentTarget && backdropMouseDownRef.current) {
          onClose()
        }
        backdropMouseDownRef.current = false
      }}
      style={{ overscrollBehaviorY: 'contain' }}
      className="sheet-backdrop fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-label={ariaLabel}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        style={{
          overscrollBehaviorY: 'contain',
          touchAction: 'pan-y'
        }}
        className={`sheet-panel w-full ${maxWidthClassName} bg-card border border-border/80 rounded-2xl shadow-2xl p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto focus:outline-none select-none`}
      >
        {/* Touch / Mouse Drag Pill Handle */}
        <div 
          ref={handleRef}
          style={{ touchAction: 'none' }}
          className="sheet-drag-area w-full py-2.5 -mt-3 -mb-1 flex justify-center cursor-grab active:cursor-grabbing"
        >
          <div className="w-14 h-1.5 rounded-full bg-muted-foreground/40 hover:bg-muted-foreground/60 transition" />
        </div>

        <div 
          style={{ touchAction: 'none' }}
          className="sheet-drag-area flex items-center justify-between border-b border-border/40 pb-3"
        >
          <div id={titleId} className="min-w-0 text-base font-bold text-foreground">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition cursor-pointer"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>
        {children}
        {footer && <div className="border-t border-border/40 pt-4">{footer}</div>}
      </div>
    </div>,
    document.body
  )
}
