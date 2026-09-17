import { describe, expect, it, vi } from 'vitest'
import {
  base64UrlToHex,
  createFingerprintCredential,
  getFingerprintAssertion,
  type AssertionOptionsJson,
  type CreateOptionsJson,
} from './webauthn'

const bytes = (values: number[]) => Uint8Array.from(values).buffer

describe('WebAuthn browser adapter', () => {
  it('uses the backend-compatible uppercase hex credential id', () => {
    expect(base64UrlToHex('AQIDBA')).toBe('01020304')
  })

  it('maps an explicit credential creation call into the API shape', async () => {
    const signal = new AbortController().signal
    const create = vi.fn().mockResolvedValue({
      id: 'credential-id',
      rawId: bytes([1, 2, 3]),
      type: 'public-key',
      response: {
        attestationObject: bytes([4, 5]),
        clientDataJSON: bytes([6, 7]),
        getTransports: () => ['internal'],
      },
      getClientExtensionResults: () => ({ appid: true }),
    })
    Object.defineProperty(navigator, 'credentials', { configurable: true, value: { create } })

    const options: CreateOptionsJson = {
      rp: { id: 'localhost', name: 'FinancialApp' },
      user: { name: 'alice', id: 'AQID', displayName: 'Alice' },
      challenge: 'BAUG',
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
    }
    const result = await createFingerprintCredential(options, signal)

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      publicKey: expect.objectContaining({
        challenge: expect.any(ArrayBuffer),
        user: expect.objectContaining({ id: expect.any(ArrayBuffer) }),
      }),
      signal: expect.any(AbortSignal),
    }))
    expect(result).toMatchObject({
      id: 'credential-id',
      rawId: 'AQID',
      response: {
        attestationObject: 'BAU',
        clientDataJSON: 'Bgc',
        transports: ['internal'],
      },
    })
  })

  it('maps an assertion response and restricts it to the supplied credential ids', async () => {
    const get = vi.fn().mockResolvedValue({
      id: 'credential-id',
      rawId: bytes([1, 2, 3]),
      type: 'public-key',
      response: {
        authenticatorData: bytes([4, 5]),
        signature: bytes([6, 7]),
        clientDataJSON: bytes([8, 9]),
        userHandle: bytes([10]),
      },
      getClientExtensionResults: () => ({}),
    })
    Object.defineProperty(navigator, 'credentials', { configurable: true, value: { get } })

    const options: AssertionOptionsJson = {
      challenge: 'BAUG',
      rpId: 'localhost',
      allowCredentials: [{ type: 'public-key', id: 'AQID' }],
      userVerification: 'required',
    }
    const result = await getFingerprintAssertion(options)

    expect(get.mock.calls[0][0].publicKey).toMatchObject({
      rpId: 'localhost',
      userVerification: 'required',
      allowCredentials: [{ type: 'public-key', id: expect.any(ArrayBuffer) }],
    })
    expect(result).toMatchObject({
      id: 'credential-id',
      rawId: 'AQID',
      response: {
        authenticatorData: 'BAU',
        signature: 'Bgc',
        clientDataJSON: 'CAk',
        userHandle: 'Cg',
      },
    })
  })
})
