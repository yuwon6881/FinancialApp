import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  platform: 'ios' as 'ios' | 'android' | 'web',
  setIosHidden: vi.fn(),
  setAndroidHidden: vi.fn(),
  checkBiometry: vi.fn(),
  authenticate: vi.fn(),
  registeredPluginNames: [] as string[],
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: () => state.platform,
    isNativePlatform: () => state.platform !== 'web',
  },
  registerPlugin: (name: string) => {
    state.registeredPluginNames.push(name)
    return name === 'NativeBiometrics'
      ? {
          checkBiometry: state.checkBiometry,
          authenticate: state.authenticate,
          setHidden: state.setIosHidden,
        }
      : { setHidden: state.setAndroidHidden }
  },
}))

describe('native financial content privacy adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.registeredPluginNames.length = 0
    state.platform = 'ios'
    state.setIosHidden.mockResolvedValue(undefined)
    state.setAndroidHidden.mockResolvedValue(undefined)
  })

  afterEach(() => vi.resetModules())

  it('uses the registered iOS security plugin for the snapshot cover', async () => {
    const { setNativeFinancialContentHidden } = await import('./privacyScreen')

    await setNativeFinancialContentHidden(true)

    expect(state.setIosHidden).toHaveBeenCalledWith({ hidden: true })
    expect(state.setAndroidHidden).not.toHaveBeenCalled()
  })

  it('uses Android PrivacyScreen and skips the bridge on web', async () => {
    const { setNativeFinancialContentHidden } = await import('./privacyScreen')

    state.platform = 'android'
    await setNativeFinancialContentHidden(false)
    state.platform = 'web'
    await setNativeFinancialContentHidden(true)

    expect(state.setAndroidHidden).toHaveBeenCalledWith({ hidden: false })
    expect(state.setAndroidHidden).toHaveBeenCalledOnce()
    expect(state.setIosHidden).not.toHaveBeenCalled()
  })

  it('shares one NativeBiometrics registration between authentication and privacy', async () => {
    const { authenticateNativeDevice } = await import('./deviceAuthentication')
    const { setNativeFinancialContentHidden } = await import('./privacyScreen')

    await authenticateNativeDevice('Verify before opening.')
    await setNativeFinancialContentHidden(true)

    expect(state.registeredPluginNames.filter(name => name === 'NativeBiometrics')).toEqual(['NativeBiometrics'])
    expect(state.authenticate).toHaveBeenCalledWith({ reason: 'Verify before opening.' })
    expect(state.setIosHidden).toHaveBeenCalledWith({ hidden: true })
  })
})
