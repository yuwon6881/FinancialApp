import { describe, expect, it } from 'vitest'
import {
  cancelActiveWebAuthnRequest,
  hasActiveWebAuthnRequest,
  WebAuthnRequestBusyError,
  withExclusiveWebAuthnRequest,
} from './webauthnRequest'

describe('exclusive WebAuthn request coordinator', () => {
  it('starts the browser operation before the caller yields to the event loop', async () => {
    const calls: string[] = []
    const pending = withExclusiveWebAuthnRequest(async () => {
      calls.push('operation')
      return 'done'
    })

    expect(calls).toEqual(['operation'])
    await expect(pending).resolves.toBe('done')
  })

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

  it('releases a cancelled request even if the browser promise never settles', async () => {
    let resolveRequest!: (value: string) => void
    const controller = new AbortController()
    const pending = withExclusiveWebAuthnRequest(() => new Promise<string>(resolve => {
      resolveRequest = resolve
    }), controller.signal)
    await Promise.resolve()
    expect(hasActiveWebAuthnRequest()).toBe(true)
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(hasActiveWebAuthnRequest()).toBe(false)
    let resolveNext!: (value: string) => void
    const next = withExclusiveWebAuthnRequest(() => new Promise<string>(resolve => {
      resolveNext = resolve
    }))
    expect(hasActiveWebAuthnRequest()).toBe(true)

    // A late result from the cancelled request cannot release or replace a newer request.
    resolveRequest('late result')
    await Promise.resolve()
    await Promise.resolve()
    expect(hasActiveWebAuthnRequest()).toBe(true)
    resolveNext('second')
    await expect(next).resolves.toBe('second')
    expect(hasActiveWebAuthnRequest()).toBe(false)
    await expect(withExclusiveWebAuthnRequest(async () => 'second')).resolves.toBe('second')
  })
})
