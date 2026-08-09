import type { PushDevice, PushStatus } from '../../types'
import { request, requestVoid } from './client'

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

export function updateCategoryLimitAlerts(enabled: boolean): Promise<void> {
  return requestVoid('/push/category-alerts', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
    errorMessage: 'Failed to update category spending alerts',
  })
}

export function upsertPushSubscription(deviceId: string, fcmToken: string): Promise<void> {
  return requestVoid('/push/subscriptions', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId, fcmToken }),
    errorMessage: 'Failed to register this device for push notifications',
  })
}

export function deletePushSubscription(deviceId: string): Promise<void> {
  return requestVoid(`/push/subscriptions/${encodeURIComponent(deviceId)}`, {
    method: 'DELETE',
    errorMessage: 'Failed to unregister this device from push notifications',
  })
}
