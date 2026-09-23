import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'

/** Register offline support for the web app; native Capacitor builds use bundled assets directly. */
export function OfflineSupportRuntime() {
  const isNative = Capacitor.isNativePlatform()

  useEffect(() => {
    if (isNative || !import.meta.env.PROD || !('serviceWorker' in navigator)) return
    let cancelled = false

    void import('virtual:pwa-register')
      .then(({ registerSW }) => {
        if (cancelled) return
        registerSW({
          immediate: true,
          onRegisterError(error) {
            console.warn('Could not register the app service worker.', error)
          },
        })
      })
      .catch(error => console.warn('Could not load app service-worker support.', error))

    return () => { cancelled = true }
  }, [isNative])

  return null
}
