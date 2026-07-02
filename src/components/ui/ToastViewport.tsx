import React, { useEffect } from 'react'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'

export type ToastTone = 'info' | 'success' | 'warning' | 'error'

export interface ToastMessage {
  id: string
  title?: string
  message: string
  tone?: ToastTone
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
  info: <Info className="size-4 text-blue-500" />,
  success: <CheckCircle2 className="size-4 text-emerald-500" />,
  warning: <AlertCircle className="size-4 text-amber-500" />,
  error: <AlertCircle className="size-4 text-orange-500" />,
}

export const ToastViewport: React.FC<ToastViewportProps> = ({ toasts, onDismiss }) => {
  useEffect(() => {
    if (toasts.length === 0) return
    const timers = toasts.map(toast => window.setTimeout(() => onDismiss(toast.id), 4200))
    return () => timers.forEach(window.clearTimeout)
  }, [toasts, onDismiss])

  if (toasts.length === 0) return null

  return (
    <div className="fixed left-3 right-3 top-[calc(4.75rem+env(safe-area-inset-top,0px))] z-[120] flex flex-col gap-2 pointer-events-none sm:left-auto sm:right-4 sm:w-80">
      {toasts.map(toast => {
        const tone = toast.tone || 'info'
        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-3 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200 ${toneClass[tone]}`}
          >
            <div className="mt-0.5 shrink-0">{toneIcon[tone]}</div>
            <div className="min-w-0 flex-1">
              {toast.title && <div className="text-xs font-bold text-foreground">{toast.title}</div>}
              <div className="text-[11px] leading-relaxed text-muted-foreground">{toast.message}</div>
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
              aria-label="Dismiss notification"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
