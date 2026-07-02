import { isNativePlatform } from './lib/native'

export function register() {
  // Inside the Capacitor native shell the OS handles offline/caching and the
  // splash screen; a service worker there is unnecessary and can interfere.
  if (isNativePlatform()) return
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('Service Worker registered successfully with scope:', reg.scope)

        // When a new SW takes control, reload once so the running (possibly
        // resumed-from-recents) PWA instance picks up the freshly deployed
        // code instead of serving the stale cached bundle indefinitely.
        let refreshing = false
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (refreshing) return
          refreshing = true
          window.location.reload()
        })

        // Ask a waiting worker to activate. This runs well after page load
        // (on update detection / refocus), NOT during the WebAPK bootstrap,
        // so it avoids the flash-quit-reopen the SW comment warns about.
        const activateWaiting = () => {
          if (reg.waiting) reg.waiting.postMessage('SKIP_WAITING')
        }

        // A worker that reaches "installed" while a controller already exists
        // is an update (not the first install) — activate it.
        reg.addEventListener('updatefound', () => {
          const incoming = reg.installing
          if (!incoming) return
          incoming.addEventListener('statechange', () => {
            if (incoming.state === 'installed' && navigator.serviceWorker.controller) {
              activateWaiting()
            }
          })
        })

        // If an update was already waiting from a previous visit, take it.
        if (reg.waiting && navigator.serviceWorker.controller) activateWaiting()

        // Check for a new deploy on first load and whenever the app is
        // brought back to the foreground (how installed PWAs are re-opened).
        const checkForUpdate = () => reg.update().catch(() => {})
        checkForUpdate()
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') checkForUpdate()
        })
      })
      .catch((err) => {
        console.error('Service Worker registration failed:', err)
      })
  })
}
