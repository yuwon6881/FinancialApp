// A stable per-browser device identifier. Push subscriptions are keyed by this id on the
// server so the same physical browser install can be recognized across logins/sessions and
// unregistered on logout without depending on any particular FCM token (tokens can rotate).
const DEVICE_ID_STORAGE_KEY = 'push_device_id'

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Fallback for environments without crypto.randomUUID (older WebViews).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
    const rand = (Math.random() * 16) | 0
    const value = char === 'x' ? rand : (rand & 0x3) | 0x8
    return value.toString(16)
  })
}

export function getOrCreateDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY)
    if (existing) return existing
    const created = generateUuid()
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, created)
    return created
  } catch {
    // localStorage unavailable (e.g. private mode edge cases) -- fall back to a per-call id
    // rather than throwing; push features will simply not persist across reloads.
    return generateUuid()
  }
}

export function getExistingDeviceId(): string | null {
  try {
    return localStorage.getItem(DEVICE_ID_STORAGE_KEY)
  } catch {
    return null
  }
}
