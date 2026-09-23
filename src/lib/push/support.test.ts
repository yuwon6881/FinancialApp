import { afterEach, describe, expect, it, vi } from 'vitest'

const platform = vi.hoisted(() => ({ native: false, value: 'web' as 'web' | 'android' | 'ios' }))

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => platform.native,
    getPlatform: () => platform.value,
  },
}))
vi.mock('./firebaseConfig', () => ({ getFirebaseConfig: () => null, getVapidKey: () => null }))

import { getPushPlatform, pushSupportFailure } from './support'

describe('push platform selection', () => {
  afterEach(() => {
    platform.native = false
    platform.value = 'web'
    Reflect.deleteProperty(window, 'PushManager')
    Reflect.deleteProperty(navigator, 'serviceWorker')
    vi.unstubAllGlobals()
  })

  it('keeps web on the service-worker configuration gate', () => {
    Object.defineProperty(window, 'PushManager', { configurable: true, value: class PushManager {} })
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: {} })
    vi.stubGlobal('Notification', class Notification {})
    expect(getPushPlatform()).toBe('web')
    expect(pushSupportFailure()).toBe('notConfigured')
  })

  it.each(['android', 'ios'] as const)('selects the native %s push contract without VAPID config', nativePlatform => {
    platform.native = true
    platform.value = nativePlatform

    expect(getPushPlatform()).toBe(nativePlatform)
    expect(pushSupportFailure()).toBeNull()
  })
})
