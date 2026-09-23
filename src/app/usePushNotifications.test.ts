import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePushNotifications } from './usePushNotifications'
import * as api from '../lib/api'
import { PushTokenError } from '../lib/push/failure'
import {
  PUSH_DENIED_GUIDANCE,
  PUSH_PERMISSION_REVOKED_GUIDANCE,
  PUSH_SERVICE_BLOCKED_GUIDANCE,
  PUSH_UNSUPPORTED_GUIDANCE,
} from '../lib/push/messages'
import type { PushStatus } from '../types'

vi.mock('../lib/push/firebaseMessaging', () => ({
  getFcmToken: vi.fn(async () => 'fcm-token-123'),
  renewFcmToken: vi.fn(async () => 'fcm-token-123'),
  onForegroundMessage: vi.fn(async () => () => undefined),
}))

let supportedMock = true
vi.mock('../lib/push/support', () => ({
  isPushSupported: () => supportedMock,
  pushSupportFailure: () => (supportedMock ? null : 'unsupported'),
  getPushPlatform: () => 'web',
}))

vi.mock('../lib/push/deviceId', () => ({
  getOrCreateDeviceId: () => 'device-abc',
  getExistingDeviceId: () => 'device-abc',
}))

import { getFcmToken, onForegroundMessage, renewFcmToken } from '../lib/push/firebaseMessaging'

const ACCOUNT = 'someone'

const status = (overrides: Partial<PushStatus> = {}): PushStatus => ({
  enabled: false,
  deviceRegistered: false,
  tokenRenewalRequired: false,
  billRemindersEnabled: false,
  categoryAlertsEnabled: false,
  otherDevicesBillReminders: false,
  otherDevicesCategoryAlerts: false,
  ...overrides,
})

const bothOn = status({
  enabled: true,
  deviceRegistered: true,
  billRemindersEnabled: true,
  categoryAlertsEnabled: true,
})

describe('usePushNotifications', () => {
  // The hook loads lib/push dynamically and caches the promise for the whole module. Warming it
  // once keeps that one-off import cost out of the first test's waitFor budget.
  beforeAll(async () => {
    await import('../lib/push')
  })

  beforeEach(() => {
    vi.clearAllMocks()
    // clearAllMocks only forgets the calls, so a rejection queued by one test would otherwise be
    // the token behaviour every later test inherits.
    ;(getFcmToken as ReturnType<typeof vi.fn>).mockResolvedValue('fcm-token-123')
    ;(renewFcmToken as ReturnType<typeof vi.fn>).mockResolvedValue('fcm-token-123')
    localStorage.clear()
    supportedMock = true
    vi.spyOn(api, 'fetchPushStatus').mockResolvedValue(status())
    vi.spyOn(api, 'upsertPushSubscription').mockResolvedValue(undefined)
    vi.spyOn(api, 'deletePushSubscription').mockResolvedValue(undefined)
    vi.spyOn(api, 'disablePushChannel').mockResolvedValue(undefined)

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
    const { result } = renderHook(() => usePushNotifications(true, vi.fn(), ACCOUNT))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.supported).toBe(false)
    expect(result.current.guidance).toBe(PUSH_UNSUPPORTED_GUIDANCE)
  })

  it('turns one kind on only after permission, service worker, token, and the backend call succeed', async () => {
    vi.spyOn(api, 'fetchPushStatus')
      .mockResolvedValueOnce(status())
      .mockResolvedValueOnce(status({
        enabled: true, deviceRegistered: true, billRemindersEnabled: true,
      }))

    const { result } = renderHook(() => usePushNotifications(true, vi.fn(), ACCOUNT))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.billRemindersEnabled).toBe(false)

    let success: boolean | undefined
    await act(async () => {
      success = await result.current.setChannelEnabled('billReminders', true)
    })

    expect(success).toBe(true)
    expect(global.Notification.requestPermission).toHaveBeenCalled()
    expect(getFcmToken).toHaveBeenCalled()
    expect(renewFcmToken).not.toHaveBeenCalled()
    // Only the kind being turned on is sent: the other is deliberately omitted so the server
    // leaves whatever this device already chose alone.
    expect(api.upsertPushSubscription).toHaveBeenCalledWith('device-abc', 'fcm-token-123', { billReminders: true }, 'web')
    expect(result.current.billRemindersEnabled).toBe(true)
    expect(result.current.categoryAlertsEnabled).toBe(false)
  })

  it('turning spending alerts on never turns bill reminders on with it', async () => {
    vi.spyOn(api, 'fetchPushStatus')
      .mockResolvedValueOnce(status())
      .mockResolvedValueOnce(status({
        enabled: true, deviceRegistered: true, categoryAlertsEnabled: true,
      }))

    const { result } = renderHook(() => usePushNotifications(true, vi.fn(), ACCOUNT))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.setChannelEnabled('categoryAlerts', true)
    })

    expect(api.upsertPushSubscription).toHaveBeenCalledWith('device-abc', 'fcm-token-123', { categoryAlerts: true }, 'web')
    expect(result.current.categoryAlertsEnabled).toBe(true)
    expect(result.current.billRemindersEnabled).toBe(false)
  })

  it('gives actionable guidance and stays off when permission is denied', async () => {
    ;(global.Notification.requestPermission as ReturnType<typeof vi.fn>).mockResolvedValue('denied')
    const { result } = renderHook(() => usePushNotifications(true, undefined, ACCOUNT))
    await waitFor(() => expect(result.current.loading).toBe(false))

    let success: boolean | undefined
    await act(async () => {
      success = await result.current.setChannelEnabled('categoryAlerts', true)
    })

    expect(success).toBe(false)
    expect(result.current.categoryAlertsEnabled).toBe(false)
    expect(result.current.guidance).toBe(PUSH_DENIED_GUIDANCE)
    expect(api.upsertPushSubscription).not.toHaveBeenCalled()
  })

  it('gives unsupported guidance and does not touch the backend when the feature gate blocks it', async () => {
    supportedMock = false
    const { result } = renderHook(() => usePushNotifications(true, undefined, ACCOUNT))
    await waitFor(() => expect(result.current.loading).toBe(false))

    let success: boolean | undefined
    await act(async () => {
      success = await result.current.setChannelEnabled('billReminders', true)
    })

    expect(success).toBe(false)
    expect(result.current.guidance).toBe(PUSH_UNSUPPORTED_GUIDANCE)
    expect(api.upsertPushSubscription).not.toHaveBeenCalled()
  })

  // The reported defect: Brave with notifications allowed refuses to register the device with its
  // push service, and every such failure was reported as "this browser does not support push" --
  // which sent people looking for another browser instead of the one setting that fixes it.
  it('names the push service refusal instead of calling the browser unsupported', async () => {
    ;(getFcmToken as ReturnType<typeof vi.fn>).mockRejectedValue(
      new PushTokenError('pushServiceBlocked', 'Registration failed - push service error'),
    )
    const { result } = renderHook(() => usePushNotifications(true, undefined, ACCOUNT))
    await waitFor(() => expect(result.current.loading).toBe(false))

    let success: boolean | undefined
    await act(async () => {
      success = await result.current.setChannelEnabled('billReminders', true)
    })

    expect(success).toBe(false)
    expect(result.current.supported).toBe(true)
    expect(result.current.guidance).toBe(PUSH_SERVICE_BLOCKED_GUIDANCE)
    expect(result.current.billRemindersEnabled).toBe(false)
    expect(api.upsertPushSubscription).not.toHaveBeenCalled()
  })

  // An enrolled device whose token refresh is blocked shows both switches on while nothing can
  // arrive. Reporting the block is what keeps that state honest.
  it('reports a standing block found while refreshing an already enrolled device', async () => {
    vi.spyOn(api, 'fetchPushStatus').mockResolvedValue(bothOn)
    ;(getFcmToken as ReturnType<typeof vi.fn>).mockRejectedValue(
      new PushTokenError('pushServiceBlocked', 'Registration failed - push service error'),
    )

    const { result } = renderHook(() => usePushNotifications(true, undefined, ACCOUNT))

    await waitFor(() => expect(result.current.guidance).toBe(PUSH_SERVICE_BLOCKED_GUIDANCE))
    expect(result.current.supported).toBe(true)
  })

  it('never reports another device opt-in as this device state', async () => {
    // The reported multi-device defect: a phone with alerts on must not make this browser's
    // switch read "on", because nothing will arrive here.
    vi.spyOn(api, 'fetchPushStatus').mockResolvedValue(status({
      enabled: true,
      otherDevicesBillReminders: true,
      otherDevicesCategoryAlerts: true,
    }))
    const { result } = renderHook(() => usePushNotifications(true, vi.fn(), ACCOUNT))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.billRemindersEnabled).toBe(false)
    expect(result.current.categoryAlertsEnabled).toBe(false)
    expect(result.current.otherDevicesBillReminders).toBe(true)
    expect(result.current.otherDevicesCategoryAlerts).toBe(true)
    expect(onForegroundMessage).not.toHaveBeenCalled()
  })

  it('starts foreground Firebase handling only for a registered permitted device', async () => {
    vi.spyOn(api, 'fetchPushStatus').mockResolvedValue(bothOn)

    renderHook(() => usePushNotifications(true, vi.fn(), ACCOUNT))

    await waitFor(() => expect(onForegroundMessage).toHaveBeenCalledTimes(1))
  })

  it('turning one kind off leaves the other on and does not unregister the device', async () => {
    vi.spyOn(api, 'fetchPushStatus')
      .mockResolvedValueOnce(bothOn)
      .mockResolvedValueOnce(status({
        enabled: true, deviceRegistered: true, billRemindersEnabled: true,
      }))

    const { result } = renderHook(() => usePushNotifications(true, undefined, ACCOUNT))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.setChannelEnabled('categoryAlerts', false)
    })

    expect(api.disablePushChannel).toHaveBeenCalledWith('device-abc', 'categoryAlerts')
    expect(api.deletePushSubscription).not.toHaveBeenCalled()
    expect(result.current.categoryAlertsEnabled).toBe(false)
    expect(result.current.billRemindersEnabled).toBe(true)
  })

  it('re-registers this device on sign-in when its row was dropped but this browser opted in', async () => {
    // The reported bug: signing out used to unregister the device, so the switch came back off
    // after every sign-in. The row is gone, permission is still granted, and this browser holds
    // the record of what the user chose here — so it repairs itself.
    localStorage.setItem(
      'push_channel_intent:SOMEONE',
      JSON.stringify({ billReminders: true, categoryAlerts: true }),
    )
    vi.spyOn(api, 'fetchPushStatus')
      .mockResolvedValueOnce(status({ tokenRenewalRequired: true }))
      .mockResolvedValue(bothOn)

    const { result } = renderHook(() => usePushNotifications(true, vi.fn(), ACCOUNT))

    await waitFor(() => expect(api.upsertPushSubscription).toHaveBeenCalledWith(
      'device-abc', 'fcm-token-123', { billReminders: true, categoryAlerts: true }, 'web'))
    expect(renewFcmToken).toHaveBeenCalled()
    expect(getFcmToken).not.toHaveBeenCalled()
    await waitFor(() => expect(result.current.billRemindersEnabled).toBe(true))
    expect(result.current.categoryAlertsEnabled).toBe(true)
  })

  it('does not re-register a device this browser never opted in on', async () => {
    vi.spyOn(api, 'fetchPushStatus').mockResolvedValue(status())

    const { result } = renderHook(() => usePushNotifications(true, vi.fn(), ACCOUNT))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(api.upsertPushSubscription).not.toHaveBeenCalled()
    expect(result.current.billRemindersEnabled).toBe(false)
  })

  it('does not read another account opt-in record on a shared browser', async () => {
    localStorage.setItem(
      'push_channel_intent:SOMEONE-ELSE',
      JSON.stringify({ billReminders: true, categoryAlerts: true }),
    )
    vi.spyOn(api, 'fetchPushStatus').mockResolvedValue(status())

    const { result } = renderHook(() => usePushNotifications(true, vi.fn(), ACCOUNT))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(api.upsertPushSubscription).not.toHaveBeenCalled()
  })

  it('refreshes a rotated token for an already-registered device without rewriting its choices', async () => {
    vi.spyOn(api, 'fetchPushStatus').mockResolvedValue(status({
      enabled: true, deviceRegistered: true, billRemindersEnabled: true,
    }))

    renderHook(() => usePushNotifications(true, vi.fn(), ACCOUNT))

    // No channels argument: re-registering a rotated token must not restate the user's choices.
    await waitFor(() => expect(api.upsertPushSubscription).toHaveBeenCalledWith(
      'device-abc', 'fcm-token-123', undefined, 'web'))
    expect(getFcmToken).toHaveBeenCalled()
    expect(renewFcmToken).not.toHaveBeenCalled()
  })

  it('releases this device when the browser has since revoked notification permission', async () => {
    // The server still says registered; only the browser knows it can no longer show anything.
    Object.defineProperty(global, 'Notification', {
      configurable: true,
      writable: true,
      value: { permission: 'denied', requestPermission: vi.fn(async () => 'denied') },
    })
    vi.spyOn(api, 'fetchPushStatus')
      .mockResolvedValueOnce(bothOn)
      .mockResolvedValue(status())

    const { result } = renderHook(() => usePushNotifications(true, undefined, ACCOUNT))

    await waitFor(() => expect(api.deletePushSubscription).toHaveBeenCalledWith('device-abc'))
    await waitFor(() => expect(result.current.guidance).toBe(PUSH_PERMISSION_REVOKED_GUIDANCE))
    expect(result.current.billRemindersEnabled).toBe(false)
    expect(api.upsertPushSubscription).not.toHaveBeenCalled()
    // The repair record is cleared too, or every later launch would try to re-enrol a browser
    // that has since blocked notifications.
    expect(localStorage.getItem('push_channel_intent:SOMEONE')).toBeNull()
  })

  it('surfaces the server reason when a channel change is refused, and rolls the switch back', async () => {
    vi.spyOn(api, 'fetchPushStatus').mockResolvedValue(status({
      enabled: true, deviceRegistered: true, billRemindersEnabled: true,
    }))
    vi.spyOn(api, 'upsertPushSubscription').mockRejectedValue(new Error('Device limit reached.'))

    const { result } = renderHook(() => usePushNotifications(true, undefined, ACCOUNT))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      expect(await result.current.setChannelEnabled('categoryAlerts', true)).toBe(false)
    })

    expect(result.current.guidance).toBe('Device limit reached.')
    expect(result.current.categoryAlertsEnabled).toBe(false)
    expect(result.current.billRemindersEnabled).toBe(true)
  })

  it('signals the devices roster only after the write is acknowledged, once per change', async () => {
    // The roster reads GET /push/devices off this counter. It used to be derived from the switch
    // booleans, which flip optimistically -- so turning on bill reminders and then spending alerts
    // read the roster while the PUT was still in flight, and the roster kept saying "Bill
    // reminders" until a reload.
    let releaseWrite: (() => void) | undefined
    vi.spyOn(api, 'upsertPushSubscription').mockImplementation(
      () => new Promise<void>(resolve => { releaseWrite = () => resolve() }))
    vi.spyOn(api, 'fetchPushStatus')
      .mockResolvedValueOnce(status())
      .mockResolvedValue(bothOn)

    const { result } = renderHook(() => usePushNotifications(true, undefined, ACCOUNT))
    await waitFor(() => expect(result.current.loading).toBe(false))
    const before = result.current.enrolmentRevision

    let pending: Promise<boolean> | undefined
    await act(async () => {
      pending = result.current.setChannelEnabled('categoryAlerts', true)
      await Promise.resolve()
    })

    // The switch has already flipped, but nothing has been acknowledged yet.
    expect(result.current.categoryAlertsEnabled).toBe(true)
    expect(result.current.enrolmentRevision).toBe(before)

    await act(async () => {
      releaseWrite?.()
      await pending
    })
    expect(result.current.enrolmentRevision).toBe(before + 1)
  })

  it('reports which switch is busy so the other one is not greyed out with it', async () => {
    vi.spyOn(api, 'fetchPushStatus').mockResolvedValue(status({
      enabled: true, deviceRegistered: true, billRemindersEnabled: true,
    }))
    let release: (() => void) | undefined
    vi.spyOn(api, 'upsertPushSubscription').mockImplementation(
      () => new Promise<void>(resolve => { release = () => resolve() }))

    const { result } = renderHook(() => usePushNotifications(true, undefined, ACCOUNT))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.busyAction).toBeNull()

    let pending: Promise<boolean> | undefined
    await act(async () => {
      pending = result.current.setChannelEnabled('categoryAlerts', true)
      await Promise.resolve()
    })
    expect(result.current.busyAction).toBe('categoryAlerts')

    await act(async () => {
      release?.()
      await pending
    })
    expect(result.current.busyAction).toBeNull()
  })

})
