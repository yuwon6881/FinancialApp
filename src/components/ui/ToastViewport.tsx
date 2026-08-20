import React, { useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './Button'
import { AlertCircle, CheckCircle2, Info, Undo2, X, type LucideIcon } from 'lucide-react'
import { m, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Z_LAYERS } from '../../lib/zLayers'

export type ToastTone = 'info' | 'success' | 'warning' | 'error'

export interface ToastAction {
  label: string
  onAction: () => void
  icon?: LucideIcon
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
  const reduceMotion = useReducedMotion()
  // One timer per toast. Scheduling the whole list on every
  // change gave each existing toast a fresh full duration whenever another arrived or was
  // dismissed — and the outbox emits a batch of them 350ms apart, so during a queue drain nothing
  // aged and an Undo could sit there long after the window it belongs to. Deliberate hover/focus or
  // hiding the app pauses a toast and grants a fresh reading window when it resumes.
  const timersRef = useRef(new Map<string, number>())
  const pausedIdsRef = useRef(new Set<string>())
  const toastsRef = useRef(toasts)
  const onDismissRef = useRef(onDismiss)

  useEffect(() => {
    toastsRef.current = toasts
    onDismissRef.current = onDismiss
  }, [onDismiss, toasts])

  const startTimer = useCallback((toast: ToastMessage) => {
    if (timersRef.current.has(toast.id) || pausedIdsRef.current.has(toast.id)) return
    timersRef.current.set(
      toast.id,
      window.setTimeout(() => onDismissRef.current(toast.id), durationFor(toast)),
    )
  }, [])

  const pauseToast = useCallback((id: string) => {
    pausedIdsRef.current.add(id)
    const timer = timersRef.current.get(id)
    if (timer === undefined) return
    window.clearTimeout(timer)
    timersRef.current.delete(id)
  }, [])

  const resumeToast = useCallback((id: string) => {
    pausedIdsRef.current.delete(id)
    const toast = toastsRef.current.find(item => item.id === id)
    if (toast) startTimer(toast)
  }, [startTimer])

  useEffect(() => {
    const timers = timersRef.current
    const live = new Set(toasts.map(toast => toast.id))
    for (const [id, timer] of timers) {
      if (live.has(id)) continue
      window.clearTimeout(timer)
      timers.delete(id)
    }
    for (const id of pausedIdsRef.current) {
      if (!live.has(id)) pausedIdsRef.current.delete(id)
    }
    for (const toast of toasts) {
      startTimer(toast)
    }
  }, [startTimer, toasts])

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) toastsRef.current.forEach(toast => pauseToast(toast.id))
      else toastsRef.current.forEach(toast => resumeToast(toast.id))
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [pauseToast, resumeToast])

  useEffect(() => {
    const timers = timersRef.current
    return () => {
      timers.forEach(window.clearTimeout)
      timers.clear()
      pausedIdsRef.current.clear()
    }
  }, [])

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
              layout={!reduceMotion}
              initial={reduceMotion ? false : { opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              drag={!reduceMotion}
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
              onPointerEnter={() => pauseToast(toast.id)}
              onPointerLeave={event => {
                if (!event.currentTarget.contains(document.activeElement)) resumeToast(toast.id)
              }}
              onFocusCapture={() => pauseToast(toast.id)}
              onBlurCapture={event => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)
                  && !event.currentTarget.matches(':hover')) resumeToast(toast.id)
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
                {toast.action && (() => {
                  const ActionIcon = toast.action.icon ?? Undo2
                  return (
                  <Button variant="unstyled"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation() // prevent drag interfering
                      toast.action?.onAction()
                      onDismiss(toast.id)
                    }}
                    className="pointer-events-auto mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border bg-muted/60 px-3 py-1 text-xs font-semibold text-foreground hover:bg-muted transition cursor-pointer sm:min-h-8"
                  >
                    <ActionIcon className="size-3.5" />
                    {toast.action.label}
                  </Button>
                  )
                })()}
              </div>
              <Button variant="unstyled"
                size="icon"
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onDismiss(toast.id)
                }}
                className="-m-2 size-11 shrink-0 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer sm:-m-1 sm:size-8"
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
