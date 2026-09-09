import { beforeEach, describe, expect, it, vi } from 'vitest'

// A real base64url application server key, because the mismatch check below decodes it.
const VAPID_KEY = 'QUJDRA'
const VAPID_BYTES = new Uint8Array([0x41, 0x42, 0x43, 0x44])

const firebase = vi.hoisted(() => ({
  deleteToken: vi.fn(),
  getToken: vi.fn(),
  getMessaging: vi.fn(() => ({ id: 'messaging' })),
  initializeApp: vi.fn(() => ({ id: 'app' })),
  isSupported: vi.fn(async () => true),
}))

vi.mock('firebase/app', () => ({ initializeApp: firebase.initializeApp }))
vi.mock('firebase/messaging', () => ({
  deleteToken: firebase.deleteToken,
  getMessaging: firebase.getMessaging,
  getToken: firebase.getToken,
  isSupported: firebase.isSupported,
  onMessage: vi.fn(),
}))
vi.mock('./firebaseConfig', () => ({
  getFirebaseConfig: () => ({
    apiKey: 'api-key',
    authDomain: 'example.test',
    projectId: 'project',
    storageBucket: 'bucket',
    messagingSenderId: 'sender',
    appId: 'app-id',
  }),
  getVapidKey: () => VAPID_KEY,
}))

// Each test imports the module fresh: the Messaging instance is cached for the lifetime of the
// module, so a suite that shares it cannot exercise the "Firebase says it is unavailable" path.
async function loadModule() {
  vi.resetModules()
  return import('./firebaseMessaging')
}

function registrationWith(subscription: unknown) {
  return {
    pushManager: { getSubscription: vi.fn(async () => subscription) },
  } as unknown as ServiceWorkerRegistration
}

beforeEach(() => {
  vi.clearAllMocks()
  firebase.deleteToken.mockResolvedValue(true)
  firebase.getToken.mockResolvedValue('renewed-token')
  firebase.isSupported.mockResolvedValue(true)
})

describe('getFcmToken', () => {
  it('returns the token Firebase mints for the app worker', async () => {
    const { getFcmToken } = await loadModule()
    firebase.getToken.mockResolvedValue('fresh-token')
    const registration = registrationWith(null)

    await expect(getFcmToken(registration)).resolves.toBe('fresh-token')

    expect(firebase.getToken).toHaveBeenCalledWith(
      expect.anything(),
      { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration },
    )
  })

  it('keeps a subscription that already carries this application server key', async () => {
    const { getFcmToken } = await loadModule()
    const unsubscribe = vi.fn(async () => true)
    const registration = registrationWith({
      unsubscribe,
      options: { applicationServerKey: VAPID_BYTES.buffer },
    })

    await expect(getFcmToken(registration)).resolves.toBe('renewed-token')

    expect(unsubscribe).not.toHaveBeenCalled()
  })

  // Firebase reuses an existing subscription without checking its key, so a stale one from another
  // VAPID key would be handed to FCM and rejected on every attempt, with no way out from the UI.
  it('drops a subscription minted for a different application server key', async () => {
    const { getFcmToken } = await loadModule()
    const unsubscribe = vi.fn(async () => true)
    const registration = registrationWith({
      unsubscribe,
      options: { applicationServerKey: new Uint8Array([9, 9, 9, 9]).buffer },
    })

    await expect(getFcmToken(registration)).resolves.toBe('renewed-token')

    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('reports a push service that refuses to register the device, not an unsupported browser', async () => {
    const { getFcmToken } = await loadModule()
    const { PUSH_SERVICE_BLOCKED_GUIDANCE } = await import('./messages')
    const { pushErrorGuidance } = await import('./failure')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    firebase.getToken.mockRejectedValue(
      Object.assign(new Error('Registration failed - push service error'), { name: 'AbortError' }),
    )

    const error = await getFcmToken(registrationWith(null)).catch((err: unknown) => err)

    expect(pushErrorGuidance(error)).toBe(PUSH_SERVICE_BLOCKED_GUIDANCE)
    expect(warn).toHaveBeenCalled()
  })

  it('reports blocked site data when Firebase itself reports it cannot run here', async () => {
    const { getFcmToken } = await loadModule()
    const { PUSH_STORAGE_BLOCKED_GUIDANCE } = await import('./messages')
    const { pushErrorGuidance } = await import('./failure')
    firebase.isSupported.mockResolvedValue(false)

    const error = await getFcmToken(registrationWith(null)).catch((err: unknown) => err)

    expect(pushErrorGuidance(error)).toBe(PUSH_STORAGE_BLOCKED_GUIDANCE)
    expect(firebase.getToken).not.toHaveBeenCalled()
  })

  it('treats a token-less success as the push service declining', async () => {
    const { getFcmToken } = await loadModule()
    const { pushErrorGuidance } = await import('./failure')
    const { PUSH_SERVICE_BLOCKED_GUIDANCE } = await import('./messages')
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    firebase.getToken.mockResolvedValue('')

    const error = await getFcmToken(registrationWith(null)).catch((err: unknown) => err)

    expect(pushErrorGuidance(error)).toBe(PUSH_SERVICE_BLOCKED_GUIDANCE)
  })
})

describe('renewFcmToken', () => {
  it('binds Firebase to the app worker before deleting and replacing the cached token', async () => {
    const { renewFcmToken } = await loadModule()
    const registration = registrationWith(null)

    await expect(renewFcmToken(registration)).resolves.toBe('renewed-token')

    expect(firebase.deleteToken).toHaveBeenCalledTimes(1)
    expect(firebase.getToken).toHaveBeenCalledTimes(2)
    expect(firebase.getToken).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration },
    )
    expect(firebase.getToken).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration },
    )
    expect(firebase.getToken.mock.invocationCallOrder[0]).toBeLessThan(
      firebase.deleteToken.mock.invocationCallOrder[0],
    )
    expect(firebase.deleteToken.mock.invocationCallOrder[0]).toBeLessThan(
      firebase.getToken.mock.invocationCallOrder[1],
    )
  })

  it('replaces the browser subscription when FCM says the retired token is already gone', async () => {
    const { renewFcmToken } = await loadModule()
    const unsubscribe = vi.fn(async () => true)
    // No applicationServerKey, so the mismatch check leaves it alone and the unsubscribe below
    // is the one the failed deletion forces.
    const registration = registrationWith({ unsubscribe })
    firebase.deleteToken.mockRejectedValue(new Error('token is unregistered'))

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    await expect(renewFcmToken(registration)).resolves.toBe('renewed-token')

    expect(unsubscribe).toHaveBeenCalledTimes(1)
    expect(firebase.getToken).toHaveBeenCalledTimes(2)
    expect(warn).not.toHaveBeenCalled()
  })

  it('reports the reason when the replacement token cannot be minted', async () => {
    const { renewFcmToken } = await loadModule()
    const { pushErrorGuidance } = await import('./failure')
    const { PUSH_DENIED_GUIDANCE } = await import('./messages')
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    firebase.getToken.mockRejectedValue(
      Object.assign(new Error('permission blocked'), { code: 'messaging/permission-blocked' }),
    )

    const error = await renewFcmToken(registrationWith(null)).catch((err: unknown) => err)

    expect(pushErrorGuidance(error)).toBe(PUSH_DENIED_GUIDANCE)
  })
})
