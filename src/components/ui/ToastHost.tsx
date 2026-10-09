import { lazy, Suspense, useState } from 'react'
import type { ToastViewportProps } from './ToastViewport'

const ToastViewport = lazy(() => import('./ToastViewport').then(module => ({ default: module.ToastViewport })))

/**
 * The toast stack, fetched the first time there is something to say rather than with the shell: no
 * launch ever opens on a toast, and the stack and its motion are a measurable share of the startup
 * budget. Once loaded it stays mounted, so the last toast still animates out.
 */
export function ToastHost({ toasts, onDismiss }: ToastViewportProps) {
  const [needed, setNeeded] = useState(toasts.length > 0)
  if (!needed && toasts.length > 0) setNeeded(true)
  if (!needed) return null
  return (
    <Suspense fallback={null}>
      <ToastViewport toasts={toasts} onDismiss={onDismiss} />
    </Suspense>
  )
}
