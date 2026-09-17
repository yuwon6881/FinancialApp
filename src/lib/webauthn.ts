// Browser-side glue between the WebAuthn API and the Fido2NetLib JSON shape
// the backend sends/expects (base64url-encoded byte fields, camelCase keys).
import { withExclusiveWebAuthnRequest } from './webauthnRequest'

function base64UrlToBuffer(base64Url: string): ArrayBuffer {
  const padded = base64Url.replace(/-/g, '+').replace(/_/g, '/')
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
  const binary = atob(padded + pad)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// The backend identifies stored credentials by the uppercase hex of their raw
// credential-id bytes (Convert.ToHexString). The WebAuthn API hands us that id
// as a base64url string, so convert to the same hex form to compare the two.
export function base64UrlToHex(base64Url: string): string {
  const bytes = new Uint8Array(base64UrlToBuffer(base64Url))
  let hex = ''
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0')
  return hex.toUpperCase()
}

function isFingerprintSupported(): boolean {
  return typeof window !== 'undefined' && !!window.PublicKeyCredential
}

// Android/Chrome's User-Agent Reduction strips real device model info from
// navigator.userAgent (e.g. "Linux; Android 10; K"), so we derive a short
// "Browser on OS" label instead of parsing the raw platform token.
export function getFriendlyDeviceLabel(): string {
  if (typeof navigator === 'undefined') return 'This device'
  const ua = navigator.userAgent

  let os = 'Unknown device'
  if (/Android/i.test(ua)) os = 'Android'
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS'
  else if (/Windows/i.test(ua)) os = 'Windows'
  else if (/Macintosh|Mac OS X/i.test(ua)) os = 'macOS'
  else if (/Linux/i.test(ua)) os = 'Linux'

  let browser = 'Browser'
  if (/Edg\//i.test(ua)) browser = 'Edge'
  else if (/OPR\//i.test(ua) || /Opera/i.test(ua)) browser = 'Opera'
  else if (/Chrome\//i.test(ua)) browser = 'Chrome'
  else if (/Firefox\//i.test(ua)) browser = 'Firefox'
  else if (/Safari\//i.test(ua)) browser = 'Safari'

  return `${browser} on ${os}`
}

export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isFingerprintSupported()) return false
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

interface Fido2Descriptor {
  type: string
  id: string
  transports?: string[]
}

export interface CreateOptionsJson {
  rp: { id: string; name: string }
  user: { name: string; id: string; displayName: string }
  challenge: string
  pubKeyCredParams: { type: string; alg: number }[]
  timeout?: number
  attestation?: string
  authenticatorSelection?: {
    authenticatorAttachment?: string
    residentKey?: string
    requireResidentKey?: boolean
    userVerification?: string
  }
  excludeCredentials?: Fido2Descriptor[]
}

export interface AssertionOptionsJson {
  challenge: string
  timeout?: number
  rpId?: string
  allowCredentials?: Fido2Descriptor[]
  userVerification?: string
}

export async function createFingerprintCredential(options: CreateOptionsJson, signal?: AbortSignal) {
  const publicKey: PublicKeyCredentialCreationOptions = {
    rp: options.rp,
    user: {
      name: options.user.name,
      displayName: options.user.displayName,
      id: base64UrlToBuffer(options.user.id),
    },
    challenge: base64UrlToBuffer(options.challenge),
    pubKeyCredParams: options.pubKeyCredParams as PublicKeyCredentialParameters[],
    timeout: options.timeout,
    attestation: options.attestation as AttestationConveyancePreference | undefined,
    authenticatorSelection: options.authenticatorSelection as AuthenticatorSelectionCriteria | undefined,
    excludeCredentials: (options.excludeCredentials || []).map(c => ({
      type: 'public-key' as const,
      id: base64UrlToBuffer(c.id),
      transports: c.transports as AuthenticatorTransport[] | undefined,
    })),
  }

  const credential = await withExclusiveWebAuthnRequest(
    requestSignal => navigator.credentials.create({ publicKey, signal: requestSignal }) as Promise<PublicKeyCredential | null>,
    signal,
  )
  if (!credential) throw new Error('No credential returned by the authenticator.')

  const response = credential.response as AuthenticatorAttestationResponse
  return {
    id: credential.id,
    rawId: bufferToBase64Url(credential.rawId),
    type: credential.type,
    response: {
      attestationObject: bufferToBase64Url(response.attestationObject),
      clientDataJSON: bufferToBase64Url(response.clientDataJSON),
      transports: response.getTransports ? response.getTransports() : [],
    },
    clientExtensionResults: credential.getClientExtensionResults(),
  }
}

export async function getFingerprintAssertion(options: AssertionOptionsJson, signal?: AbortSignal) {
  const publicKey: PublicKeyCredentialRequestOptions = {
    challenge: base64UrlToBuffer(options.challenge),
    timeout: options.timeout,
    rpId: options.rpId,
    userVerification: options.userVerification as UserVerificationRequirement | undefined,
    allowCredentials: (options.allowCredentials || []).map(c => ({
      type: 'public-key' as const,
      id: base64UrlToBuffer(c.id),
      transports: c.transports as AuthenticatorTransport[] | undefined,
    })),
  }

  const credential = await withExclusiveWebAuthnRequest(
    requestSignal => navigator.credentials.get({ publicKey, signal: requestSignal }) as Promise<PublicKeyCredential | null>,
    signal,
  )
  if (!credential) throw new Error('No credential returned by the authenticator.')

  const response = credential.response as AuthenticatorAssertionResponse
  return {
    id: credential.id,
    rawId: bufferToBase64Url(credential.rawId),
    type: credential.type,
    response: {
      authenticatorData: bufferToBase64Url(response.authenticatorData),
      signature: bufferToBase64Url(response.signature),
      clientDataJSON: bufferToBase64Url(response.clientDataJSON),
      userHandle: response.userHandle ? bufferToBase64Url(response.userHandle) : null,
    },
    clientExtensionResults: credential.getClientExtensionResults(),
  }
}
