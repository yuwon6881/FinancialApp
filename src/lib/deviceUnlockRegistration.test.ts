import { beforeEach, describe, expect, it } from 'vitest'
import {
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
})
