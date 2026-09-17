import { Capacitor } from '@capacitor/core'
import { getRegisteredDeviceCredentialId } from './deviceUnlockRegistration'

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean
  userAgentData?: { mobile?: boolean }
}

export function isInstalledMobilePwa(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined' || Capacitor.isNativePlatform()) return false

  const browserNavigator = navigator as NavigatorWithStandalone
  const standalone = browserNavigator.standalone === true
    || (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches)
  if (!standalone) return false

  const userAgent = browserNavigator.userAgent
  const reportsMobile = browserNavigator.userAgentData?.mobile === true
  const isAndroid = /Android/i.test(userAgent)
  const isIos = /iPhone|iPad|iPod/i.test(userAgent)
    || (/Macintosh/i.test(userAgent) && browserNavigator.maxTouchPoints > 1)
  return reportsMobile || isAndroid || isIos
}

export function getMobilePwaLaunchGateCredential(hasWebSession: boolean, username: string): string | null {
  if (!hasWebSession || !username.trim() || !isInstalledMobilePwa()) return null
  return getRegisteredDeviceCredentialId(username)
}
