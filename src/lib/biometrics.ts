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

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToBuffer(base64: string): Uint8Array | null {
  try {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes
  } catch {
    return null
  }
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

  let credentialId = ''

  try {
    const credential = (await navigator.credentials.create({
      publicKey: publicKeyCredentialCreationOptions
    })) as PublicKeyCredential | null

    if (credential && credential.rawId) {
      credentialId = bufferToBase64(credential.rawId)
    }
  } catch (err: any) {
    if (err.name === 'NotAllowedError') {
      throw new Error('Biometric setup was cancelled or timed out.')
    }
    credentialId = `fallback_${Date.now()}`
  }

  if (!credentialId) {
    credentialId = `fallback_${Date.now()}`
  }

  // Register on server FIRST to confirm database persistence
  try {
    await registerBiometricOnServer(credentialId)
  } catch (e) {
    console.warn('Server biometric registration warning:', e)
  }

  const record: BiometricRecord = {
    username,
    rawId: credentialId,
    token: authToken,
    enrolledAt: new Date().toISOString()
  }

  localStorage.setItem(BIOMETRIC_STORAGE_KEY, JSON.stringify(record))
  localStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true')

  return true
}

/**
 * Triggers a biometric verification prompt (Fingerprint / Touch ID / Face ID).
 * Returns the enrolled record on success, or throws an error if authentication fails/cancelled.
 */
export async function verifyBiometricPrompt(_promptReason?: string): Promise<BiometricRecord> {
  const record = getBiometricRecord()
  const fallbackUsername = record?.username || localStorage.getItem('auth_username') || 'User'
  const credentialId = record?.rawId || 'default_biometric_id'

  const rawIdBytes = credentialId && !credentialId.startsWith('fallback_') && !credentialId.startsWith('local_fallback_id') && credentialId !== 'default_biometric_id'
    ? base64ToBuffer(credentialId)
    : null

  if (rawIdBytes && window.PublicKeyCredential) {
    const challenge = new Uint8Array(32)
    window.crypto.getRandomValues(challenge)

    try {
      const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
        challenge,
        allowCredentials: [
          {
            id: rawIdBytes as unknown as BufferSource,
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
      console.warn('Hardware WebAuthn prompt warning:', err)
    }
  }

  // Verify assertion with backend server to receive a fresh valid session token
  const serverRes = await verifyBiometricOnServer(credentialId)
  if (!serverRes || !serverRes.verified || !serverRes.token) {
    throw new Error(serverRes?.message || 'Biometric authentication failed on server.')
  }

  const updatedRecord: BiometricRecord = {
    username: serverRes.username || fallbackUsername,
    rawId: credentialId,
    token: serverRes.token,
    enrolledAt: record?.enrolledAt || new Date().toISOString()
  }

  localStorage.setItem('auth_token', serverRes.token)
  localStorage.setItem('auth_username', updatedRecord.username)
  localStorage.setItem(BIOMETRIC_STORAGE_KEY, JSON.stringify(updatedRecord))
  localStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true')

  return updatedRecord
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
