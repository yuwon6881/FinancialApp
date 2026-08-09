import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePushNotifications } from './usePushNotifications'
import * as api from '../lib/api'
import { PUSH_DENIED_GUIDANCE, PUSH_ENABLED_ELSEWHERE_MESSAGE, PUSH_PERMISSION_REVOKED_GUIDANCE, PUSH_UNSUPPORTED_GUIDANCE } from '../lib/push/messages'

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
    vi.spyOn(api, 'fetchPushStatus').mockResolvedValue({ enabled: false, deviceRegistered: false, categoryAlertsEnabled: false })
    vi.spyOn(api, 'upsertPushSubscription').mockResolvedValue(undefined)
    vi.spyOn(api, 'deletePushSubscription').mockResolvedValue(undefined)
    vi.spyOn(api, 'updateCategoryLimitAlerts').mockResolvedValue(undefined)

    Object.defineProperty(global, 'Notification', {
      configurable: true,
      writable: true,
      value: { permission: 'granted', requestPermission: vi.fn(async () => 'granted') },
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
      .mockResolvedValueOnce({ enabled: false, deviceRegistered: false, categoryAlertsEnabled: false })
      .mockResolvedValueOnce({ enabled: true, deviceRegistered: true, categoryAlertsEnabled: false })

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
    vi.spyOn(api, 'fetchPushStatus').mockResolvedValue({ enabled: true, deviceRegistered: false, categoryAlertsEnabled: false })
    const { result } = renderHook(() => usePushNotifications())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.enabled).toBe(false)
    expect(result.current.guidance).toBe(PUSH_ENABLED_ELSEWHERE_MESSAGE)
  })

  it('disabling immediately unregisters only this device and reconciles account status', async () => {
    vi.spyOn(api, 'fetchPushStatus')
      .mockResolvedValueOnce({ enabled: true, deviceRegistered: true, categoryAlertsEnabled: false })
      .mockResolvedValueOnce({ enabled: false, deviceRegistered: false, categoryAlertsEnabled: false })

    const { result } = renderHook(() => usePushNotifications())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.enabled).toBe(true)

    await act(async () => {
      await result.current.disable()
    })

    expect(api.deletePushSubscription).toHaveBeenCalledWith('device-abc')
    expect(result.current.enabled).toBe(false)
  })

  it('shows enabled elsewhere after disabling this device when another remains', async () => {
    vi.spyOn(api, 'fetchPushStatus')
      .mockResolvedValueOnce({ enabled: true, deviceRegistered: true, categoryAlertsEnabled: false })
      .mockResolvedValueOnce({ enabled: true, deviceRegistered: false, categoryAlertsEnabled: false })

    const { result } = renderHook(() => usePushNotifications())
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      await result.current.disable()
    })

    expect(result.current.enabled).toBe(false)
    expect(result.current.guidance).toBe(PUSH_ENABLED_ELSEWHERE_MESSAGE)
  })

  it('releases this device when the browser has since revoked notification permission', async () => {
    // The server still says registered; only the browser knows it can no longer show anything.
    Object.defineProperty(global, 'Notification', {
      configurable: true,
      writable: true,
      value: { permission: 'denied', requestPermission: vi.fn(async () => 'denied') },
    })
    vi.spyOn(api, 'fetchPushStatus')
      .mockResolvedValueOnce({ enabled: true, deviceRegistered: true, categoryAlertsEnabled: true })
      .mockResolvedValue({ enabled: false, deviceRegistered: false, categoryAlertsEnabled: false })

    const { result } = renderHook(() => usePushNotifications())

    await waitFor(() => expect(api.deletePushSubscription).toHaveBeenCalledWith('device-abc'))
    await waitFor(() => expect(result.current.guidance).toBe(PUSH_PERMISSION_REVOKED_GUIDANCE))
    expect(result.current.enabled).toBe(false)
    expect(api.upsertPushSubscription).not.toHaveBeenCalled()
  })

  it('surfaces the server reason when category alerts are refused', async () => {
    vi.spyOn(api, 'fetchPushStatus').mockResolvedValue({ enabled: true, deviceRegistered: true, categoryAlertsEnabled: false })
    vi.spyOn(api, 'updateCategoryLimitAlerts').mockRejectedValue(
      new Error('Enable push notifications on at least one device first.'))

    const { result } = renderHook(() => usePushNotifications())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      expect(await result.current.setCategoryAlertsEnabled(true)).toBe(false)
    })

    expect(result.current.guidance).toBe('Enable push notifications on at least one device first.')
    expect(result.current.categoryAlertsEnabled).toBe(false)
  })

  it('reports which control is busy so the other one is not greyed out with it', async () => {
    vi.spyOn(api, 'fetchPushStatus').mockResolvedValue({ enabled: true, deviceRegistered: true, categoryAlertsEnabled: false })
    let release: (() => void) | undefined
    vi.spyOn(api, 'updateCategoryLimitAlerts').mockImplementation(
      () => new Promise<void>(resolve => { release = () => resolve() }))

    const { result } = renderHook(() => usePushNotifications())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.busyAction).toBeNull()

    let pending: Promise<boolean> | undefined
    await act(async () => {
      pending = result.current.setCategoryAlertsEnabled(true)
      await Promise.resolve()
    })
    expect(result.current.busyAction).toBe('categoryAlerts')

    await act(async () => {
      release?.()
      await pending
    })
    expect(result.current.busyAction).toBeNull()
  })

  it('updates category spending alert consent without re-registering the device', async () => {
    vi.spyOn(api, 'fetchPushStatus')
      .mockResolvedValueOnce({ enabled: true, deviceRegistered: true, categoryAlertsEnabled: false })
      .mockResolvedValueOnce({ enabled: true, deviceRegistered: true, categoryAlertsEnabled: true })

    const { result } = renderHook(() => usePushNotifications())
    await waitFor(() => expect(result.current.loading).toBe(false))
    vi.mocked(api.upsertPushSubscription).mockClear()

    await act(async () => {
      expect(await result.current.setCategoryAlertsEnabled(true)).toBe(true)
    })

    expect(api.updateCategoryLimitAlerts).toHaveBeenCalledWith(true)
    expect(api.upsertPushSubscription).not.toHaveBeenCalled()
    expect(result.current.categoryAlertsEnabled).toBe(true)
  })
})
