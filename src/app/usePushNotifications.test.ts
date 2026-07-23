import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePushNotifications } from './usePushNotifications'
import * as api from '../lib/api'
import { PUSH_DENIED_GUIDANCE, PUSH_ENABLED_ELSEWHERE_MESSAGE, PUSH_UNSUPPORTED_GUIDANCE } from '../lib/push/messages'

vi.mock('../lib/push/firebaseMessaging', () => ({
  getFcmToken: vi.fn(async () => 'fcm-token-123'),
  onForegroundMessage: vi.fn(() => () => undefined),
}))

let supportedMock = true
vi.mock('../lib/push/support', () => ({
  isPushSupported: () => supportedMock,
}))

vi.mock('../lib/push/deviceId', () => ({
  getOrCreateDeviceId: () => 'device-abc',
}))

import { getFcmToken } from '../lib/push/firebaseMessaging'

describe('usePushNotifications', () => {
  beforeEach(() => {
    supportedMock = true
    vi.spyOn(api, 'fetchPushStatus').mockResolvedValue({ enabled: false, deviceRegistered: false })
    vi.spyOn(api, 'upsertPushSubscription').mockResolvedValue(undefined)
    vi.spyOn(api, 'updatePushSettings').mockResolvedValue(undefined)

    Object.defineProperty(global, 'Notification', {
      configurable: true,
      writable: true,
      value: { requestPermission: vi.fn(async () => 'granted') },
    })
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { ready: Promise.resolve({} as ServiceWorkerRegistration) },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reports unsupported immediately when the feature gate blocks it', async () => {
    supportedMock = false
    const { result } = renderHook(() => usePushNotifications())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.supported).toBe(false)
    expect(result.current.guidance).toBe(PUSH_UNSUPPORTED_GUIDANCE)
  })

  it('is not enabled until permission, service worker, token, and both backend calls all succeed', async () => {
    vi.spyOn(api, 'fetchPushStatus')
      .mockResolvedValueOnce({ enabled: false, deviceRegistered: false })
      .mockResolvedValueOnce({ enabled: true, deviceRegistered: true })

    const { result } = renderHook(() => usePushNotifications())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.enabled).toBe(false)

    let success: boolean | undefined
    await act(async () => {
      success = await result.current.enable()
    })

    expect(success).toBe(true)
    expect(global.Notification.requestPermission).toHaveBeenCalled()
    expect(getFcmToken).toHaveBeenCalled()
    expect(api.upsertPushSubscription).toHaveBeenCalledWith('device-abc', 'fcm-token-123')
    expect(api.updatePushSettings).toHaveBeenCalledWith(true)
    expect(result.current.enabled).toBe(true)
  })

  it('gives actionable guidance and stays disabled when permission is denied', async () => {
    ;(global.Notification.requestPermission as ReturnType<typeof vi.fn>).mockResolvedValue('denied')
    const { result } = renderHook(() => usePushNotifications())
    await waitFor(() => expect(result.current.loading).toBe(false))

    let success: boolean | undefined
    await act(async () => {
      success = await result.current.enable()
    })

    expect(success).toBe(false)
    expect(result.current.enabled).toBe(false)
    expect(result.current.guidance).toBe(PUSH_DENIED_GUIDANCE)
    expect(api.upsertPushSubscription).not.toHaveBeenCalled()
    expect(api.updatePushSettings).not.toHaveBeenCalled()
  })

  it('gives unsupported guidance and does not touch the backend when the feature gate blocks it', async () => {
    supportedMock = false
    const { result } = renderHook(() => usePushNotifications())
    await waitFor(() => expect(result.current.loading).toBe(false))

    let success: boolean | undefined
    await act(async () => {
      success = await result.current.enable()
    })

    expect(success).toBe(false)
    expect(result.current.guidance).toBe(PUSH_UNSUPPORTED_GUIDANCE)
    expect(api.upsertPushSubscription).not.toHaveBeenCalled()
  })

  it('shows the exact enabled-elsewhere message when the global flag is on but this device is not registered', async () => {
    vi.spyOn(api, 'fetchPushStatus').mockResolvedValue({ enabled: true, deviceRegistered: false })
    const { result } = renderHook(() => usePushNotifications())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.enabled).toBe(false)
    expect(result.current.guidance).toBe(PUSH_ENABLED_ELSEWHERE_MESSAGE)
  })

  it('disabling flips the global flag off without deleting the device subscription', async () => {
    vi.spyOn(api, 'fetchPushStatus')
      .mockResolvedValueOnce({ enabled: true, deviceRegistered: true })
      .mockResolvedValueOnce({ enabled: false, deviceRegistered: true })

    const { result } = renderHook(() => usePushNotifications())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.enabled).toBe(true)

    await act(async () => {
      await result.current.disable()
    })

    expect(api.updatePushSettings).toHaveBeenCalledWith(false)
    expect(result.current.enabled).toBe(false)
  })
})
