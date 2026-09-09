import type { FirebaseApp } from 'firebase/app'
import type { Messaging, MessagePayload } from 'firebase/messaging'
import { classifyPushTokenError, PushTokenError, pushFailureDetail } from './failure'
import { getFirebaseConfig, getVapidKey } from './firebaseConfig'

let appInstance: FirebaseApp | null = null
let messagingInstance: Messaging | null = null

async function getMessagingInstance(): Promise<Messaging | null> {
  if (messagingInstance) return messagingInstance
  const config = getFirebaseConfig()
  if (!config) return null
  const [{ initializeApp }, { getMessaging, isSupported }] = await Promise.all([
    import('firebase/app'),
    import('firebase/messaging'),
  ])

  // Firebase's own support check is awaited here rather than left to getMessaging(), which runs it
  // in a floating promise: the failure surfaces as an unhandled rejection nobody can act on, and
  // the instance it hands back then fails later with a less specific error. isPushSupported() has
  // already proved the Web APIs exist, so a false answer here is Firebase failing to open
  // IndexedDB or read cookies -- blocked site data, not a browser that cannot do push.
  if (!(await isSupported())) {
    throw new PushTokenError('storageBlocked', 'Firebase Messaging is unavailable on this device.')
  }

  appInstance ??= initializeApp(config)
  messagingInstance = getMessaging(appInstance)
  return messagingInstance
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  const bytes = new Uint8Array(raw.length)
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index)
  return bytes
}

/**
 * Drops a PushSubscription that was minted for a different application server key.
 *
 * Firebase reuses whatever subscription the registration already has without checking its key, so
 * a subscription left behind by a different VAPID key keeps being handed to FCM, which rejects the
 * registration on every attempt with no way for the user to clear it. Unsubscribing is the only
 * way out and costs nothing when the keys already agree. Browsers that do not expose
 * `options.applicationServerKey` are left alone rather than guessed at: an unnecessary
 * unsubscribe would rotate a working registration.
 */
async function dropMismatchedSubscription(
  registration: ServiceWorkerRegistration,
  vapidKey: string,
): Promise<void> {
  try {
    const subscription = await registration.pushManager.getSubscription()
    const existing = subscription?.options?.applicationServerKey
    if (!subscription || !existing) return
    const expected = base64UrlToBytes(vapidKey)
    const actual = new Uint8Array(existing)
    if (actual.length === expected.length && actual.every((byte, index) => byte === expected[index])) return
    await subscription.unsubscribe()
  } catch {
    // Best effort. If the subscription cannot be inspected or undone, the token request below
    // still runs and reports its own, more specific failure.
  }
}

function asPushTokenError(error: unknown, fallbackMessage: string): PushTokenError {
  if (error instanceof PushTokenError) return error
  return new PushTokenError(classifyPushTokenError(error), fallbackMessage, {
    cause: error,
    detail: pushFailureDetail(error),
  })
}

/**
 * Requests an FCM registration token bound to the app's own service worker registration
 * (rather than letting Firebase register its own worker), so the same worker that already
 * handles precache/offline routing also owns background push delivery.
 *
 * Returns null only when this deployment carries no push configuration. Every other failure throws
 * a {@link PushTokenError} naming the reason -- collapsing them all into null is what made a
 * browser privacy setting, blocked site data and a dead network all report the same "this browser
 * does not support notifications", which is the one answer none of them had.
 */
export async function getFcmToken(registration: ServiceWorkerRegistration): Promise<string | null> {
  const messaging = await getMessagingInstance().catch(error => {
    throw asPushTokenError(error, 'Could not start Firebase Messaging on this device.')
  })
  const vapidKey = getVapidKey()
  if (!messaging || !vapidKey) return null
  try {
    const { getToken } = await import('firebase/messaging')
    await dropMismatchedSubscription(registration, vapidKey)
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration })
    if (!token) {
      throw new PushTokenError('pushServiceBlocked', 'The push service returned no registration token.')
    }
    return token
  } catch (err) {
    console.warn('Could not retrieve an FCM token.', err)
    throw asPushTokenError(err, 'Could not register this device for notifications.')
  }
}

/**
 * A server-retired token cannot be repaired by reading Firebase's cached token and uploading the
 * same value again. Remove the local registration first so the next request creates a genuinely
 * new token for this browser subscription.
 */
export async function renewFcmToken(registration: ServiceWorkerRegistration): Promise<string | null> {
  const messaging = await getMessagingInstance().catch(error => {
    throw asPushTokenError(error, 'Could not start Firebase Messaging on this device.')
  })
  const vapidKey = getVapidKey()
  if (!messaging || !vapidKey) return null
  try {
    const { deleteToken, getToken } = await import('firebase/messaging')
    const tokenOptions = { vapidKey, serviceWorkerRegistration: registration }
    await dropMismatchedSubscription(registration, vapidKey)

    // deleteToken() has no service-worker option. On a fresh page-side Messaging instance it
    // otherwise tries Firebase's default /firebase-messaging-sw.js before touching the cached
    // token. Calling getToken() with our existing registration first binds the SDK to the app's
    // single PWA worker. A retired cached token may make this read fail, but the binding happens
    // before Firebase performs token I/O, so renewal can still continue below.
    try {
      await getToken(messaging, tokenOptions)
    } catch {
      // The authoritative renewal attempt and its user-visible result happen below.
    }
    try {
      await deleteToken(messaging)
    } catch {
      // FCM commonly rejects deletion for the same reason it rejected delivery: the remote token
      // is already gone. Firebase then leaves its IndexedDB token and PushSubscription intact,
      // so getToken() would return the same dead value. Unsubscribing locally forces its mismatch
      // path to mint a new registration while keeping notification permission unchanged.
      const subscription = await registration.pushManager.getSubscription()
      await subscription?.unsubscribe()
    }
    const token = await getToken(messaging, tokenOptions)
    if (!token) {
      throw new PushTokenError('pushServiceBlocked', 'The push service returned no registration token.')
    }
    return token
  } catch (err) {
    console.warn('Could not renew the FCM token.', err)
    throw asPushTokenError(err, 'Could not renew this device registration for notifications.')
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
