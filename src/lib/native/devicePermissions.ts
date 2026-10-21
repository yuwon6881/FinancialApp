import { Capacitor, type PermissionState } from '@capacitor/core'
import { PurchaseCapturePlugin } from './purchaseCapture'

/**
 * One reading of an operating-system permission, whatever plugin reported it. `blocked` is the
 * state the system dialog can no longer be shown from: Android stops offering it after the second
 * refusal, iOS after the first, so the only way forward is the app's page in system settings.
 */
export type DevicePermission = 'granted' | 'prompt' | 'blocked' | 'unavailable'

/** `limited` is iOS letting the app see some photos, which is enough to take one. */
export function readPermissionState(state: PermissionState | 'limited' | undefined): DevicePermission {
  if (state === 'granted' || state === 'limited') return 'granted'
  if (state === 'denied') return 'blocked'
  if (state === 'prompt' || state === 'prompt-with-rationale') return 'prompt'
  return 'unavailable'
}

/**
 * Android's camera plugin only needs the CAMERA permission when the manifest declares it. This
 * app does not, so photos go through the system camera app and the plugin reports `granted`;
 * that is the truth for this build, not an assumption.
 */
export async function checkCameraPermission(): Promise<DevicePermission> {
  if (!Capacitor.isNativePlatform()) return 'unavailable'
  try {
    const { Camera } = await import('@capacitor/camera')
    return readPermissionState((await Camera.checkPermissions()).camera)
  } catch {
    return 'unavailable'
  }
}

export async function requestCameraPermission(): Promise<DevicePermission> {
  if (!Capacitor.isNativePlatform()) return 'unavailable'
  try {
    const { Camera } = await import('@capacitor/camera')
    return readPermissionState((await Camera.requestPermissions({ permissions: ['camera'] })).camera)
  } catch {
    return 'unavailable'
  }
}

export async function checkNotificationPermission(): Promise<DevicePermission> {
  if (!Capacitor.isNativePlatform()) return 'unavailable'
  try {
    const { checkNativePushPermission } = await import('../push/nativeMessaging')
    return readPermissionState(await checkNativePushPermission())
  } catch {
    return 'unavailable'
  }
}

/** Android can open the app's own pages in system settings; iOS offers no such route here. */
export const canOpenSystemSettings = () => Capacitor.getPlatform() === 'android'

export async function openNotificationSystemSettings(): Promise<void> {
  if (canOpenSystemSettings()) await PurchaseCapturePlugin.openNotificationSettings()
}

/** App info, where Android keeps every runtime permission and the battery setting. */
export async function openAppSystemSettings(): Promise<void> {
  if (canOpenSystemSettings()) await PurchaseCapturePlugin.openBatterySettings()
}

// Per installation, not per account: permissions belong to the phone, so a second account signing
// in on the same phone must not be asked again for what the phone already decided.
const SETUP_SEEN_KEY = 'financialapp.permissionSetup.v1'

export function hasSeenPermissionSetup(): boolean {
  try {
    return localStorage.getItem(SETUP_SEEN_KEY) !== null
  } catch {
    // Storage that cannot be read cannot remember a dismissal either, and re-asking on every
    // launch would be worse than never asking unprompted: Settings still opens the sheet.
    return true
  }
}

export function markPermissionSetupSeen(outcome: 'completed' | 'skipped'): void {
  try {
    localStorage.setItem(SETUP_SEEN_KEY, outcome)
  } catch {
    // See hasSeenPermissionSetup.
  }
}
