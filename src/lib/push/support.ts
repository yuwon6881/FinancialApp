import { Capacitor } from '@capacitor/core'
import type { PushFailureReason } from './failure'
import { getFirebaseConfig, getVapidKey } from './firebaseConfig'

// Feature gate for the whole web-push flow. Push Payment Reminders is a browser-only
// (FCM-over-service-worker) feature: the native Capacitor shell has no service worker to host
// firebase/messaging/sw, and older/locked-down browsers lack one of the required Web APIs. The
// gate also folds in "is this deployment even configured for it" so the UI can explain itself
// rather than throwing at runtime.
//
// The two halves of the gate answer differently and are kept apart for that reason: a browser
// without the APIs is the only one entitled to "not supported", while a deployment with no
// Firebase configuration is a build-time fact the user cannot act on at all.
export function pushSupportFailure(): PushFailureReason | null {
  if (Capacitor.isNativePlatform()) return 'unsupported'
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'unsupported'
  if (!('serviceWorker' in navigator)) return 'unsupported'
  if (!('PushManager' in window)) return 'unsupported'
  if (!('Notification' in window)) return 'unsupported'
  if (!getFirebaseConfig() || !getVapidKey()) return 'notConfigured'
  return null
}

export function isPushSupported(): boolean {
  return pushSupportFailure() === null
}
