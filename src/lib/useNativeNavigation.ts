import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'

/** Load native-only Back and external URL handling after the first app paint. */
export function useNativeNavigation(): void {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    let cleanup: (() => void) | undefined
    let cancelled = false
    void import('./native/nativeNavigation').then(module => module.installNativeNavigation()).then(remove => {
      if (cancelled) remove()
      else cleanup = remove
    }).catch(error => console.warn('Could not install native navigation handling.', error))
    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [])
}
