import { base64UrlToHex } from './webauthn'

const LEGACY_DEVICE_CREDENTIAL_ID_KEY = 'fingerprint_credential_id_on_this_device'
const DEVICE_CREDENTIAL_ID_KEY_PREFIX = 'fingerprint_credential_id_on_this_device:'

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
  if (accountValue === 'already_enrolled') return accountValue
  const normalized = normalizeCredentialId(accountValue)
  if (normalized) return normalized

  // Fall back to the legacy non-account-scoped key. The old code stored both
  // hex credential ids and the 'already_enrolled' sentinel here; the latter
  // must be checked explicitly because normalizeCredentialId treats it as an
  // unrecognised value and returns null.
  const legacyValue = localStorage.getItem(LEGACY_DEVICE_CREDENTIAL_ID_KEY)
  if (legacyValue === 'already_enrolled') return legacyValue
  return normalizeCredentialId(legacyValue)
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
  announceRegistrationChange()
}

/**
 * Records the credential a server-verified assertion just named.
 *
 * Separate from {@link rememberDeviceUnlockCredential} because the input is the backend's
 * uppercase hex form rather than the WebAuthn API's base64url, and the two cannot be told apart
 * reliably -- a base64url id can be all lowercase hex characters. Guessing would occasionally
 * store a marker that matches nothing and read back as "not enrolled here".
 *
 * Unlike the `already_enrolled` sentinel this names a specific credential, so it restores the
 * installed-PWA launch gate as well as the enrollment state.
 */
export function rememberVerifiedDeviceUnlockCredential(username: string, credentialIdHex: string): void {
  if (!username.trim()) return
  const normalized = credentialIdHex.trim().toUpperCase()
  if (!/^(?:[0-9A-F]{2})+$/.test(normalized)) return
  localStorage.setItem(storageKey(username), normalized)
  localStorage.setItem(LEGACY_DEVICE_CREDENTIAL_ID_KEY, normalized)
  announceRegistrationChange()
}

export function rememberExistingDeviceUnlock(username: string): void {
  if (!username.trim()) return
  localStorage.setItem(storageKey(username), 'already_enrolled')
  announceRegistrationChange()
}

export function forgetDeviceUnlockCredential(username: string, credentialId: string): void {
  const normalized = normalizeCredentialId(credentialId)
  if (!normalized || !username.trim()) return

  const accountKey = storageKey(username)
  const accountValue = localStorage.getItem(accountKey)
  let changed = false
  // Only clear the per-account key when it stores the exact credential being
  // removed. The 'already_enrolled' marker is imprecise — it does not name a
  // specific credential — so deleting any individual credential must not erase
  // the device's enrollment state. The backend credential list and the
  // enrolledHere guard in Settings are the authoritative checks.
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
