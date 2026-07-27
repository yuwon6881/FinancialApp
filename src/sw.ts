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

// Start the navigation request before this worker has finished booting. Without it, a cold
// launch pays SW startup (parsing this bundle, including the Firebase messaging import)
// before the network request for the document is even issued.
if (self.registration.navigationPreload) {
  self.addEventListener('activate', event => {
    event.waitUntil(self.registration.navigationPreload!.enable())
  })
}

registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

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
