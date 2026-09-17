import { beforeEach, describe, expect, it, vi } from 'vitest'

const nativePlatform = vi.hoisted(() => ({ value: false }))

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => nativePlatform.value },
}))

import { rememberDeviceUnlockCredential, rememberExistingDeviceUnlock } from './deviceUnlockRegistration'
import { getMobilePwaLaunchGateCredential, isAndroidInstalledMobilePwa, isInstalledMobilePwa } from './mobilePwaDeviceGateEligibility'

function setBrowser(userAgent: string, standalone: boolean, maxTouchPoints = 0) {
  Object.defineProperty(navigator, 'userAgent', { configurable: true, value: userAgent })
  Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: maxTouchPoints })
  Object.defineProperty(navigator, 'standalone', { configurable: true, value: false })
  vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: standalone } as MediaQueryList)
}

describe('mobile PWA launch-gate eligibility', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    nativePlatform.value = false
    localStorage.clear()
  })

  it('requires the exact account-scoped credential and rejects legacy markers', () => {
    setBrowser('Mozilla/5.0 (Linux; Android 15)', true)
    rememberDeviceUnlockCredential(' Alice ', 'AQID')

    expect(getMobilePwaLaunchGateCredential(true, 'alice')).toBe('010203')
    expect(getMobilePwaLaunchGateCredential(true, 'bob')).toBeNull()

    rememberExistingDeviceUnlock('carol')
    expect(getMobilePwaLaunchGateCredential(true, 'carol')).toBeNull()
    localStorage.setItem('fingerprint_credential_id_on_this_device', 'already_enrolled')
    expect(getMobilePwaLaunchGateCredential(true, 'dave')).toBeNull()
  })

  it('excludes browser tabs, desktop PWAs, and Capacitor', () => {
    setBrowser('Mozilla/5.0 (Linux; Android 15)', false)
    expect(isInstalledMobilePwa()).toBe(false)

    setBrowser('Mozilla/5.0 (Windows NT 10.0)', true)
    expect(isInstalledMobilePwa()).toBe(false)

    setBrowser('Mozilla/5.0 (Linux; Android 15)', true)
    nativePlatform.value = true
    expect(isInstalledMobilePwa()).toBe(false)
  })

  it('identifies an installed Android PWA for the user-activated launch path', () => {
    setBrowser('Mozilla/5.0 (Linux; Android 15)', true)
    expect(isAndroidInstalledMobilePwa()).toBe(true)

    setBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)', false)
    Object.defineProperty(navigator, 'standalone', { configurable: true, value: true })
    expect(isAndroidInstalledMobilePwa()).toBe(false)
  })

  it('does not qualify an anonymous or background-return state for a launch gate', () => {
    setBrowser('Mozilla/5.0 (Linux; Android 15)', true)
    rememberDeviceUnlockCredential('alice', 'AQID')

    expect(getMobilePwaLaunchGateCredential(false, 'alice')).toBeNull()
    // The eligibility function has no visibility/background input by design: it only qualifies
    // the startup call made by useAppSession. Returning from background never calls this gate.
    expect(getMobilePwaLaunchGateCredential(true, 'alice')).toBe('010203')
  })
})
