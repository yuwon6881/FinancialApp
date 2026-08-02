import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './Button'
import { AlertCircle, CheckCircle2, Info, Undo2, X } from 'lucide-react'
import { m, AnimatePresence } from 'framer-motion'
import { Z_LAYERS } from '../../lib/zLayers'

export type ToastTone = 'info' | 'success' | 'warning' | 'error'

export interface ToastAction {
  label: string
  onAction: () => void
}

export interface ToastMessage {
  id: string
  title?: string
  message: string
  tone?: ToastTone
  // Optional inline action (e.g. "Undo"). Toasts carrying an action linger
  // longer so there is comfortable time to click it before auto-dismiss.
  action?: ToastAction
}

interface ToastViewportProps {
  toasts: ToastMessage[]
  onDismiss: (id: string) => void
}

const toneClass: Record<ToastTone, string> = {
  info: 'border-blue-500/25 bg-card text-foreground',
  success: 'border-emerald-500/25 bg-card text-foreground',
  warning: 'border-amber-500/30 bg-card text-foreground',
  error: 'border-orange-500/30 bg-card text-foreground',
}

const toneIcon: Record<ToastTone, React.ReactNode> = {
  info: <Info className="size-5 text-blue-500" />,
  success: <CheckCircle2 className="size-5 text-emerald-500" />,
  warning: <AlertCircle className="size-5 text-amber-500" />,
  error: <AlertCircle className="size-5 text-orange-500" />,
}

// Confirmations can be brief; warnings and errors stay long enough to read.
const toneDuration: Record<ToastTone, number> = {
  success: 3500,
  info: 4000,
  warning: 6000,
  error: 6000,
}

// Toasts with an action need extra dwell time so the user can react to them.
const ACTION_DURATION = 7000

const durationFor = (toast: ToastMessage): number => {
  const base = toneDuration[toast.tone || 'info']
  return toast.action ? Math.max(base, ACTION_DURATION) : base
}

export const ToastViewport: React.FC<ToastViewportProps> = ({ toasts, onDismiss }) => {
  useEffect(() => {
    if (toasts.length === 0) return
    const timers = toasts.map(toast =>
      window.setTimeout(() => onDismiss(toast.id), durationFor(toast))
    )
    return () => timers.forEach(window.clearTimeout)
  }, [toasts, onDismiss])

  const viewport = (
    <div
      role="region"
      aria-label="Notifications"
      aria-live="polite"
      aria-atomic="false"
      // This host deliberately lives at document.body level. The app shell is
      // an isolated stacking context, while BottomSheet and other overlays are
      // body-level portals; keeping notifications inside the shell lets a
      // modal backdrop paint over them regardless of the local z-index.
      // Z_LAYERS.toast is above the normal sheet/popover stack; see lib/zLayers.
      className={`fixed left-3 right-3 top-[calc(4.75rem+env(safe-area-inset-top,0px))] ${Z_LAYERS.toast} flex flex-col gap-2 pointer-events-none sm:left-auto sm:right-4 sm:w-96`}
    >
      <AnimatePresence mode="popLayout">
        {toasts.map(toast => {
          const tone = toast.tone || 'info'
          return (
            <m.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              drag
              dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
              dragElastic={0.8}
              onDragEnd={(_e, info) => {
                if (info.offset.y < -50 || info.velocity.y < -500) {
                  // Swipe up: dismiss all
                  toasts.forEach(t => onDismiss(t.id))
                } else if (Math.abs(info.offset.x) > 50 || Math.abs(info.velocity.x) > 500) {
                  // Swipe left/right: dismiss single
                  onDismiss(toast.id)
                }
              }}
              role={tone === 'error' || tone === 'warning' ? 'alert' : 'status'}
              // No backdrop-blur: every tone above is an opaque `bg-card`, so the filter
              // had nothing translucent to blur while still forcing a backdrop-filter
              // layer per toast — and toasts are dragged, so that layer was recomposited
              // on every pointer move.
              className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-4 shadow-xl cursor-grab active:cursor-grabbing ${toneClass[tone]}`}
            >
              <div className="mt-0.5 shrink-0">{toneIcon[tone]}</div>
              <div className="min-w-0 flex-1 pointer-events-none">
                {toast.title && <div className="text-sm font-bold text-foreground">{toast.title}</div>}
                <div className="text-[13px] leading-relaxed text-muted-foreground">{toast.message}</div>
                {toast.action && (
                  <Button variant="unstyled"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation() // prevent drag interfering
                      toast.action?.onAction()
                      onDismiss(toast.id)
                    }}
                    className="pointer-events-auto mt-2 inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/60 px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted transition cursor-pointer"
                  >
                    <Undo2 className="size-3.5" />
                    {toast.action.label}
                  </Button>
                )}
              </div>
              <Button variant="unstyled"
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onDismiss(toast.id)
                }}
                className="hidden sm:block shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
                aria-label="Dismiss notification"
              >
                <X className="size-4" />
              </Button>
            </m.div>
          )
        })}
      </AnimatePresence>
    </div>
  )

  return typeof document === 'undefined' ? null : createPortal(viewport, document.body)
}
