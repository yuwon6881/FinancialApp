import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  platform: 'android' as 'android' | 'ios',
  createChannel: vi.fn(),
  register: vi.fn(),
  addListener: vi.fn(),
  getToken: vi.fn(),
  refreshToken: vi.fn(),
  isConfigured: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => mocks.platform },
  registerPlugin: () => ({ isConfigured: mocks.isConfigured }),
}))
vi.mock('@capacitor/push-notifications', () => ({
  PushNotifications: {
    createChannel: mocks.createChannel,
    register: mocks.register,
    addListener: mocks.addListener,
  },
}))
vi.mock('@capacitor-community/fcm', () => ({
  FCM: { getToken: mocks.getToken, refreshToken: mocks.refreshToken },
}))

async function loadAdapter() {
  vi.resetModules()
  return import('./nativeMessaging')
}

describe('native FCM adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.platform = 'android'
    mocks.createChannel.mockResolvedValue(undefined)
    mocks.register.mockResolvedValue(undefined)
    mocks.getToken.mockResolvedValue({ token: 'fcm-token' })
    mocks.refreshToken.mockResolvedValue({ token: 'rotated-token' })
    mocks.isConfigured.mockResolvedValue({ configured: true })
    mocks.addListener.mockResolvedValue({ remove: vi.fn() })
  })

  it('creates the stable Android channel and returns the FCM token', async () => {
    const { getNativeFcmToken, NATIVE_PUSH_CHANNEL_ID } = await loadAdapter()

    await expect(getNativeFcmToken()).resolves.toBe('fcm-token')

    expect(mocks.createChannel).toHaveBeenCalledWith(expect.objectContaining({
      id: NATIVE_PUSH_CHANNEL_ID,
      importance: 4,
    }))
    expect(mocks.register).toHaveBeenCalledOnce()
    expect(mocks.getToken).toHaveBeenCalledOnce()
  })

  it('does not call the crashing Firebase plugin when Android has no Firebase app', async () => {
    mocks.isConfigured.mockResolvedValue({ configured: false })
    const { getNativeFcmToken } = await loadAdapter()

    await expect(getNativeFcmToken()).rejects.toMatchObject({ reason: 'notConfigured' })
    expect(mocks.register).not.toHaveBeenCalled()
    expect(mocks.getToken).not.toHaveBeenCalled()
  })

  it('uses FCM refresh for token renewal instead of returning the cached registration', async () => {
    const { getNativeFcmToken } = await loadAdapter()

    await expect(getNativeFcmToken(true)).resolves.toBe('rotated-token')

    expect(mocks.refreshToken).toHaveBeenCalledOnce()
    expect(mocks.getToken).not.toHaveBeenCalled()
  })

  it('forwards native notification tap data to the gated router', async () => {
    const tap = vi.fn()
    mocks.addListener.mockImplementation(async (event: string, callback: (value: unknown) => void) => {
      if (event === 'pushNotificationActionPerformed') callback({ notification: { data: { kind: 'category-limit' } } })
      return { remove: vi.fn() }
    })
    const { listenForNativePushActions } = await loadAdapter()

    const remove = await listenForNativePushActions(tap)

    expect(tap).toHaveBeenCalledWith({ kind: 'category-limit' })
    remove()
  })
})
