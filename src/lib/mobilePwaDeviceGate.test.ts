import { beforeEach, describe, expect, it, vi } from 'vitest'

const nativePlatform = vi.hoisted(() => ({ value: false }))

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => nativePlatform.value },
}))

import {
  validateLocalDeviceAssertion,
  verifyMobilePwaDeviceGate,
  type LocalDeviceAssertion,
} from './mobilePwaDeviceGate'
import { getMobilePwaLaunchGateCredential, isInstalledMobilePwa } from './mobilePwaDeviceGateEligibility'
import { rememberDeviceUnlockCredential } from './deviceUnlockRegistration'

const credentialHex = '01020304'
const challenge = Uint8Array.from([5, 6, 7, 8])

function base64Url(bytes: Uint8Array): string {
  let binary = ''
  bytes.forEach(byte => { binary += String.fromCharCode(byte) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function assertion(overrides: {
  credentialHex?: string
  challenge?: Uint8Array
  origin?: string
  rpId?: string
  flags?: number
  type?: string
} = {}): Promise<LocalDeviceAssertion> {
  const rpId = overrides.rpId ?? window.location.hostname
  const rpHash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rpId)))
  const authenticatorData = new Uint8Array(37)
  authenticatorData.set(rpHash)
  authenticatorData[32] = overrides.flags ?? 0x05
  const rawId = Uint8Array.from((overrides.credentialHex ?? credentialHex).match(/.{2}/g)!, byte => Number.parseInt(byte, 16))
  const clientDataJSON = new TextEncoder().encode(JSON.stringify({
    type: overrides.type ?? 'webauthn.get',
    challenge: base64Url(overrides.challenge ?? challenge),
    origin: overrides.origin ?? window.location.origin,
  }))
  return {
    id: base64Url(rawId),
    rawId: rawId.buffer,
    type: 'public-key',
    response: { authenticatorData: authenticatorData.buffer, clientDataJSON: clientDataJSON.buffer },
  }
}

function setBrowser(userAgent: string, standalone: boolean, maxTouchPoints = 0, userAgentMobile?: boolean) {
  Object.defineProperty(navigator, 'userAgent', { configurable: true, value: userAgent })
  Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: maxTouchPoints })
  Object.defineProperty(navigator, 'standalone', { configurable: true, value: false })
  Object.defineProperty(navigator, 'userAgentData', { configurable: true, value: { mobile: userAgentMobile } })
  vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: standalone } as MediaQueryList)
}

describe('mobile PWA device gate', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    nativePlatform.value = false
    localStorage.clear()
  })

  it('recognizes installed Android, iOS, and iPadOS PWAs', () => {
    setBrowser('Mozilla/5.0 (Linux; Android 15)', true)
    expect(isInstalledMobilePwa()).toBe(true)

    setBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)', false)
    Object.defineProperty(navigator, 'standalone', { configurable: true, value: true })
    expect(isInstalledMobilePwa()).toBe(true)

    setBrowser('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)', true, 5)
    expect(isInstalledMobilePwa()).toBe(true)
  })

  it('excludes mobile browser tabs, desktop PWAs, and Capacitor', () => {
    setBrowser('Mozilla/5.0 (Linux; Android 15)', false)
    expect(isInstalledMobilePwa()).toBe(false)

    setBrowser('Mozilla/5.0 (Windows NT 10.0)', true)
    expect(isInstalledMobilePwa()).toBe(false)

    setBrowser('Mozilla/5.0 (Linux; Android 15)', true)
    nativePlatform.value = true
    expect(isInstalledMobilePwa()).toBe(false)
  })

  it('requires a saved web session, account name, and exact account-scoped credential', () => {
    setBrowser('Mozilla/5.0 (Linux; Android 15)', true)
    rememberDeviceUnlockCredential('alice', 'AQID')

    expect(getMobilePwaLaunchGateCredential(true, 'alice')).toBe('010203')
    expect(getMobilePwaLaunchGateCredential(false, 'alice')).toBeNull()
    expect(getMobilePwaLaunchGateCredential(true, '')).toBeNull()
    expect(getMobilePwaLaunchGateCredential(true, 'bob')).toBeNull()

    localStorage.setItem('fingerprint_credential_id_on_this_device:CAROL', 'already_enrolled')
    expect(getMobilePwaLaunchGateCredential(true, 'carol')).toBeNull()
  })

  it('accepts a fresh assertion for the exact credential, origin, RP, and challenge', async () => {
    await expect(validateLocalDeviceAssertion(
      await assertion(),
      credentialHex,
      challenge,
    )).resolves.toBeUndefined()
  })

  it.each([
    ['credential', { credentialHex: '09090909' }],
    ['challenge', { challenge: Uint8Array.from([9, 9, 9]) }],
    ['origin', { origin: 'https://attacker.example' }],
    ['RP ID', { rpId: 'attacker.example' }],
    ['user presence', { flags: 0x04 }],
    ['user verification', { flags: 0x01 }],
  ])('rejects a mismatched %s', async (_name, overrides) => {
    await expect(validateLocalDeviceAssertion(
      await assertion(overrides),
      credentialHex,
      challenge,
    )).rejects.toThrow()
  })

  it('requests required platform verification with the saved credential', async () => {
    const get = vi.fn(async (options: CredentialRequestOptions) => {
      const requestedChallenge = Uint8Array.from(options.publicKey!.challenge as Uint8Array)
      return assertion({ challenge: requestedChallenge })
    })
    Object.defineProperty(navigator, 'credentials', { configurable: true, value: { get } })

    await verifyMobilePwaDeviceGate(credentialHex)

    expect(get).toHaveBeenCalledOnce()
    expect(get.mock.calls[0][0].mediation).toBe('required')
    expect(get.mock.calls[0][0].publicKey).toMatchObject({
      rpId: window.location.hostname,
      userVerification: 'required',
      timeout: 30_000,
    })
  })

  it('cancels a pending platform request when its owner goes away', async () => {
    const controller = new AbortController()
    const get = vi.fn((options: CredentialRequestOptions) => new Promise<null>((_, reject) => {
      options.signal?.addEventListener('abort', () => reject(Object.assign(new Error('cancelled'), { name: 'AbortError' })), { once: true })
    }))
    Object.defineProperty(navigator, 'credentials', { configurable: true, value: { get } })

    const pending = verifyMobilePwaDeviceGate(credentialHex, controller.signal)
    await Promise.resolve()
    controller.abort()

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(get).toHaveBeenCalledOnce()
    expect(get.mock.calls[0][0].signal).toBeInstanceOf(AbortSignal)
  })
})
