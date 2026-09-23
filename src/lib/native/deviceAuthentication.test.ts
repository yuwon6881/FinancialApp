import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  platform: 'ios' as 'ios' | 'android',
  checkBiometry: vi.fn(),
  authenticate: vi.fn(),
  checkAndroid: vi.fn(),
  authenticateAndroid: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => state.platform },
  registerPlugin: () => ({
    checkBiometry: state.checkBiometry,
    authenticate: state.authenticate,
  }),
}))

vi.mock('@aparajita/capacitor-biometric-auth', () => ({
  BiometricAuth: {
    checkBiometry: state.checkAndroid,
    authenticate: state.authenticateAndroid,
  },
}))

describe('native session authentication adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.platform = 'ios'
    state.checkBiometry.mockResolvedValue({ isAvailable: true, deviceIsSecure: true })
    state.checkAndroid.mockResolvedValue({ isAvailable: true, deviceIsSecure: true })
    state.authenticate.mockResolvedValue(undefined)
    state.authenticateAndroid.mockResolvedValue(undefined)
  })

  afterEach(() => vi.resetModules())

  it('uses LocalAuthentication bridge on iOS and preserves the user reason', async () => {
    const { authenticateNativeDevice, checkNativeDeviceAuthentication } = await import('./deviceAuthentication')

    await expect(checkNativeDeviceAuthentication()).resolves.toEqual({ isAvailable: true, deviceIsSecure: true })
    await authenticateNativeDevice('Verify before opening.')

    expect(state.checkBiometry).toHaveBeenCalledOnce()
    expect(state.authenticate).toHaveBeenCalledWith({ reason: 'Verify before opening.' })
    expect(state.authenticateAndroid).not.toHaveBeenCalled()
  })

  it('uses Android biometric auth with device credential fallback', async () => {
    state.platform = 'android'
    const { authenticateNativeDevice, checkNativeDeviceAuthentication } = await import('./deviceAuthentication')

    await checkNativeDeviceAuthentication()
    await authenticateNativeDevice('Verify before opening.')

    expect(state.checkAndroid).toHaveBeenCalledOnce()
    expect(state.authenticateAndroid).toHaveBeenCalledWith(expect.objectContaining({
      reason: 'Verify before opening.',
      allowDeviceCredential: true,
    }))
    expect(state.authenticate).not.toHaveBeenCalled()
  })
})
