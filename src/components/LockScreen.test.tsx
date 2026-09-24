import { StrictMode } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEVICE_UNLOCK_TIMEOUT_MS, LockScreen } from './LockScreen'
import * as api from '../lib/api'
import { isPlatformAuthenticatorAvailable } from '../lib/webauthn'
import { prefetchFingerprintAssertOptions } from '../lib/fingerprintOptionsCache'
import { authenticateNativeDevice, checkNativeDeviceAuthentication } from '../lib/native/deviceAuthentication'

vi.mock('../lib/api', () => ({
  fetchAuthStatus: vi.fn(),
  verifyFingerprintAssert: vi.fn(),
  verifyPassword: vi.fn(),
}))

vi.mock('../lib/webauthn', () => ({
  isPlatformAuthenticatorAvailable: vi.fn(),
  getFingerprintAssertion: vi.fn(),
}))

vi.mock('../lib/fingerprintOptionsCache', () => ({
  clearCachedFingerprintAssertOptions: vi.fn(),
  getCachedFingerprintAssertOptions: vi.fn(),
  prefetchFingerprintAssertOptions: vi.fn(async () => undefined),
}))

vi.mock('../lib/native/deviceAuthentication', () => ({
  authenticateNativeDevice: vi.fn(),
  checkNativeDeviceAuthentication: vi.fn(),
}))

/** The prefetch resolves the challenge it fetched; nothing here reads it, but the shape is the
    contract, and `undefined` would type-check only against a mock that lies about the signature. */
const assertOptions = { challengeId: 'challenge-1', options: { challenge: 'Y2hhbGxlbmdl' } }

describe('LockScreen device unlock availability', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isPlatformAuthenticatorAvailable).mockResolvedValue(true)
  })

  it('offers password only when the account credential is registered on another device', async () => {
    vi.mocked(api.fetchAuthStatus).mockResolvedValue({
      isRegistered: true,
      registrationOpen: false,
      hasFingerprint: true,
      hasFingerprintOnDevice: false,
    })

    render(<LockScreen isOpen username="alice" onUnlocked={vi.fn()} onSignOut={vi.fn()} />)

    expect(await screen.findByText('You were inactive for 5 minutes. Enter your password to continue.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Unlock with device' })).toBeNull()
  })

  it('offers device unlock when this device credential belongs to the account', async () => {
    vi.mocked(api.fetchAuthStatus).mockResolvedValue({
      isRegistered: true,
      registrationOpen: false,
      hasFingerprint: true,
      hasFingerprintOnDevice: true,
    })

    render(<LockScreen isOpen username="alice" onUnlocked={vi.fn()} onSignOut={vi.fn()} />)

    expect(await screen.findByRole('button', { name: 'Unlock with device' })).toBeTruthy()
  })

  it('offers device unlock once a waking backend finally answers the status check', async () => {
    vi.mocked(api.fetchAuthStatus)
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue({
        isRegistered: true,
        registrationOpen: false,
        hasFingerprint: true,
        hasFingerprintOnDevice: true,
      })

    render(<LockScreen isOpen username="alice" onUnlocked={vi.fn()} onSignOut={vi.fn()} />)

    expect(await screen.findByRole('button', { name: 'Unlock with device' }, { timeout: 3000 })).toBeTruthy()
    await waitFor(() => expect(prefetchFingerprintAssertOptions).toHaveBeenCalled(), { timeout: 3000 })
  })

  it('keeps asking for the unlock challenge until the backend hands one over', async () => {
    vi.mocked(api.fetchAuthStatus).mockResolvedValue({
      isRegistered: true,
      registrationOpen: false,
      hasFingerprint: true,
      hasFingerprintOnDevice: true,
    })
    vi.mocked(prefetchFingerprintAssertOptions)
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue(assertOptions)

    render(<LockScreen isOpen username="alice" onUnlocked={vi.fn()} onSignOut={vi.fn()} />)

    await waitFor(() => expect(prefetchFingerprintAssertOptions).toHaveBeenCalledTimes(2), { timeout: 3000 })
  })

  it('automatically requests the local PWA gate exactly once and never repeats on resume', async () => {
    const tryDeviceUnlock = vi.fn().mockRejectedValue(Object.assign(new Error('cancelled'), { name: 'NotAllowedError' }))

    render(
      <StrictMode>
        <LockScreen
          mode="pwa-launch"
          isOpen
          username="alice"
          onTryDeviceUnlock={tryDeviceUnlock}
          onUnlocked={vi.fn()}
          onSignOut={vi.fn()}
        />
      </StrictMode>,
    )

    await waitFor(() => expect(tryDeviceUnlock).toHaveBeenCalledTimes(1))
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeTruthy()

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    fireEvent(document, new Event('visibilitychange'))
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    fireEvent(document, new Event('visibilitychange'))
    window.dispatchEvent(new Event('pageshow'))

    expect(tryDeviceUnlock).toHaveBeenCalledTimes(1)
    expect(api.fetchAuthStatus).not.toHaveBeenCalled()
  })

  it('keeps the automatic prompt alive through Strict Mode effect rehearsal', async () => {
    let requestSignal: AbortSignal | undefined
    const tryDeviceUnlock = vi.fn((signal?: AbortSignal) => {
      requestSignal = signal
      return new Promise<void>((_, reject) => {
        signal?.addEventListener('abort', () => reject(Object.assign(new Error('cancelled'), { name: 'AbortError' })), { once: true })
      })
    })
    const { unmount } = render(
      <StrictMode>
        <LockScreen
          mode="pwa-launch"
          isOpen
          username="alice"
          onTryDeviceUnlock={tryDeviceUnlock}
          onUnlocked={vi.fn()}
          onSignOut={vi.fn()}
        />
      </StrictMode>,
    )

    await waitFor(() => expect(tryDeviceUnlock).toHaveBeenCalledOnce())
    await Promise.resolve()
    expect(requestSignal?.aborted).toBe(false)
    unmount()
  })

  it('opens after local verification without contacting the server', async () => {
    const onUnlocked = vi.fn()
    const tryDeviceUnlock = vi.fn().mockResolvedValue(undefined)

    render(
      <LockScreen
        mode="pwa-launch"
        isOpen
        username="alice"
        onTryDeviceUnlock={tryDeviceUnlock}
        onUnlocked={onUnlocked}
        onSignOut={vi.fn()}
      />,
    )

    await waitFor(() => expect(onUnlocked).toHaveBeenCalledOnce())
    expect(api.fetchAuthStatus).not.toHaveBeenCalled()
    expect(api.verifyFingerprintAssert).not.toHaveBeenCalled()
  })

  it('cancels a pending launch request before signing out', async () => {
    let requestSignal: AbortSignal | undefined
    const tryDeviceUnlock = vi.fn((signal?: AbortSignal) => {
      requestSignal = signal
      return new Promise<void>((_, reject) => {
        signal?.addEventListener('abort', () => reject(Object.assign(new Error('cancelled'), { name: 'AbortError' })), { once: true })
      })
    })
    const onSignOut = vi.fn()

    render(
      <LockScreen
        mode="pwa-launch"
        isOpen
        username="alice"
        onTryDeviceUnlock={tryDeviceUnlock}
        onUnlocked={vi.fn()}
        onSignOut={onSignOut}
      />,
    )

    await waitFor(() => expect(requestSignal).toBeDefined())
    fireEvent.click(screen.getByRole('button', { name: 'Sign out instead' }))

    expect(requestSignal?.aborted).toBe(true)
    expect(onSignOut).toHaveBeenCalledOnce()
  })

  it('ignores a late launch result after the request was cancelled', async () => {
    let resolveDevice!: () => void
    const onUnlocked = vi.fn()
    const tryDeviceUnlock = vi.fn(() => new Promise<void>(resolve => {
      resolveDevice = resolve
    }))
    const onSignOut = vi.fn()

    render(
      <LockScreen
        mode="pwa-launch"
        isOpen
        username="alice"
        onTryDeviceUnlock={tryDeviceUnlock}
        onUnlocked={onUnlocked}
        onSignOut={onSignOut}
      />,
    )

    await waitFor(() => expect(tryDeviceUnlock).toHaveBeenCalledOnce())
    fireEvent.click(screen.getByRole('button', { name: 'Sign out instead' }))
    resolveDevice()
    await Promise.resolve()

    expect(onUnlocked).not.toHaveBeenCalled()
    expect(onSignOut).toHaveBeenCalledOnce()
  })

  it('times out a stuck automatic request and enables a retry', async () => {
    vi.useFakeTimers()
    try {
      const tryDeviceUnlock = vi.fn((signal?: AbortSignal) => new Promise<void>((_, reject) => {
        signal?.addEventListener('abort', () => reject(Object.assign(new Error('timed out'), { name: 'AbortError' })), { once: true })
      }))
      render(
        <LockScreen
          mode="pwa-launch"
          isOpen
          username="alice"
          onTryDeviceUnlock={tryDeviceUnlock}
          onUnlocked={vi.fn()}
          onSignOut={vi.fn()}
        />,
      )

      expect(tryDeviceUnlock).toHaveBeenCalledOnce()
      await act(async () => {
        vi.advanceTimersByTime(DEVICE_UNLOCK_TIMEOUT_MS)
        await Promise.resolve()
      })

      expect(screen.getByText('Device verification timed out. Try again or use your password.')).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })

  it('bounds a manual retry when the device request never settles', async () => {
    vi.useFakeTimers()
    try {
      const tryDeviceUnlock = vi.fn(() => new Promise<void>(() => undefined))
      render(<LockScreen mode="pwa-launch" isOpen username="alice"
        onTryDeviceUnlock={tryDeviceUnlock} onUnlocked={vi.fn()} onSignOut={vi.fn()} />)

      expect(tryDeviceUnlock).toHaveBeenCalledOnce()
      await act(async () => {
        vi.advanceTimersByTime(DEVICE_UNLOCK_TIMEOUT_MS)
        await Promise.resolve()
      })
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
      expect(tryDeviceUnlock).toHaveBeenCalledTimes(2)

      await act(async () => {
        vi.advanceTimersByTime(DEVICE_UNLOCK_TIMEOUT_MS)
        await Promise.resolve()
      })
      expect(screen.getByText('Device verification timed out. Try again or use your password.')).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('LockScreen native app unlock', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(checkNativeDeviceAuthentication).mockResolvedValue({ isAvailable: true, deviceIsSecure: true })
    vi.mocked(authenticateNativeDevice).mockResolvedValue(undefined)
  })

  it('dismisses a cancelled automatic prompt quietly and allows a successful retry', async () => {
    const onUnlocked = vi.fn()
    vi.mocked(authenticateNativeDevice)
      .mockRejectedValueOnce(Object.assign(new Error('User cancelled'), { code: 'userCancel' }))
      .mockResolvedValueOnce(undefined)

    render(<LockScreen mode="native-app" isOpen username="alice" onUnlocked={onUnlocked} onSignOut={vi.fn()} />)

    const retry = await screen.findByRole('button', { name: 'Try again' })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByText('Device verification did not finish. Retry with biometrics or your device PIN.')).toBeNull()
    expect(onUnlocked).not.toHaveBeenCalled()

    fireEvent.click(retry)
    await waitFor(() => expect(onUnlocked).toHaveBeenCalledOnce())
    expect(authenticateNativeDevice).toHaveBeenCalledTimes(2)
  })

  it('opens after a successful automatic native authentication', async () => {
    const onUnlocked = vi.fn()

    render(<LockScreen mode="native-app" isOpen username="alice" onUnlocked={onUnlocked} onSignOut={vi.fn()} />)

    await waitFor(() => expect(onUnlocked).toHaveBeenCalledOnce())
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('keeps genuine native authentication failures visible', async () => {
    vi.mocked(authenticateNativeDevice).mockRejectedValue(
      Object.assign(new Error('Authentication failed'), { code: 'authenticationFailed' }),
    )

    render(<LockScreen mode="native-app" isOpen username="alice" onUnlocked={vi.fn()} onSignOut={vi.fn()} />)

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Device verification did not finish. Retry with biometrics or your device PIN.',
    )
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
  })

  it('waits for native device availability and shows only the unavailable guidance when unsupported', async () => {
    vi.mocked(checkNativeDeviceAuthentication).mockResolvedValue({ isAvailable: false, deviceIsSecure: false })
    vi.mocked(authenticateNativeDevice).mockRejectedValue(
      Object.assign(new Error('No device credential'), { code: 'noDeviceCredential' }),
    )

    render(<LockScreen mode="native-app" isOpen username="alice" onUnlocked={vi.fn()} onSignOut={vi.fn()} />)

    expect(await screen.findByText(
      'Device authentication is unavailable. Set up biometrics or a screen lock in device settings, or sign out.',
    )).toBeTruthy()
    expect(authenticateNativeDevice).not.toHaveBeenCalled()
    expect(screen.queryByText(
      'Device verification did not finish. Retry with biometrics or your device PIN.',
    )).toBeNull()
  })
})
