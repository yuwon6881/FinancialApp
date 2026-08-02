import { base64UrlToHex } from './webauthn'

const LEGACY_DEVICE_CREDENTIAL_ID_KEY = 'fingerprint_credential_id_on_this_device'
const DEVICE_CREDENTIAL_ID_KEY_PREFIX = 'fingerprint_credential_id_on_this_device:'

function storageKey(username: string): string {
  return `${DEVICE_CREDENTIAL_ID_KEY_PREFIX}${username.trim().toUpperCase()}`
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
  return normalizeCredentialId(accountValue)
    ?? normalizeCredentialId(localStorage.getItem(LEGACY_DEVICE_CREDENTIAL_ID_KEY))
}

/** Returns the credential this browser recorded for this account at enrollment time. */
export function getRegisteredDeviceCredentialId(username: string): string | null {
  return normalizeCredentialId(getDeviceUnlockRegistrationMarker(username))
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
}

export function rememberExistingDeviceUnlock(username: string): void {
  if (!username.trim()) return
  localStorage.setItem(storageKey(username), 'already_enrolled')
}

export function forgetDeviceUnlockCredential(username: string, credentialId: string): void {
  const normalized = normalizeCredentialId(credentialId)
  if (!normalized || !username.trim()) return

  const accountKey = storageKey(username)
  const accountValue = localStorage.getItem(accountKey)
  if (accountValue === 'already_enrolled' || normalizeCredentialId(accountValue) === normalized) {
    localStorage.removeItem(accountKey)
  }
  if (normalizeCredentialId(localStorage.getItem(LEGACY_DEVICE_CREDENTIAL_ID_KEY)) === normalized) {
    localStorage.removeItem(LEGACY_DEVICE_CREDENTIAL_ID_KEY)
  }
}
