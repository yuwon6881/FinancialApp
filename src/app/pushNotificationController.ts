import * as api from '../lib/api'
import { getErrorMessage } from '../lib/errors'
import * as push from '../lib/push'
import type { PushChannel, PushStatus } from '../types'

export interface PushReconcileCallbacks {
  isCancelled: () => boolean
  setSupported: (supported: boolean) => void
  setGuidance: (guidance: string | null) => void
  setStatus: (status: PushStatus) => void
  enrolmentChanged: () => void
}

export interface PushChannelResult {
  success: boolean
  status: PushStatus
  guidance: string | null
  enrolmentChanged: boolean
}

export function getPushDevice(): { supported: boolean; deviceId: string | null; guidance: string | null } {
  const supported = push.isPushSupported()
  return {
    supported,
    deviceId: supported ? push.getOrCreateDeviceId() : null,
    guidance: supported ? null : push.PUSH_UNSUPPORTED_GUIDANCE,
  }
}

export function fetchPushStatus(deviceId: string): Promise<PushStatus> {
  return api.fetchPushStatus(deviceId)
}

export async function reconcilePush(
  account: string | null | undefined,
  callbacks: PushReconcileCallbacks,
): Promise<string | null> {
  const device = getPushDevice()
  callbacks.setSupported(device.supported)
  if (!device.supported || !device.deviceId) {
    callbacks.setGuidance(device.guidance)
    return null
  }

  const deviceId = device.deviceId
  const next = await fetchPushStatus(deviceId)
  if (callbacks.isCancelled()) return deviceId
  callbacks.setStatus(next)
  const intent = push.readPushChannelIntent(account)
  if (next.deviceRegistered) {
    push.writePushChannelIntent(account, {
      billReminders: next.billRemindersEnabled,
      categoryAlerts: next.categoryAlertsEnabled,
    })
  } else if (!push.hasPushChannelIntent(intent)) {
    return deviceId
  }

  if (Notification.permission !== 'granted') {
    if (!next.deviceRegistered) {
      push.writePushChannelIntent(account, { billReminders: false, categoryAlerts: false })
      if (!callbacks.isCancelled()) callbacks.setGuidance(push.PUSH_PERMISSION_REVOKED_GUIDANCE)
      return deviceId
    }
    try {
      await api.deletePushSubscription(deviceId)
      push.writePushChannelIntent(account, { billReminders: false, categoryAlerts: false })
      if (callbacks.isCancelled()) return deviceId
      callbacks.setStatus(await fetchPushStatus(deviceId))
      callbacks.enrolmentChanged()
    } catch (error) {
      console.warn('Could not release this device after notification permission was revoked.', error)
    }
    if (!callbacks.isCancelled()) callbacks.setGuidance(push.PUSH_PERMISSION_REVOKED_GUIDANCE)
    return deviceId
  }

  try {
    const registration = await navigator.serviceWorker.ready
    const token = next.tokenRenewalRequired
      ? await push.renewFcmToken(registration)
      : await push.getFcmToken(registration)
    if (!token) return deviceId
    const channels = next.deviceRegistered
      ? undefined
      : { billReminders: intent.billReminders, categoryAlerts: intent.categoryAlerts }
    await api.upsertPushSubscription(deviceId, token, channels)
    if (!next.deviceRegistered && !callbacks.isCancelled()) {
      callbacks.setStatus(await fetchPushStatus(deviceId))
      callbacks.enrolmentChanged()
    }
  } catch (error) {
    console.warn('Could not refresh this device push token.', error)
  }
  return deviceId
}

export function startForegroundPush(
  onNotification: (message: string, title?: string) => void,
): Promise<() => void> {
  return push.onForegroundMessage(payload => {
    const title = payload.data?.title || payload.notification?.title || 'FinancialApp notification'
    const message = payload.data?.body || payload.notification?.body || 'Open the app to review this update.'
    onNotification(message, title)
  })
}

export async function setPushChannel(
  account: string | null | undefined,
  deviceId: string,
  currentStatus: PushStatus,
  channel: PushChannel,
  enabled: boolean,
  setOptimisticStatus: (status: PushStatus) => void,
): Promise<PushChannelResult> {
  const rememberIntent = (value: boolean) => {
    push.writePushChannelIntent(account, push.withChannel(push.readPushChannelIntent(account), channel, value))
  }

  try {
    if (!enabled) {
      setOptimisticStatus({
        ...currentStatus,
        billRemindersEnabled: channel === 'billReminders' ? false : currentStatus.billRemindersEnabled,
        categoryAlertsEnabled: channel === 'categoryAlerts' ? false : currentStatus.categoryAlertsEnabled,
      })
      rememberIntent(false)
      await api.disablePushChannel(deviceId, channel)
      return { success: true, status: await fetchPushStatus(deviceId), guidance: null, enrolmentChanged: true }
    }

    if (await Notification.requestPermission() !== 'granted') {
      return { success: false, status: currentStatus, guidance: push.PUSH_DENIED_GUIDANCE, enrolmentChanged: false }
    }
    const registration = await navigator.serviceWorker.ready
    const token = currentStatus.tokenRenewalRequired
      ? await push.renewFcmToken(registration)
      : await push.getFcmToken(registration)
    if (!token) {
      return { success: false, status: currentStatus, guidance: push.PUSH_UNSUPPORTED_GUIDANCE, enrolmentChanged: false }
    }

    setOptimisticStatus({
      ...currentStatus,
      enabled: true,
      deviceRegistered: true,
      billRemindersEnabled: channel === 'billReminders' ? true : currentStatus.billRemindersEnabled,
      categoryAlertsEnabled: channel === 'categoryAlerts' ? true : currentStatus.categoryAlertsEnabled,
    })
    await api.upsertPushSubscription(deviceId, token, { [channel]: true })
    rememberIntent(true)
    return { success: true, status: await fetchPushStatus(deviceId), guidance: null, enrolmentChanged: true }
  } catch (error) {
    rememberIntent(channel === 'billReminders'
      ? currentStatus.billRemindersEnabled
      : currentStatus.categoryAlertsEnabled)
    return {
      success: false,
      status: currentStatus,
      guidance: getErrorMessage(error, enabled
        ? push.PUSH_UNSUPPORTED_GUIDANCE
        : 'These notifications could not be turned off. Please try again.'),
      enrolmentChanged: false,
    }
  }
}
