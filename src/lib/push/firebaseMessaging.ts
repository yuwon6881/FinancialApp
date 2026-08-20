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

// A server-retired token cannot be repaired by reading Firebase's cached token and uploading the
// same value again. Remove the local registration first so the next request creates a genuinely
// new token for this browser subscription.
export async function renewFcmToken(registration: ServiceWorkerRegistration): Promise<string | null> {
  const messaging = await getMessagingInstance()
  const vapidKey = getVapidKey()
  if (!messaging || !vapidKey) return null
  try {
    const { deleteToken, getToken } = await import('firebase/messaging')
    try {
      await deleteToken(messaging)
    } catch (err) {
      // FCM commonly rejects deletion for the same reason it rejected delivery: the remote token
      // is already gone. Firebase then leaves its IndexedDB token and PushSubscription intact,
      // so getToken() would return the same dead value. Unsubscribing locally forces its mismatch
      // path to mint a new registration while keeping notification permission unchanged.
      console.warn('Could not revoke the retired FCM token remotely; replacing it locally.', err)
      const subscription = await registration.pushManager.getSubscription()
      await subscription?.unsubscribe()
    }
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration })
    return token || null
  } catch (err) {
    console.warn('Could not renew the FCM token.', err)
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
