import type { FirebaseApp } from 'firebase/app'
import type { Messaging, MessagePayload } from 'firebase/messaging'
import { getFirebaseConfig, getVapidKey } from './firebaseConfig'

let appInstance: FirebaseApp | null = null
let messagingInstance: Messaging | null = null

async function getMessagingInstance(): Promise<Messaging | null> {
  if (messagingInstance) return messagingInstance
  const config = getFirebaseConfig()
  if (!config) return null
  const [{ initializeApp }, { getMessaging }] = await Promise.all([
    import('firebase/app'),
    import('firebase/messaging'),
  ])
  appInstance ??= initializeApp(config)
  messagingInstance = getMessaging(appInstance)
  return messagingInstance
}

// Requests an FCM registration token bound to the app's own service worker registration
// (rather than letting Firebase register its own worker), so the same worker that already
// handles precache/offline routing also owns background push delivery.
export async function getFcmToken(registration: ServiceWorkerRegistration): Promise<string | null> {
  const messaging = await getMessagingInstance()
  const vapidKey = getVapidKey()
  if (!messaging || !vapidKey) return null
  try {
    const { getToken } = await import('firebase/messaging')
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration })
    return token || null
  } catch (err) {
    console.warn('Could not retrieve an FCM token.', err)
    return null
  }
}

// Foreground messages never trigger the browser's native notification UI (only the
// service worker's background handler does that); this only powers the in-app toast.
export async function onForegroundMessage(callback: (payload: MessagePayload) => void): Promise<() => void> {
  const messaging = await getMessagingInstance()
  if (!messaging) return () => undefined
  const { onMessage } = await import('firebase/messaging')
  return onMessage(messaging, callback)
}
