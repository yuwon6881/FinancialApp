import { describe, expect, it } from 'vitest'
import {
  cancelActiveWebAuthnRequest,
  hasActiveWebAuthnRequest,
  WebAuthnRequestBusyError,
  withExclusiveWebAuthnRequest,
} from './webauthnRequest'

describe('exclusive WebAuthn request coordinator', () => {
  it('cancels a request that never settles and releases the next attempt', async () => {
    let requestSignal: AbortSignal | undefined
    const pending = withExclusiveWebAuthnRequest(signal => {
      requestSignal = signal
      if (signal.aborted) return Promise.reject(Object.assign(new Error('cancelled'), { name: 'AbortError' }))
      return new Promise<string>((_, reject) => {
        signal.addEventListener('abort', () => reject(Object.assign(new Error('cancelled'), { name: 'AbortError' })), { once: true })
      })
    })

    await expect(withExclusiveWebAuthnRequest(async () => 'second')).rejects.toBeInstanceOf(WebAuthnRequestBusyError)
    expect(hasActiveWebAuthnRequest()).toBe(true)

    cancelActiveWebAuthnRequest()

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(requestSignal?.aborted).toBe(true)
    expect(hasActiveWebAuthnRequest()).toBe(false)
    await expect(withExclusiveWebAuthnRequest(async () => 'second')).resolves.toBe('second')
  })

  it('ignores a late browser completion after cancellation', async () => {
    let resolveRequest!: (value: string) => void
    const controller = new AbortController()
    const pending = withExclusiveWebAuthnRequest(() => new Promise<string>(resolve => {
      resolveRequest = resolve
    }), controller.signal)
    await Promise.resolve()
    expect(hasActiveWebAuthnRequest()).toBe(true)
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })

    // The browser may deliver a late result after its abort acknowledgement. It must not become an
    // active assertion for a future screen.
    resolveRequest('late result')
    expect(hasActiveWebAuthnRequest()).toBe(false)
    await expect(withExclusiveWebAuthnRequest(async () => 'second')).resolves.toBe('second')
  })
})
