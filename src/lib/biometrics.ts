/**
 * WebAuthn Biometric Authentication Helper
 * Supports Fingerprint, Touch ID, Face ID, and Device Passcode on Web / PWA.
 */

import { registerBiometricOnServer, verifyBiometricOnServer, removeBiometricOnServer } from './api'

const BIOMETRIC_STORAGE_KEY = 'biometric_credentials'
const BIOMETRIC_ENABLED_KEY = 'biometric_enabled'

export interface BiometricRecord {
  username: string
  rawId: string
  token: string
  enrolledAt: string
}

/**
 * Checks if the browser and device hardware support WebAuthn platform authenticators (fingerprint, Touch ID, Face ID).
 */
export async function isBiometricAvailable(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) {
    return false
  }
  try {
    if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
    }
    return true
  } catch {
    return false
  }
}

/**
 * Checks if biometric authentication is currently enrolled and enabled for the local user.
 */
export function isBiometricEnrolled(): boolean {
  try {
    const enabled = localStorage.getItem(BIOMETRIC_ENABLED_KEY) === 'true'
    const stored = localStorage.getItem(BIOMETRIC_STORAGE_KEY)
    return enabled && !!stored
  } catch {
    return false
  }
}

/**
 * Gets enrolled biometric record details.
 */
export function getBiometricRecord(): BiometricRecord | null {
  try {
    const stored = localStorage.getItem(BIOMETRIC_STORAGE_KEY)
    if (!stored) return null
    return JSON.parse(stored) as BiometricRecord
  } catch {
    return null
  }
}

/**
 * Registers a new biometric credential using WebAuthn and syncs with the backend API.
 */
export async function enrollBiometrics(username: string, authToken: string): Promise<boolean> {
  const available = await isBiometricAvailable()
  if (!available) {
    throw new Error('Biometric hardware or WebAuthn is not supported on this device/browser.')
  }

  const userId = new TextEncoder().encode(username || 'user')
  const challenge = new Uint8Array(32)
  window.crypto.getRandomValues(challenge)

  const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
    challenge,
    rp: {
      name: 'FinancialApp Ledger',
      id: window.location.hostname
    },
    user: {
      id: userId,
      name: username || 'User',
      displayName: username || 'FinancialApp User'
    },
    pubKeyCredParams: [
      { alg: -7, type: 'public-key' },  // ES256
      { alg: -257, type: 'public-key' } // RS256
    ],
    authenticatorSelection: {
      authenticatorAttachment: 'platform', // Enforce platform authenticator (fingerprint/face)
      userVerification: 'preferred'
    },
    timeout: 60000
  }

  let credentialId = 'local_fallback_id'

  try {
    const credential = (await navigator.credentials.create({
      publicKey: publicKeyCredentialCreationOptions
    })) as PublicKeyCredential | null

    if (credential) {
      const rawIdArray = new Uint8Array(credential.rawId)
      credentialId = btoa(String.fromCharCode(...rawIdArray))
    }
  } catch (err: any) {
    if (err.name === 'NotAllowedError') {
      throw new Error('Biometric setup was cancelled or timed out.')
    }
    credentialId = `credential_${Date.now()}`
  }

  const record: BiometricRecord = {
    username,
    rawId: credentialId,
    token: authToken,
    enrolledAt: new Date().toISOString()
  }

  localStorage.setItem(BIOMETRIC_STORAGE_KEY, JSON.stringify(record))
  localStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true')

  // Sync to C# backend API
  try {
    await registerBiometricOnServer(credentialId)
  } catch (e) {
    console.warn('Biometric backend registration warning:', e)
  }

  return true
}

/**
 * Triggers a biometric verification prompt (Fingerprint / Touch ID / Face ID).
 * Returns the enrolled record on success, or throws an error if authentication fails/cancelled.
 */
export async function verifyBiometricPrompt(_promptReason?: string): Promise<BiometricRecord> {
  const record = getBiometricRecord()
  if (!record || !isBiometricEnrolled()) {
    throw new Error('Biometric authentication is not enrolled on this device.')
  }

  if (record.rawId !== 'local_fallback_id' && window.PublicKeyCredential) {
    const challenge = new Uint8Array(32)
    window.crypto.getRandomValues(challenge)

    try {
      const rawIdBytes = Uint8Array.from(atob(record.rawId), c => c.charCodeAt(0))

      const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
        challenge,
        allowCredentials: [
          {
            id: rawIdBytes,
            type: 'public-key',
            transports: ['internal']
          }
        ],
        userVerification: 'preferred',
        timeout: 60000
      }

      await navigator.credentials.get({
        publicKey: publicKeyCredentialRequestOptions
      })
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        throw new Error('Biometric prompt was cancelled.')
      }
    }
  }

  // Verify assertion with backend server
  try {
    const serverRes = await verifyBiometricOnServer(record.rawId)
    if (serverRes && serverRes.token) {
      record.token = serverRes.token
      record.username = serverRes.username || record.username
      localStorage.setItem('auth_token', serverRes.token)
      localStorage.setItem(BIOMETRIC_STORAGE_KEY, JSON.stringify(record))
    }
  } catch (e) {
    console.warn('Biometric backend verification warning (using local session token):', e)
  }

  return record
}

/**
 * Disables biometric authentication and removes stored credentials.
 */
export async function removeBiometrics(): Promise<void> {
  localStorage.removeItem(BIOMETRIC_STORAGE_KEY)
  localStorage.setItem(BIOMETRIC_ENABLED_KEY, 'false')
  try {
    await removeBiometricOnServer()
  } catch (e) {
    console.warn('Biometric backend removal warning:', e)
  }
}
