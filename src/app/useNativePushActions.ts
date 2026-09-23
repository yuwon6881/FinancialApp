import { useEffect, useRef } from 'react'

export interface NativePushActionHandlers {
  verifySession: () => Promise<boolean>
  openRecurringPayment: (id: string) => void
  openCategoryAlerts: () => void
}

/** Keep native notification routing off the browser's initial download path. */
export function useNativePushActions(eligible: boolean, handlers: NativePushActionHandlers): void {
  const current = useRef({ eligible, handlers })
  const wake = useRef<(() => void) | null>(null)

  useEffect(() => {
    const becameEligible = eligible && !current.current.eligible
    current.current = { eligible, handlers }
    if (becameEligible) wake.current?.()
  }, [eligible, handlers])

  useEffect(() => {
    let disposed = false
    let cleanup: (() => void) | undefined
    void import('@capacitor/core')
      .then(({ Capacitor }) => Capacitor.isNativePlatform()
        ? import('./nativePushActionRuntime').then(({ startNativePushActionRuntime }) =>
          startNativePushActionRuntime(() => current.current))
        : null)
      .then(runtime => {
        if (!runtime) return
        if (disposed) runtime.cleanup()
        else {
          wake.current = runtime.wake
          cleanup = runtime.cleanup
          runtime.wake()
        }
      })
      .catch(error => console.warn('Could not initialize native notification routing.', error))

    return () => {
      disposed = true
      wake.current = null
      cleanup?.()
    }
  }, [])
}
