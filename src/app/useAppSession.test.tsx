import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEVICE_UNLOCK_REGISTRATION_EVENT } from '../lib/deviceUnlockRegistration'
import { useAppSession, type UseAppSessionOptions } from './useAppSession'

const mocks = vi.hoisted(() => ({
  isPlatformAuthenticatorAvailable: vi.fn(),
  getFingerprintAssertion: vi.fn(),
  resolveSessionToken: vi.fn(),
  fetchAuthStatus: vi.fn(),
  verifyFingerprintAssert: vi.fn(),
  invalidateCache: vi.fn(),
  noteSessionUnlocked: vi.fn(),
  logout: vi.fn(),
  getCachedFingerprintAssertOptions: vi.fn(),
  clearCachedFingerprintAssertOptions: vi.fn(),
  prefetchFingerprintAssertOptions: vi.fn(),
  getRegisteredDeviceCredentialId: vi.fn(),
  rememberDeviceUnlockCredential: vi.fn(),
  forgetDeviceUnlockCredential: vi.fn(),
  verifyMobilePwaDeviceGate: vi.fn(),
  getMobilePwaLaunchGateCredential: vi.fn(),
  tokenStore: {
    getToken: vi.fn(),
    setToken: vi.fn(),
    clearToken: vi.fn(),
  },
}))

vi.mock('../lib/api', () => ({
  fetchAuthStatus: mocks.fetchAuthStatus,
  verifyFingerprintAssert: mocks.verifyFingerprintAssert,
  invalidateCache: mocks.invalidateCache,
  noteSessionUnlocked: mocks.noteSessionUnlocked,
  logout: mocks.logout,
}))

vi.mock('../lib/auth', () => ({
  tokenStore: mocks.tokenStore,
  resolveSessionToken: mocks.resolveSessionToken,
  usesCookieAuth: true,
  WEB_COOKIE_SESSION: 'cookie-session',
}))

vi.mock('../lib/webauthn', () => ({
  isPlatformAuthenticatorAvailable: mocks.isPlatformAuthenticatorAvailable,
  getFingerprintAssertion: mocks.getFingerprintAssertion,
}))

vi.mock('../lib/fingerprintOptionsCache', () => ({
  getCachedFingerprintAssertOptions: mocks.getCachedFingerprintAssertOptions,
  clearCachedFingerprintAssertOptions: mocks.clearCachedFingerprintAssertOptions,
  prefetchFingerprintAssertOptions: mocks.prefetchFingerprintAssertOptions,
}))

vi.mock('../lib/deviceUnlockRegistration', () => ({
  DEVICE_UNLOCK_REGISTRATION_EVENT: 'device-unlock-registration-changed',
  getRegisteredDeviceCredentialId: mocks.getRegisteredDeviceCredentialId,
  rememberDeviceUnlockCredential: mocks.rememberDeviceUnlockCredential,
  forgetDeviceUnlockCredential: mocks.forgetDeviceUnlockCredential,
}))

vi.mock('../lib/useAutoLock', () => ({
  useAutoLock: vi.fn(),
}))

vi.mock('../lib/mobilePwaDeviceGateEligibility', () => ({
  getMobilePwaLaunchGateCredential: mocks.getMobilePwaLaunchGateCredential,
}))

vi.mock('../lib/mobilePwaDeviceGate', () => ({
  verifyMobilePwaDeviceGate: mocks.verifyMobilePwaDeviceGate,
}))

function createOptions(): UseAppSessionOptions {
  return {
    onLogoutBackupAndCleanup: vi.fn(),
    onLoginSuccessRestore: vi.fn(),
    loadAll: vi.fn(),
    setHideSensitive: vi.fn(),
    hideSensitive: true,
    onPreferenceOwnerChange: vi.fn(),
    loadAllAbortRef: { current: null },
  }
}

describe('useAppSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
    localStorage.setItem('auth_username', 'alice')
    mocks.resolveSessionToken.mockResolvedValue('cookie-session')
    mocks.isPlatformAuthenticatorAvailable.mockResolvedValue(false)
    mocks.fetchAuthStatus.mockResolvedValue({
      hasFingerprintOnDevice: false,
      hasFingerprint: false,
      isRegistered: true,
      registrationOpen: false,
    })
    mocks.getMobilePwaLaunchGateCredential.mockReturnValue('010203')
    mocks.getRegisteredDeviceCredentialId.mockReturnValue('010203')
    mocks.prefetchFingerprintAssertOptions.mockResolvedValue(undefined)
    mocks.tokenStore.setToken.mockResolvedValue(undefined)
    mocks.tokenStore.clearToken.mockResolvedValue(undefined)
    mocks.logout.mockResolvedValue(undefined)
  })

  it('keeps the startup PWA gate separate from the normal session lock', async () => {
    const options = createOptions()
    const { result } = renderHook(() => useAppSession(options))
    await waitFor(() => expect(result.current.isSessionResolved).toBe(true))

    expect(result.current.isPwaLaunchGateLocked).toBe(true)
    act(() => result.current.handlePwaLaunchGateUnlocked())
    expect(result.current.isPwaLaunchGateLocked).toBe(false)

    act(() => result.current.markSessionLocked())
    expect(result.current.isLocked).toBe(true)
    act(() => result.current.handleUnlocked())
    expect(result.current.isLocked).toBe(false)
    expect(result.current.isPwaLaunchGateLocked).toBe(false)
    expect(options.loadAll).toHaveBeenCalledWith(undefined, undefined, true)
  })

  it('aborts in-flight loading and invalidates cached financial data when the session locks', async () => {
    const options = createOptions()
    const controller = new AbortController()
    options.loadAllAbortRef.current = controller
    const { result } = renderHook(() => useAppSession(options))
    await waitFor(() => expect(result.current.isSessionResolved).toBe(true))

    act(() => result.current.markSessionLocked())

    expect(controller.signal.aborted).toBe(true)
    expect(mocks.invalidateCache).toHaveBeenCalled()
    expect(sessionStorage.getItem('session_locked')).toBe('true')
    expect(localStorage.getItem('session_locked_global')).toBe('true')
  })

  it('re-asks the server when a device registration marker changes in a live session', async () => {
    mocks.isPlatformAuthenticatorAvailable.mockResolvedValue(true)
    const options = createOptions()
    renderHook(() => useAppSession(options))
    await waitFor(() => expect(mocks.fetchAuthStatus).toHaveBeenCalledTimes(1))

    mocks.fetchAuthStatus.mockResolvedValue({
      hasFingerprintOnDevice: true,
      hasFingerprint: true,
      isRegistered: true,
      registrationOpen: false,
    })
    act(() => window.dispatchEvent(new Event(DEVICE_UNLOCK_REGISTRATION_EVENT)))

    await waitFor(() => expect(mocks.fetchAuthStatus).toHaveBeenCalledTimes(2))
  })

  it('still offers device unlock when the first status check loses the race with a waking backend', async () => {
    mocks.isPlatformAuthenticatorAvailable.mockResolvedValue(true)
    mocks.fetchAuthStatus
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue({
        hasFingerprintOnDevice: true,
        hasFingerprint: true,
        isRegistered: true,
        registrationOpen: false,
      })

    const { result } = renderHook(() => useAppSession(createOptions()))

    await waitFor(() => expect(result.current.hasFingerprintSetup).toBe(true), { timeout: 3000 })
    // Sensitive mode is on, so the challenge is fetched before the user can tap anything.
    await waitFor(() => expect(mocks.prefetchFingerprintAssertOptions).toHaveBeenCalled(), { timeout: 3000 })
  })

  it('retries the assert-options prefetch until the waking backend hands over a challenge', async () => {
    mocks.isPlatformAuthenticatorAvailable.mockResolvedValue(true)
    mocks.fetchAuthStatus.mockResolvedValue({
      hasFingerprintOnDevice: true,
      hasFingerprint: true,
      isRegistered: true,
      registrationOpen: false,
    })
    mocks.prefetchFingerprintAssertOptions
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue({ challengeId: 'challenge-1', options: { challenge: 'AQID' } })

    renderHook(() => useAppSession(createOptions()))

    await waitFor(() => expect(mocks.prefetchFingerprintAssertOptions).toHaveBeenCalledTimes(2), { timeout: 3000 })
  })

  it('persists a successful fingerprint reveal through the session callback contract', async () => {
    mocks.isPlatformAuthenticatorAvailable.mockResolvedValue(false)
    mocks.getCachedFingerprintAssertOptions.mockResolvedValue({
      challengeId: 'challenge-1',
      options: { challenge: 'AQID' },
    })
    mocks.getFingerprintAssertion.mockResolvedValue({ id: 'AQID' })
    mocks.verifyFingerprintAssert.mockResolvedValue({ verified: true })
    const options = createOptions()
    const { result } = renderHook(() => useAppSession(options))
    await waitFor(() => expect(result.current.isSessionResolved).toBe(true))
    act(() => result.current.setHasFingerprintSetup(true))

    let verified = false
    await act(async () => {
      verified = await result.current.revealSensitiveWithFingerprint()
    })

    expect(verified).toBe(true)
    expect(mocks.verifyFingerprintAssert).toHaveBeenCalledWith('challenge-1', { id: 'AQID' })
    expect(mocks.rememberDeviceUnlockCredential).toHaveBeenCalledWith('alice', 'AQID')
    expect(options.setHideSensitive).toHaveBeenCalledWith(false)
  })

  it('restores the account marker and clears the lock on login success', async () => {
    const options = createOptions()
    const { result } = renderHook(() => useAppSession(options))
    await waitFor(() => expect(result.current.isSessionResolved).toBe(true))

    await act(async () => {
      await result.current.handleLoginSuccess('new-token', 'bob')
    })

    expect(mocks.tokenStore.setToken).toHaveBeenCalledWith('new-token')
    expect(localStorage.getItem('auth_username')).toBe('bob')
    expect(sessionStorage.getItem('session_locked')).toBe('false')
    expect(result.current.isLocked).toBe(false)
    expect(result.current.username).toBe('bob')
    expect(options.onPreferenceOwnerChange).toHaveBeenCalledWith('bob')
    expect(options.onLoginSuccessRestore).toHaveBeenCalledWith('bob')
  })
})
