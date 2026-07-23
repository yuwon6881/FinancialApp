import { Capacitor } from '@capacitor/core'
import { getFirebaseConfig, getVapidKey } from './firebaseConfig'

// Feature gate for the whole web-push flow. Push Payment Reminders is a browser-only
// (FCM-over-service-worker) feature: the native Capacitor shell has no service worker to host
// firebase/messaging/sw, and older/locked-down browsers lack one of the required Web APIs. The
// gate also folds in "is this deployment even configured for it" so the UI can degrade to a
// single explanatory message either way, rather than throwing at runtime.
export function isPushSupported(): boolean {
  if (Capacitor.isNativePlatform()) return false
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
  if (!('serviceWorker' in navigator)) return false
  if (!('PushManager' in window)) return false
  if (!('Notification' in window)) return false
  if (!getFirebaseConfig() || !getVapidKey()) return false
  return true
}
