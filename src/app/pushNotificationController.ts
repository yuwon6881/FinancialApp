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
  const failure = push.pushSupportFailure()
  return {
    supported: failure === null,
    deviceId: failure === null ? push.getOrCreateDeviceId() : null,
    guidance: failure === null ? null : push.pushFailureGuidance(failure),
  }
}

export function fetchPushStatus(deviceId: string): Promise<PushStatus> {
  return api.fetchPushStatus(deviceId)
}

async function notificationPermission(platform: ReturnType<typeof push.getPushPlatform>) {
  return platform === 'web'
    ? Notification.permission
    : push.checkNativePushPermission()
}

async function requestNotificationPermission(platform: ReturnType<typeof push.getPushPlatform>) {
  return platform === 'web'
    ? Notification.requestPermission()
    : push.requestNativePushPermission()
}

async function getRegistrationToken(
  platform: ReturnType<typeof push.getPushPlatform>,
  renew: boolean,
): Promise<string | null> {
  if (platform !== 'web') return push.getNativeFcmToken(renew)
  const registration = await navigator.serviceWorker.ready
  return renew ? push.renewFcmToken(registration) : push.getFcmToken(registration)
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
  const platform = push.getPushPlatform()
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

  if (await notificationPermission(platform) !== 'granted') {
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
    const token = await getRegistrationToken(platform, next.tokenRenewalRequired)
    if (!token) return deviceId
    const channels = next.deviceRegistered
      ? undefined
      : { billReminders: intent.billReminders, categoryAlerts: intent.categoryAlerts }
    await api.upsertPushSubscription(deviceId, token, channels, platform)
    if (!next.deviceRegistered && !callbacks.isCancelled()) {
      callbacks.setStatus(await fetchPushStatus(deviceId))
      callbacks.enrolmentChanged()
    }
  } catch (error) {
    console.warn('Could not refresh this device push token.', error)
    // A silent failure here leaves an enrolled device whose switch says "on" while its
    // registration is dead. Standing blocks are reported so the state on screen is honest;
    // a dropped connection or a one-off is not, because it is neither actionable nor durable.
    if (next.deviceRegistered && !callbacks.isCancelled() && isStandingPushBlock(error)) {
      callbacks.setGuidance(push.pushErrorGuidance(error))
    }
  }
  return deviceId
}

const STANDING_PUSH_BLOCKS: ReadonlySet<push.PushFailureReason> = new Set([
  'pushServiceBlocked',
  'storageBlocked',
  'permissionBlocked',
  'unsupported',
])

function isStandingPushBlock(error: unknown): boolean {
  return STANDING_PUSH_BLOCKS.has(push.classifyPushTokenError(error))
}

export function startForegroundPush(
  onNotification: (message: string, title?: string) => void,
): Promise<() => void> {
  if (push.getPushPlatform() !== 'web') return push.listenForNativeForegroundPush(onNotification)
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

    const platform = push.getPushPlatform()
    if (platform === 'android') await push.assertNativePushConfigured()
    if (await requestNotificationPermission(platform) !== 'granted') {
      return { success: false, status: currentStatus, guidance: push.PUSH_DENIED_GUIDANCE, enrolmentChanged: false }
    }
    const token = await getRegistrationToken(platform, currentStatus.tokenRenewalRequired)
    // Null here means only one thing: this deployment ships no push configuration.
    if (!token) {
      return {
        success: false,
        status: currentStatus,
        guidance: push.PUSH_NOT_CONFIGURED_GUIDANCE,
        enrolmentChanged: false,
      }
    }

    setOptimisticStatus({
      ...currentStatus,
      enabled: true,
      deviceRegistered: true,
      billRemindersEnabled: channel === 'billReminders' ? true : currentStatus.billRemindersEnabled,
      categoryAlertsEnabled: channel === 'categoryAlerts' ? true : currentStatus.categoryAlertsEnabled,
    })
    await api.upsertPushSubscription(deviceId, token, { [channel]: true }, platform)
    rememberIntent(true)
    return { success: true, status: await fetchPushStatus(deviceId), guidance: null, enrolmentChanged: true }
  } catch (error) {
    rememberIntent(channel === 'billReminders'
      ? currentStatus.billRemindersEnabled
      : currentStatus.categoryAlertsEnabled)
    // Anything the classifier can name has a remedy attached, and that beats the raw DOMException
    // text ("Registration failed - push service error") getErrorMessage would otherwise put in
    // front of the user. Everything it cannot name is a server refusal, which speaks for itself.
    const reason = push.classifyPushTokenError(error)
    const guidance = reason === 'unknown'
      ? getErrorMessage(error, enabled
        ? push.pushErrorGuidance(error)
        : 'These notifications could not be turned off. Please try again.')
      : push.pushErrorGuidance(error)
    return { success: false, status: currentStatus, guidance, enrolmentChanged: false }
  }
}

export async function setPushPreviewDetails(
  deviceId: string,
  showDetails: boolean,
): Promise<void> {
  await api.updatePushPreviewDetails(deviceId, showDetails)
}
