import { Capacitor, registerPlugin, type PermissionState, type PluginListenerHandle } from '@capacitor/core'
import { PushTokenError } from './failure'

export const NATIVE_PUSH_CHANNEL_ID = 'financialapp-alerts'

let nativeRegistrationRequested = false

const NativePushConfiguration = registerPlugin<{
  isConfigured(): Promise<{ configured: boolean }>
}>('NativePushConfiguration')

export async function assertNativePushConfigured(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return
  const { configured } = await NativePushConfiguration.isConfigured()
  if (!configured) {
    throw new PushTokenError('notConfigured', 'Firebase Android configuration is missing from this app build.')
  }
}

export async function checkNativePushPermission(): Promise<PermissionState> {
  const { PushNotifications } = await import('@capacitor/push-notifications')
  return (await PushNotifications.checkPermissions()).receive
}

export async function requestNativePushPermission(): Promise<PermissionState> {
  const { PushNotifications } = await import('@capacitor/push-notifications')
  return (await PushNotifications.requestPermissions()).receive
}

export async function getNativeFcmToken(renew = false): Promise<string> {
  await assertNativePushConfigured()
  const [{ PushNotifications }, { FCM }] = await Promise.all([
    import('@capacitor/push-notifications'),
    import('@capacitor-community/fcm'),
  ])

  if (Capacitor.getPlatform() === 'android') {
    await PushNotifications.createChannel({
      id: NATIVE_PUSH_CHANNEL_ID,
      name: 'FinancialApp alerts',
      description: 'Reminders and account alerts from FinancialApp',
      importance: 4,
      sound: 'default',
      vibration: true,
    })
  }

  if (!nativeRegistrationRequested) {
    await PushNotifications.register()
    nativeRegistrationRequested = true
  }
  const result = renew ? await FCM.refreshToken() : await FCM.getToken()
  if (!result.token) throw new Error('Firebase did not return a registration token.')
  return result.token
}

export async function listenForNativeForegroundPush(
  onNotification: (message: string, title?: string) => void,
): Promise<() => void> {
  const { PushNotifications } = await import('@capacitor/push-notifications')
  const listener: PluginListenerHandle = await PushNotifications.addListener('pushNotificationReceived', notification => {
    onNotification(notification.body || 'Open the app to review this update.', notification.title || 'FinancialApp notification')
  })
  return () => { void listener.remove() }
}

export async function listenForNativePushActions(
  onAction: (data: unknown) => void,
): Promise<() => void> {
  const { PushNotifications } = await import('@capacitor/push-notifications')
  const listener = await PushNotifications.addListener('pushNotificationActionPerformed', action => {
    onAction(action.notification.data)
  })
  return () => { void listener.remove() }
}
