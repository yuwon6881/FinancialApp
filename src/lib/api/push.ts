import type { PushChannel, PushDevice, PushStatus } from '../../types'
import { request, requestVoid } from './client'
import type { getPushPlatform } from '../push/support'

type PushPlatform = ReturnType<typeof getPushPlatform>

export function fetchPushStatus(deviceId: string, signal?: AbortSignal): Promise<PushStatus> {
  return request<PushStatus>(`/push/status?deviceId=${encodeURIComponent(deviceId)}`, {
    signal,
    errorMessage: 'Failed to fetch push notification status',
  })
}

export function fetchPushDevices(deviceId: string, signal?: AbortSignal): Promise<PushDevice[]> {
  return request<PushDevice[]>(`/push/devices?deviceId=${encodeURIComponent(deviceId)}`, {
    signal,
    errorMessage: 'Failed to load the devices receiving notifications',
  })
}

export function revokePushDevice(id: string): Promise<void> {
  return requestVoid(`/push/devices/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    errorMessage: 'Failed to stop notifications for that device',
  })
}

/**
 * Registers this device's live FCM token and, optionally, which kinds it wants.
 *
 * An omitted channel means "leave this device's other choice alone", so turning one kind on can
 * never switch the other on as a side effect — and re-registering a rotated token (which happens
 * on every launch) never rewrites the user's choices.
 */
export function upsertPushSubscription(
  deviceId: string,
  fcmToken: string,
  channels: Partial<Record<PushChannel, boolean>> = {},
  platform: PushPlatform = 'web',
): Promise<void> {
  return requestVoid('/push/subscriptions', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId, fcmToken, platform, ...channels }),
    errorMessage: 'Failed to register this device for push notifications',
  })
}

// Turning one kind off needs no token, so it is its own call. There is deliberately no "enable"
// counterpart: enabling has to prove browser permission and produce a token first.
export function disablePushChannel(deviceId: string, channel: PushChannel): Promise<void> {
  return requestVoid(
    `/push/subscriptions/${encodeURIComponent(deviceId)}/channels/${encodeURIComponent(channel)}`,
    {
      method: 'DELETE',
      errorMessage: 'Failed to turn off notifications for this device',
    },
  )
}

export function deletePushSubscription(deviceId: string): Promise<void> {
  return requestVoid(`/push/subscriptions/${encodeURIComponent(deviceId)}`, {
    method: 'DELETE',
    errorMessage: 'Failed to unregister this device from push notifications',
  })
}

export function updatePushPreviewDetails(deviceId: string, showDetails: boolean): Promise<void> {
  return requestVoid(`/push/subscriptions/${encodeURIComponent(deviceId)}/preview-details`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ showDetails }),
    errorMessage: 'Failed to save this device\'s notification privacy setting',
  })
}
