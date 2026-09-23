import { base64UrlToHex } from './webauthn'

const LEGACY_DEVICE_CREDENTIAL_ID_KEY = 'fingerprint_credential_id_on_this_device'
const DEVICE_CREDENTIAL_ID_KEY_PREFIX = 'fingerprint_credential_id_on_this_device:'
const LAST_ENROLLED_USERNAME_KEY = 'fingerprint_last_enrolled_username'

export function getLastEnrolledUsername(): string | null {
  if (typeof localStorage === 'undefined') return null
  return localStorage.getItem(LAST_ENROLLED_USERNAME_KEY) || null
}

export function rememberEnrolledUsername(username: string): void {
  if (typeof localStorage === 'undefined' || !username.trim()) return
  localStorage.setItem(LAST_ENROLLED_USERNAME_KEY, username.trim())
}

function persistToNativeSecureStorage(username: string, normalizedCred: string): void {
  if (typeof window === 'undefined') return
  void import('@capacitor/core').then(({ Capacitor }) => {
    if (!Capacitor.isNativePlatform()) return
    return import('@aparajita/capacitor-secure-storage').then(({ SecureStorage }) => {
      return Promise.all([
        SecureStorage.set(storageKey(username), normalizedCred),
        SecureStorage.set('last_enrolled_username', username.trim()),
      ])
    })
  }).catch(() => undefined)
}

export async function syncDeviceUnlockFromSecureStorage(): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    const { Capacitor } = await import('@capacitor/core')
    if (!Capacitor.isNativePlatform()) return
    const { SecureStorage } = await import('@aparajita/capacitor-secure-storage')
    const lastUser = (await SecureStorage.get('last_enrolled_username')) as string | null
    if (lastUser && !localStorage.getItem(LAST_ENROLLED_USERNAME_KEY)) {
      rememberEnrolledUsername(lastUser)
      const cred = (await SecureStorage.get(storageKey(lastUser))) as string | null
      if (cred && !localStorage.getItem(storageKey(lastUser))) {
        localStorage.setItem(storageKey(lastUser), cred)
        localStorage.setItem(LEGACY_DEVICE_CREDENTIAL_ID_KEY, cred)
        announceRegistrationChange()
      }
    }
  } catch (err) {
    console.warn('Could not sync device unlock from SecureStorage', err)
  }
}

function storageKey(username: string): string {
  return `${DEVICE_CREDENTIAL_ID_KEY_PREFIX}${username.trim().toUpperCase()}`
}

/**
 * Fired whenever this browser's enrollment marker changes. `fetchAuthStatus` answers
 * `hasFingerprintOnDevice` from that marker, so a live session's cached answer goes
 * stale the moment Settings enrolls or removes a credential — the sensitive-reveal
 * prompt would keep demanding a password until the next cold launch. Every writer
 * below announces the change so listeners can re-ask instead of waiting for a reload.
 */
export const DEVICE_UNLOCK_REGISTRATION_EVENT = 'device-unlock-registration-changed'

function announceRegistrationChange(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(DEVICE_UNLOCK_REGISTRATION_EVENT))
}

function normalizeCredentialId(value: string | null): string | null {
  if (!value || value === 'already_enrolled') return null
  if (/^(?:[0-9a-f]{2})+$/i.test(value)) return value.toUpperCase()
  try {
    return base64UrlToHex(value)
  } catch {
    return null
  }
}

export function getDeviceUnlockRegistrationMarker(username: string): string | null {
  if (!username.trim()) return null
  const accountValue = localStorage.getItem(storageKey(username))
  const normalized = normalizeCredentialId(accountValue)
  if (normalized) return normalized

  // Old installations may retain a marker without an exact credential id.
  // That marker cannot prove this device holds an account credential.
  return normalizeCredentialId(localStorage.getItem(LEGACY_DEVICE_CREDENTIAL_ID_KEY))
}

/** Returns the credential this browser recorded for this account at enrollment time. */
export function getRegisteredDeviceCredentialId(username: string): string | null {
  if (!username.trim()) return null
  return normalizeCredentialId(localStorage.getItem(storageKey(username)))
}

export function rememberDeviceUnlockCredential(username: string, credentialId: string): void {
  if (!username.trim()) return
  let normalized: string
  try {
    normalized = base64UrlToHex(credentialId)
  } catch {
    return
  }
  if (!normalized) return
  localStorage.setItem(storageKey(username), normalized)
  // Keep the old key during the compatibility window for existing installations.
  localStorage.setItem(LEGACY_DEVICE_CREDENTIAL_ID_KEY, normalized)
  rememberEnrolledUsername(username)
  persistToNativeSecureStorage(username, normalized)
  announceRegistrationChange()
}

export function forgetDeviceUnlockCredential(username: string, credentialId: string): void {
  const normalized = normalizeCredentialId(credentialId)
  if (!normalized || !username.trim()) return

  const accountKey = storageKey(username)
  const accountValue = localStorage.getItem(accountKey)
  let changed = false
  // Only clear a marker when it names the credential being removed.
  if (normalizeCredentialId(accountValue) === normalized) {
    localStorage.removeItem(accountKey)
    changed = true
  }
  if (normalizeCredentialId(localStorage.getItem(LEGACY_DEVICE_CREDENTIAL_ID_KEY)) === normalized) {
    localStorage.removeItem(LEGACY_DEVICE_CREDENTIAL_ID_KEY)
    changed = true
  }
  if (changed) announceRegistrationChange()
}
