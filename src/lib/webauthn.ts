// Browser-side glue between the WebAuthn API and the Fido2NetLib JSON shape
// the backend sends/expects (base64url-encoded byte fields, camelCase keys).
import { withExclusiveWebAuthnRequest } from './webauthnRequest'
import { Capacitor } from '@capacitor/core'

const NATIVE_PASSKEY_ORIGIN = 'https://financialapp-ecru.vercel.app'
let nativePasskeyPluginPromise: Promise<typeof import('@capgo/capacitor-passkey')> | null = null
if (Capacitor.isNativePlatform()) {
  // Resolve the lazy native bridge before a user taps a passkey action; the actual OS prompt
  // should begin directly from that gesture, without waiting for a chunk download.
  nativePasskeyPluginPromise = import('@capgo/capacitor-passkey')
}

function loadNativePasskeyPlugin() {
  nativePasskeyPluginPromise ??= import('@capgo/capacitor-passkey')
  return nativePasskeyPluginPromise
}

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
  if (Capacitor.isNativePlatform()) {
    try {
      const { CapacitorPasskey } = await loadNativePasskeyPlugin()
      return (await CapacitorPasskey.isSupported()).available
    } catch {
      return false
    }
  }
  if (!isFingerprintSupported()) return false
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

interface Fido2Descriptor {
  type: 'public-key'
  id: string
  transports?: string[]
}

export interface CreateOptionsJson {
  rp: { id: string; name: string }
  user: { name: string; id: string; displayName: string }
  challenge: string
  pubKeyCredParams: { type: 'public-key'; alg: number }[]
  timeout?: number
  attestation?: 'none' | 'indirect' | 'direct' | 'enterprise'
  authenticatorSelection?: {
    authenticatorAttachment?: 'platform' | 'cross-platform'
    residentKey?: 'discouraged' | 'preferred' | 'required'
    requireResidentKey?: boolean
    userVerification?: 'discouraged' | 'preferred' | 'required'
  }
  excludeCredentials?: Fido2Descriptor[]
}

export interface AssertionOptionsJson {
  challenge: string
  timeout?: number
  rpId?: string
  allowCredentials?: Fido2Descriptor[]
  userVerification?: 'discouraged' | 'preferred' | 'required'
}

interface NativePasskeyCredential<Response extends object> {
  id: string
  rawId: string
  type: 'public-key'
  authenticatorAttachment?: string | null
  response: Response
  clientExtensionResults: Record<string, unknown>
}

interface NativeAttestationResponse {
  attestationObject: string
  clientDataJSON: string
  transports?: unknown
}

interface NativeAssertionResponse {
  authenticatorData: string
  signature: string
  clientDataJSON: string
  userHandle?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireNativePasskeyCredential<Response extends object>(
  value: unknown,
  requiredResponseFields: readonly string[],
): NativePasskeyCredential<Response> {
  if (!isRecord(value) || !isRecord(value.response)) {
    throw new Error('The device returned an incomplete passkey response. Try again or use another sign-in method.')
  }

  const response = value.response
  const id = value.id
  const rawId = value.rawId
  if (
    typeof id !== 'string' || id.length === 0 ||
    typeof rawId !== 'string' || rawId.length === 0 ||
    value.type !== 'public-key'
  ) {
    throw new Error('The device returned an incomplete passkey response. Try again or use another sign-in method.')
  }

  const hasResponseFields = requiredResponseFields.every(field =>
    typeof response[field] === 'string' && response[field].length > 0,
  )

  if (!hasResponseFields) {
    throw new Error('The device returned an incomplete passkey response. Try again or use another sign-in method.')
  }

  return {
    id,
    rawId,
    type: 'public-key',
    authenticatorAttachment: typeof value.authenticatorAttachment === 'string'
      ? value.authenticatorAttachment
      : null,
    response: response as Response,
    clientExtensionResults: isRecord(value.clientExtensionResults) ? value.clientExtensionResults : {},
  }
}

export async function createFingerprintCredential(options: CreateOptionsJson, signal?: AbortSignal) {
  if (Capacitor.isNativePlatform()) {
    return withExclusiveWebAuthnRequest(async () => {
      const { CapacitorPasskey } = await loadNativePasskeyPlugin()
      const result: unknown = await CapacitorPasskey.createCredential({
        origin: NATIVE_PASSKEY_ORIGIN,
        publicKey: options,
      })
      const credential = requireNativePasskeyCredential<NativeAttestationResponse>(result, [
        'attestationObject',
        'clientDataJSON',
      ])
      return {
        id: credential.id,
        rawId: credential.rawId,
        type: credential.type,
        authenticatorAttachment: credential.authenticatorAttachment ?? null,
        response: {
          attestationObject: credential.response.attestationObject,
          clientDataJSON: credential.response.clientDataJSON,
          transports: Array.isArray(credential.response.transports)
            ? credential.response.transports.filter((transport): transport is string => typeof transport === 'string')
            : [],
        },
        clientExtensionResults: credential.clientExtensionResults,
      }
    }, signal)
  }

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
  if (Capacitor.isNativePlatform()) {
    return withExclusiveWebAuthnRequest(async () => {
      const { CapacitorPasskey } = await loadNativePasskeyPlugin()
      const result: unknown = await CapacitorPasskey.getCredential({
        origin: NATIVE_PASSKEY_ORIGIN,
        publicKey: options,
      })
      const credential = requireNativePasskeyCredential<NativeAssertionResponse>(result, [
        'authenticatorData',
        'signature',
        'clientDataJSON',
      ])
      return {
        id: credential.id,
        rawId: credential.rawId,
        type: credential.type,
        authenticatorAttachment: credential.authenticatorAttachment ?? null,
        response: {
          authenticatorData: credential.response.authenticatorData,
          signature: credential.response.signature,
          clientDataJSON: credential.response.clientDataJSON,
          userHandle: typeof credential.response.userHandle === 'string' ? credential.response.userHandle : null,
        },
        clientExtensionResults: credential.clientExtensionResults,
      }
    }, signal)
  }

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
    // "platform" when the credential lives in this device's own authenticator, "cross-platform"
    // when it was reached over hybrid transport (the phone-and-QR flow). Callers that record
    // something about *this* device need to tell those apart. Older browsers omit it entirely.
    authenticatorAttachment:
      (credential as PublicKeyCredential & { authenticatorAttachment?: string | null })
        .authenticatorAttachment ?? null,
    response: {
      authenticatorData: bufferToBase64Url(response.authenticatorData),
      signature: bufferToBase64Url(response.signature),
      clientDataJSON: bufferToBase64Url(response.clientDataJSON),
      userHandle: response.userHandle ? bufferToBase64Url(response.userHandle) : null,
    },
    clientExtensionResults: credential.getClientExtensionResults(),
  }
}
