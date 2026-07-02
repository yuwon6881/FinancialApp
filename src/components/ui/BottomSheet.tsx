import React, { useEffect, useId } from 'react'
import { X } from 'lucide-react'
import { useDialog } from '../../lib/useDialog'
import { useSheetDrag } from '../../lib/useSheetDrag'

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
  const { handlers, style } = useSheetDrag(onClose)

  useEffect(() => {
    if (!isOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [isOpen])

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
        {...handlers}
        style={style}
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
