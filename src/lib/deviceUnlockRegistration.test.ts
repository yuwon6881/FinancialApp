import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEVICE_UNLOCK_REGISTRATION_EVENT,
  forgetDeviceUnlockCredential,
  getDeviceUnlockRegistrationMarker,
  getRegisteredDeviceCredentialId,
  rememberDeviceUnlockCredential,
  rememberExistingDeviceUnlock,
} from './deviceUnlockRegistration'

describe('device unlock registration', () => {
  beforeEach(() => localStorage.clear())

  it('keeps enrolled credentials scoped to the account on this browser', () => {
    rememberDeviceUnlockCredential(' Alice ', 'AQID')

    expect(getRegisteredDeviceCredentialId('alice')).toBe('010203')
    expect(getRegisteredDeviceCredentialId('bob')).toBe('010203')

    // Once Bob has an account-specific registration, it cannot replace Alice's mapping.
    rememberDeviceUnlockCredential('bob', 'BAUG')
    expect(getRegisteredDeviceCredentialId('alice')).toBe('010203')
    expect(getRegisteredDeviceCredentialId('bob')).toBe('040506')
  })

  it('preserves an account-scoped existing-authenticator marker without leaking it to another account', () => {
    rememberExistingDeviceUnlock('alice')

    expect(getDeviceUnlockRegistrationMarker('alice')).toBe('already_enrolled')
    expect(getDeviceUnlockRegistrationMarker('bob')).toBeNull()
  })

  it('clears only the local mapping for the removed credential', () => {
    rememberDeviceUnlockCredential('alice', 'AQID')
    forgetDeviceUnlockCredential('alice', '010203')

    expect(getRegisteredDeviceCredentialId('alice')).toBeNull()
  })

  it('clears an unidentifiable existing-authenticator marker when a credential is removed', () => {
    rememberExistingDeviceUnlock('alice')
    forgetDeviceUnlockCredential('alice', '010203')

    expect(getDeviceUnlockRegistrationMarker('alice')).toBeNull()
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

      rememberExistingDeviceUnlock('alice')
      expect(listener).toHaveBeenCalledTimes(3)
    } finally {
      window.removeEventListener(DEVICE_UNLOCK_REGISTRATION_EVENT, listener)
    }
  })
})
