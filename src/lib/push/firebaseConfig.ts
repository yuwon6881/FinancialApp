export interface FirebaseWebConfig {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  appId: string
}

// Firebase web config values are public identifiers (not secrets) -- safe to ship in the
// client bundle, same as any other Firebase web app. The public VAPID key identifies the
// Web Push application server and is passed separately to getToken(), not initializeApp().
export function getFirebaseConfig(): FirebaseWebConfig | null {
  const env = import.meta.env
  const apiKey = env.VITE_FIREBASE_API_KEY
  const authDomain = env.VITE_FIREBASE_AUTH_DOMAIN
  const projectId = env.VITE_FIREBASE_PROJECT_ID
  const storageBucket = env.VITE_FIREBASE_STORAGE_BUCKET
  const messagingSenderId = env.VITE_FIREBASE_MESSAGING_SENDER_ID
  const appId = env.VITE_FIREBASE_APP_ID

  if (!apiKey || !authDomain || !projectId || !storageBucket || !messagingSenderId || !appId) {
    return null
  }
  return { apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId }
}

export function getVapidKey(): string | null {
  return import.meta.env.VITE_FIREBASE_VAPID_KEY || null
}
