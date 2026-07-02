import React, { useEffect, useId, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useDialog } from '../../lib/useDialog'
import { triggerHaptic } from '../../lib/haptics'

interface BottomSheetProps {
  isOpen: boolean
  title: React.ReactNode
  children: React.ReactNode
  onClose: () => void
  maxWidthClassName?: string
  footer?: React.ReactNode
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  title,
  children,
  onClose,
  maxWidthClassName = 'max-w-md',
  footer
}) => {
  const panelRef = useDialog<HTMLDivElement>(isOpen, onClose)
  const titleId = useId()

  // Mobile drag-to-dismiss: dragging the sheet down past a threshold closes it.
  const [dragY, setDragY] = useState(0)
  const dragState = useRef<{ startY: number; active: boolean }>({ startY: 0, active: false })

  useEffect(() => {
    if (!isOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [isOpen])

  // Reset any residual drag offset each time the sheet opens.
  useEffect(() => {
    if (isOpen) setDragY(0)
  }, [isOpen])

  const onTouchStart = (e: React.TouchEvent) => {
    // Only start a dismiss-drag from the top of the sheet's scroll area, so
    // it never fights normal content scrolling.
    if ((panelRef.current?.scrollTop ?? 0) > 0) return
    dragState.current = { startY: e.touches[0].clientY, active: true }
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragState.current.active) return
    const delta = e.touches[0].clientY - dragState.current.startY
    // Only track downward drags; ignore upward pulls.
    setDragY(delta > 0 ? delta : 0)
  }

  const onTouchEnd = () => {
    if (!dragState.current.active) return
    dragState.current.active = false
    if (dragY > 120) {
      triggerHaptic(12)
      onClose()
    } else {
      setDragY(0)
    }
  }

  if (!isOpen) return null

  return (
    <div
      onClick={onClose}
      className="sheet-backdrop fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={dragY > 0 ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}
        className={`sheet-panel w-full ${maxWidthClassName} bg-card border border-border/80 rounded-2xl shadow-2xl p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto outline-none`}
      >
        <div className="flex items-center justify-between border-b border-border/40 pb-3">
          <div id={titleId} className="min-w-0 text-md font-bold text-foreground">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="press-scale p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition cursor-pointer"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>
        {children}
        {footer && <div className="border-t border-border/40 pt-4">{footer}</div>}
      </div>
    </div>
  )
}
