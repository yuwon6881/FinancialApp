import { withExclusiveWebAuthnRequest } from './webauthnRequest'

const LOCAL_CHALLENGE_BYTES = 32
// Keep the browser ceremony's own deadline aligned with LockScreen's automatic deadline. If an
// Android implementation ignores AbortSignal, it still releases its authenticator slot at the
// same point at which the UI enables retry.
const DEVICE_GATE_TIMEOUT_MS = 15_000
const USER_PRESENT_FLAG = 0x01
const USER_VERIFIED_FLAG = 0x04

export interface LocalDeviceAssertion {
  id: string
  rawId: ArrayBuffer
  type: string
  response: {
    authenticatorData: ArrayBuffer
    clientDataJSON: ArrayBuffer
  }
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index++) difference |= left[index] ^ right[index]
  return difference === 0
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4)
  const binary = atob(padded)
  return Uint8Array.from(binary, character => character.charCodeAt(0))
}

function hexToBytes(value: string): Uint8Array {
  if (!/^(?:[0-9a-f]{2})+$/i.test(value)) throw new Error('The saved device credential is invalid.')
  return Uint8Array.from(value.match(/.{2}/g) ?? [], byte => Number.parseInt(byte, 16))
}

function credentialIdMatches(rawId: ArrayBuffer, expectedHex: string): boolean {
  return bytesEqual(new Uint8Array(rawId), hexToBytes(expectedHex))
}

export async function validateLocalDeviceAssertion(
  assertion: LocalDeviceAssertion,
  expectedCredentialId: string,
  expectedChallenge: Uint8Array,
  expectedOrigin = window.location.origin,
  expectedRpId = window.location.hostname,
): Promise<void> {
  if (assertion.type !== 'public-key' || !credentialIdMatches(assertion.rawId, expectedCredentialId)) {
    throw new Error('The device used a different unlock credential.')
  }

  let clientData: { type?: string; challenge?: string; origin?: string; crossOrigin?: boolean }
  try {
    clientData = JSON.parse(new TextDecoder().decode(assertion.response.clientDataJSON))
  } catch {
    throw new Error('The device returned invalid verification data.')
  }

  if (clientData.type !== 'webauthn.get'
    || clientData.origin !== expectedOrigin
    || clientData.crossOrigin === true
    || !clientData.challenge
    || !bytesEqual(base64UrlToBytes(clientData.challenge), expectedChallenge)) {
    throw new Error('The device verification did not match this app launch.')
  }

  const authenticatorData = new Uint8Array(assertion.response.authenticatorData)
  if (authenticatorData.length < 37) throw new Error('The device returned incomplete verification data.')

  const expectedRpIdHash = new Uint8Array(await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(expectedRpId),
  ))
  if (!bytesEqual(authenticatorData.slice(0, 32), expectedRpIdHash)) {
    throw new Error('The device verification belongs to a different site.')
  }

  const flags = authenticatorData[32]
  if ((flags & USER_PRESENT_FLAG) === 0 || (flags & USER_VERIFIED_FLAG) === 0) {
    throw new Error('Your device did not verify your identity.')
  }
}

export async function verifyMobilePwaDeviceGate(credentialId: string, signal?: AbortSignal): Promise<void> {
  if (!navigator.credentials?.get || !crypto.getRandomValues || !crypto.subtle) {
    throw new Error('Device unlock is unavailable in this browser.')
  }

  const challenge = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(LOCAL_CHALLENGE_BYTES)))
  const credentialIdBytes = hexToBytes(credentialId)
  const credentialIdBuffer = new ArrayBuffer(credentialIdBytes.length)
  new Uint8Array(credentialIdBuffer).set(credentialIdBytes)
  const credential = await withExclusiveWebAuthnRequest(
    requestSignal => navigator.credentials.get({
      mediation: 'required',
      signal: requestSignal,
      publicKey: {
        challenge,
        rpId: window.location.hostname,
        allowCredentials: [{ type: 'public-key', id: credentialIdBuffer }],
        userVerification: 'required',
        timeout: DEVICE_GATE_TIMEOUT_MS,
      },
    }) as Promise<PublicKeyCredential | null>,
    signal,
  )

  if (!credential) throw new Error('No device credential was returned.')
  const response = credential.response as AuthenticatorAssertionResponse
  await validateLocalDeviceAssertion({
    id: credential.id,
    rawId: credential.rawId,
    type: credential.type,
    response: {
      authenticatorData: response.authenticatorData,
      clientDataJSON: response.clientDataJSON,
    },
  }, credentialId, challenge)
}
