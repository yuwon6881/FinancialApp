import React, { useEffect, useId, useRef, useState } from 'react'
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
  const titleId = useId()

  const [dragOffsetY, setDragOffsetY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const touchStartYRef = useRef(0)
  const isHeaderTouchRef = useRef(false)

  useEffect(() => {
    if (!isOpen) {
      setDragOffsetY(0)
      setIsDragging(false)
      return
    }

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

    return () => {
      body.style.position = previousPosition
      body.style.top = previousTop
      body.style.left = previousLeft
      body.style.right = previousRight
      body.style.width = previousWidth
      body.style.overflow = previousOverflow
      body.style.paddingRight = previousPaddingRight
      window.scrollTo(0, scrollY)
    }
  }, [isOpen])

  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!isOpen) return

    const modalId = `modal-${titleId}`
    window.history.pushState({ modalId }, '')

    const handlePopState = () => {
      onCloseRef.current()
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
      if (window.history.state?.modalId === modalId) {
        window.history.back()
      }
    }
  }, [isOpen])

  useDialog({ isOpen, onClose, ref: panelRef })

  const backdropMouseDownRef = useRef(false)

  if (!isOpen) return null

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    touchStartYRef.current = touch.clientY

    const target = e.target as HTMLElement
    const isAtTop = panelRef.current ? panelRef.current.scrollTop <= 0 : true
    const isHeader = !!target.closest('.sheet-drag-area')

    if (isAtTop || isHeader) {
      isHeaderTouchRef.current = true
    } else {
      isHeaderTouchRef.current = false
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isHeaderTouchRef.current) return
    const touch = e.touches[0]
    const deltaY = touch.clientY - touchStartYRef.current

    if (deltaY > 0) {
      if (e.cancelable) {
        e.preventDefault()
      }
      setIsDragging(true)
      setDragOffsetY(deltaY)
    }
  }

  const handleTouchEnd = () => {
    if (!isHeaderTouchRef.current && !isDragging) return

    if (dragOffsetY > 65) {
      onClose()
    } else {
      setDragOffsetY(0)
    }
    setIsDragging(false)
    isHeaderTouchRef.current = false
  }

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
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: dragOffsetY > 0 ? `translateY(${dragOffsetY}px)` : undefined,
          transition: isDragging ? 'none' : 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1)',
          overscrollBehaviorY: 'contain',
          touchAction: 'pan-y'
        }}
        className={`sheet-panel w-full ${maxWidthClassName} bg-card border border-border/80 rounded-2xl shadow-2xl p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto focus:outline-none select-none`}
      >
        {/* Touch Drag Pill Handle */}
        <div 
          style={{ touchAction: 'none' }}
          className="sheet-drag-area w-full py-2 -mt-3 -mb-1 flex justify-center cursor-grab active:cursor-grabbing"
        >
          <div className="w-12 h-1.5 rounded-full bg-muted-foreground/40 hover:bg-muted-foreground/60 transition" />
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
