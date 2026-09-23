import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEVICE_UNLOCK_REGISTRATION_EVENT,
  forgetDeviceUnlockCredential,
  getDeviceUnlockRegistrationMarker,
  getRegisteredDeviceCredentialId,
  rememberDeviceUnlockCredential,
} from './deviceUnlockRegistration'

describe('device unlock registration', () => {
  beforeEach(() => localStorage.clear())

  it('keeps enrolled credentials scoped to the account on this browser', () => {
    rememberDeviceUnlockCredential(' Alice ', 'AQID')

    expect(getRegisteredDeviceCredentialId('alice')).toBe('010203')
    expect(getRegisteredDeviceCredentialId('bob')).toBeNull()

    // Once Bob has an account-specific registration, it cannot replace Alice's mapping.
    rememberDeviceUnlockCredential('bob', 'BAUG')
    expect(getRegisteredDeviceCredentialId('alice')).toBe('010203')
    expect(getRegisteredDeviceCredentialId('bob')).toBe('040506')
  })

  it('clears only the local mapping for the removed credential', () => {
    rememberDeviceUnlockCredential('alice', 'AQID')
    forgetDeviceUnlockCredential('alice', '010203')

    expect(getRegisteredDeviceCredentialId('alice')).toBeNull()
  })

  it('does not treat an old imprecise enrollment marker as proof on this device', () => {
    localStorage.setItem('fingerprint_credential_id_on_this_device:ALICE', 'already_enrolled')
    localStorage.setItem('fingerprint_credential_id_on_this_device', 'already_enrolled')

    expect(getDeviceUnlockRegistrationMarker('alice')).toBeNull()
    expect(getDeviceUnlockRegistrationMarker('bob')).toBeNull()
  })

  it('announces every marker change so a live session can re-ask for its device status', () => {
    const listener = vi.fn()
    window.addEventListener(DEVICE_UNLOCK_REGISTRATION_EVENT, listener)
    try {
      rememberDeviceUnlockCredential('alice', 'AQID')
      expect(listener).toHaveBeenCalledTimes(1)

      forgetDeviceUnlockCredential('alice', '010203')
      expect(listener).toHaveBeenCalledTimes(2)

      // Removing a credential this browser never enrolled changes nothing to announce.
      forgetDeviceUnlockCredential('alice', '040506')
      expect(listener).toHaveBeenCalledTimes(2)

    } finally {
      window.removeEventListener(DEVICE_UNLOCK_REGISTRATION_EVENT, listener)
    }
  })
})
