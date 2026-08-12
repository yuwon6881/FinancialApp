import { StrictMode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LockScreen } from './LockScreen'
import * as api from '../lib/api'
import { isPlatformAuthenticatorAvailable } from '../lib/webauthn'

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
})
