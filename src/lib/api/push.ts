import type { PushStatus } from '../../types'
import { request, requestVoid } from './client'

export function fetchPushStatus(deviceId: string, signal?: AbortSignal): Promise<PushStatus> {
  return request<PushStatus>(`/push/status?deviceId=${encodeURIComponent(deviceId)}`, {
    signal,
    errorMessage: 'Failed to fetch push notification status',
  })
}

export function updatePushSettings(enabled: boolean): Promise<void> {
  return requestVoid('/push/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
    errorMessage: 'Failed to update push notification settings',
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
