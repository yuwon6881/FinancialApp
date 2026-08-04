/// <reference lib="webworker" />

import { initializeApp } from 'firebase/app'
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw'
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { StaleWhileRevalidate } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { buildBackgroundNotification, buildRecurringNotificationUrl } from './lib/push/backgroundNotification'
import { getFirebaseConfig } from './lib/push/firebaseConfig'
import { isRecurringNotificationData } from './lib/push/notificationTag'

declare let self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<unknown> }

self.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// Navigation preload is disabled: since this is an SPA that always serves index.html
// directly from the Workbox precache, it never consumes the preloaded network response.
// Enabling it causes Chrome to fire a useless network request and then complain when
// the SW responds from cache without waiting for the preload to settle.
// Disable it during activation as well so a worker installed from an older build
// cannot leave an enabled preload request behind after this worker takes over.
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    if (self.registration.navigationPreload) {
      await self.registration.navigationPreload.disable()
    }
  })())
})

// API content can also be opened as a navigation by a PDF/image iframe. Keep it
// on the network so the SPA fallback cannot turn an authenticated document response
// into index.html rendered inside the preview sheet.
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), {
  denylist: [/^\/api(?:\/|$)/],
}))

// Same-origin static assets that the precache manifest does not cover — chiefly the
// hashed lazy-view chunks, which are fetched on demand and so are not in the manifest.
// Stale-while-revalidate serves the cached copy instantly and refreshes in the background;
// safe here because every filename is content-hashed, so a stale entry is never *wrong*,
// only superseded.
registerRoute(
  ({ request, url, sameOrigin }) =>
    sameOrigin
    && !url.pathname.startsWith('/api')
    && (request.destination === 'script' || request.destination === 'style' || request.destination === 'font'),
  new StaleWhileRevalidate({
    cacheName: 'app-assets',
    plugins: [
      // Bounded so superseded hashed chunks cannot accumulate indefinitely on a device.
      new ExpirationPlugin({ maxEntries: 80, maxAgeSeconds: 30 * 24 * 60 * 60, purgeOnQuotaError: true }),
    ],
  }),
)

// API GETs are deliberately NOT cached here.
//
// The app already has two layers that own network freshness: lib/cache.ts holds the offline
// snapshots the UI renders from, and lib/api/client.ts revalidates with If-None-Match against
// the server's ETags. A third cache in the service worker would compete with both — it could
// serve a body the client believes it has already revalidated, or cache a response whose ETag
// the client is holding, and offline reads would have two disagreeing sources of truth. One
// cache that is correct beats two that race.
//
// It would also be unsafe in specific ways: these are per-user financial payloads in a shared
// Cache Storage bucket that survives logout, and auth responses carry Set-Cookie.

const firebaseConfig = getFirebaseConfig()
if (firebaseConfig) {
  const messaging = getMessaging(initializeApp(firebaseConfig))
  onBackgroundMessage(messaging, async payload => {
    const built = buildBackgroundNotification(payload)
    if (!built) return
    await self.registration.showNotification(built.title, built.options)
  })
}

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const data = event.notification.data
  if (!isRecurringNotificationData(data)) return

  const targetUrl = new URL(buildRecurringNotificationUrl(data), self.location.origin).href
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of windows) {
      const windowClient = client as WindowClient
      if (new URL(windowClient.url).origin === self.location.origin) {
        await windowClient.navigate(targetUrl)
        return windowClient.focus()
      }
    }
    return self.clients.openWindow(targetUrl)
  })())
})
