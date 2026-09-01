import { beforeEach, describe, expect, it, vi } from 'vitest'

const firebase = vi.hoisted(() => ({
  deleteToken: vi.fn(),
  getToken: vi.fn(),
  getMessaging: vi.fn(() => ({ id: 'messaging' })),
  initializeApp: vi.fn(() => ({ id: 'app' })),
}))

vi.mock('firebase/app', () => ({ initializeApp: firebase.initializeApp }))
vi.mock('firebase/messaging', () => ({
  deleteToken: firebase.deleteToken,
  getMessaging: firebase.getMessaging,
  getToken: firebase.getToken,
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
  getVapidKey: () => 'vapid-key',
}))

import { renewFcmToken } from './firebaseMessaging'

describe('renewFcmToken', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    firebase.deleteToken.mockResolvedValue(true)
    firebase.getToken.mockResolvedValue('renewed-token')
  })

  it('binds Firebase to the app worker before deleting and replacing the cached token', async () => {
    const registration = {
      pushManager: { getSubscription: vi.fn() },
    } as unknown as ServiceWorkerRegistration

    await expect(renewFcmToken(registration)).resolves.toBe('renewed-token')

    expect(firebase.deleteToken).toHaveBeenCalledTimes(1)
    expect(registration.pushManager.getSubscription).not.toHaveBeenCalled()
    expect(firebase.getToken).toHaveBeenCalledTimes(2)
    expect(firebase.getToken).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      { vapidKey: 'vapid-key', serviceWorkerRegistration: registration },
    )
    expect(firebase.getToken).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      { vapidKey: 'vapid-key', serviceWorkerRegistration: registration },
    )
    expect(firebase.getToken.mock.invocationCallOrder[0]).toBeLessThan(
      firebase.deleteToken.mock.invocationCallOrder[0],
    )
    expect(firebase.deleteToken.mock.invocationCallOrder[0]).toBeLessThan(
      firebase.getToken.mock.invocationCallOrder[1],
    )
  })

  it('replaces the browser subscription when FCM says the retired token is already gone', async () => {
    const unsubscribe = vi.fn(async () => true)
    const registration = {
      pushManager: { getSubscription: vi.fn(async () => ({ unsubscribe })) },
    } as unknown as ServiceWorkerRegistration
    firebase.deleteToken.mockRejectedValue(new Error('token is unregistered'))

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    await expect(renewFcmToken(registration)).resolves.toBe('renewed-token')

    expect(unsubscribe).toHaveBeenCalledTimes(1)
    expect(firebase.getToken).toHaveBeenCalledTimes(2)
    expect(warn).not.toHaveBeenCalled()
  })
})
