/// <reference lib="webworker" />

import { initializeApp } from 'firebase/app'
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw'
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { buildBackgroundNotification, buildRecurringNotificationUrl } from './lib/push/backgroundNotification'
import { getFirebaseConfig } from './lib/push/firebaseConfig'
import { isRecurringNotificationData } from './lib/push/notificationTag'

declare let self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<unknown> }

self.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

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
